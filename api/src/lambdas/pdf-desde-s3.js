// Se dispara solo cuando el CDR llega a S3 (cdr/R-<id>.zip). Genera pdf/<id>.pdf únicamente si el comprobante quedó ACEPTADO.
// El CDR se guarda antes de que "guardar-resultado" marque el estado final: si todavía figura PROCESANDO se espera un poco;
// si sigue igual se lanza un error y S3 reintenta la invocación por su cuenta (Lambda asíncrona).
const dependencias = require('./dependencias');
const { generarPdf } = require('../pdf/representacion-impresa');
const { ESTADOS } = require('../sunat/cdr');

const CLAVE_CDR = /^cdr\/R-(\d{11}-(?:01|03)-[A-Z0-9]{4}-\d{8})\.zip$/;
const INTENTOS = 4;
const ESPERA_MS = 2000;

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function crearHandler({ repositorio, almacen, emisor, esperar = dormir }) {
  async function esperarEstadoFinal(id) {
    for (let intento = 1; intento <= INTENTOS; intento += 1) {
      const comprobante = await repositorio().obtener(id);
      if (comprobante && comprobante.estado !== 'PROCESANDO') return comprobante;
      if (intento < INTENTOS) await esperar(ESPERA_MS);
    }
    throw new Error(`El comprobante ${id} sigue en PROCESANDO; se reintentará`);
  }

  async function procesar(id) {
    const comprobante = await esperarEstadoFinal(id);
    if (comprobante.estado !== ESTADOS.ACEPTADO) return { id, pdf: null, motivo: comprobante.estado };

    const pdf = await generarPdf({ emisor: emisor(), comprobante, hash: comprobante.hash });
    const clave = await almacen().guardar(`pdf/${id}.pdf`, pdf, 'application/pdf');
    await repositorio().actualizar(id, { archivos: { ...comprobante.archivos, pdf: clave } });
    return { id, pdf: clave };
  }

  return async (event) => {
    const resultados = [];
    for (const registro of event.Records ?? []) {
      const clave = decodeURIComponent(registro.s3.object.key.replace(/\+/g, ' '));
      const id = CLAVE_CDR.exec(clave)?.[1];
      if (id) resultados.push(await procesar(id));
    }
    return resultados;
  };
}

exports.crearHandler = crearHandler;
exports.handler = (event) =>
  crearHandler({
    repositorio: dependencias.repositorio,
    almacen: dependencias.almacen,
    emisor: () => ({ ruc: process.env.EMISOR_RUC, razonSocial: process.env.EMISOR_RAZON_SOCIAL }),
  })(event);
