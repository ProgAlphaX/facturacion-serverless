// En el APF3 cada paso será una Lambda y este orden lo llevará Step Functions.

const { validarEsquema } = require('../reglas/esquema');
const { validarReglas, hoyEnLima } = require('../reglas/reglas-negocio');
const { generarXml, idComprobante } = require('../sunat/xml-ubl');
const { comprimir, ErrorSunat } = require('../sunat/cliente-soap');
const { leerCdr, estadoSegunCodigo, ESTADOS } = require('../sunat/cdr');
const { generarPdf } = require('../pdf/representacion-impresa');

class ErrorNegocio extends Error {
  constructor(status, cuerpo) {
    super(cuerpo.error);
    this.name = 'ErrorNegocio';
    this.status = status;
    this.cuerpo = cuerpo;
  }
}

function crearServicioEmision({ emisor, repositorio, almacen, clienteSunat, firmador, hoy = hoyEnLima }) {
  async function emitir(cuerpo) {
    const { datos, errores } = validarEsquema(cuerpo);
    if (errores.length > 0) {
      throw new ErrorNegocio(400, { error: 'Datos del comprobante inválidos', errores });
    }
    const erroresReglas = validarReglas(datos, { emisorRuc: emisor.ruc, hoy: hoy() });
    if (erroresReglas.length > 0) {
      throw new ErrorNegocio(400, { error: 'El comprobante no cumple las reglas de SUNAT', errores: erroresReglas });
    }

    const id = idComprobante(emisor.ruc, datos);
    const reservado = await repositorio.reservar({
      id,
      ...datos,
      estado: 'PROCESANDO',
      creadoEn: new Date().toISOString(),
    });
    if (!reservado) {
      throw new ErrorNegocio(409, { error: `El comprobante ${id} ya fue emitido`, regla: 'R12' });
    }

    const archivos = {};
    let hash;
    try {
      const firmado = firmador.firmar(generarXml(datos, emisor));
      hash = firmado.hash;
      archivos.xml = await almacen.guardar(`firmados/${id}.xml`, firmado.xmlFirmado, 'application/xml');

      let cdr;
      try {
        const zip = await comprimir(`${id}.xml`, firmado.xmlFirmado);
        const cdrZip = await clienteSunat.enviar(`${id}.zip`, zip);
        archivos.cdr = await almacen.guardar(`cdr/R-${id}.zip`, cdrZip, 'application/zip');
        cdr = await leerCdr(cdrZip);
      } catch (err) {
        // Un rechazo también puede llegar como falla SOAP con código 2000–3999
        const esRechazo = err instanceof ErrorSunat && err.codigo && estadoSegunCodigo(err.codigo) === ESTADOS.RECHAZADO;
        if (!esRechazo) throw err;
        cdr = { codigo: err.codigo, descripcion: err.message, observaciones: [], estado: ESTADOS.RECHAZADO };
      }

      if (cdr.estado === ESTADOS.ACEPTADO) {
        const pdf = await generarPdf({ emisor, comprobante: datos, hash });
        archivos.pdf = await almacen.guardar(`pdf/${id}.pdf`, pdf, 'application/pdf');
      }

      const resultado = {
        estado: cdr.estado,
        cdr: { codigo: cdr.codigo, descripcion: cdr.descripcion, observaciones: cdr.observaciones },
        hash,
        archivos,
      };
      await repositorio.actualizar(id, resultado);
      return { id, ...resultado };
    } catch (err) {
      // Queda en ERROR_ENVIO para poder reintentar con el mismo número
      await repositorio.actualizar(id, { estado: ESTADOS.ERROR_ENVIO, error: err.message, hash, archivos });
      if (err instanceof ErrorSunat) {
        throw new ErrorNegocio(502, { error: 'SUNAT no está disponible, intente nuevamente', id, detalle: err.message });
      }
      throw err;
    }
  }

  return { emitir };
}

module.exports = { crearServicioEmision, ErrorNegocio };
