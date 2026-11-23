// Entrada: { id, xmlFirmado } · Salida: { id, cdr: { codigo, descripcion, observaciones, estado }, cdrKey }
// Si SUNAT no responde lanza ErrorSunat: Step Functions lo reintenta (Retry) o lo manda a ERROR_ENVIO (Catch).
const dependencias = require('./dependencias');
const { comprimir, ErrorSunat } = require('../sunat/cliente-soap');
const { leerCdr, estadoSegunCodigo, ESTADOS } = require('../sunat/cdr');

function crearHandler({ clienteSunat, almacen }) {
  return async ({ id, xmlFirmado }) => {
    try {
      const cdrZip = await clienteSunat().enviar(`${id}.zip`, await comprimir(`${id}.xml`, xmlFirmado));
      const cdrKey = await almacen().guardar(`cdr/R-${id}.zip`, cdrZip, 'application/zip');
      return { id, cdr: await leerCdr(cdrZip), cdrKey };
    } catch (err) {
      // Un rechazo también puede llegar como falla SOAP con código 2000–3999
      const esRechazo = err instanceof ErrorSunat && err.codigo && estadoSegunCodigo(err.codigo) === ESTADOS.RECHAZADO;
      if (!esRechazo) throw err;
      return { id, cdr: { codigo: err.codigo, descripcion: err.message, observaciones: [], estado: ESTADOS.RECHAZADO } };
    }
  };
}

exports.crearHandler = crearHandler;
exports.handler = (event) =>
  crearHandler({ clienteSunat: dependencias.clienteSunat, almacen: dependencias.almacen })(event);
