// Entrada: { id, xml } · Salida: { id, xmlFirmado, hash, xmlKey }
const dependencias = require('./dependencias');

function crearHandler({ obtenerFirmador, almacen }) {
  return async ({ id, xml }) => {
    const firmador = await obtenerFirmador();
    const { xmlFirmado, hash } = firmador.firmar(xml);
    const xmlKey = await almacen().guardar(`firmados/${id}.xml`, xmlFirmado, 'application/xml');
    return { id, xmlFirmado, hash, xmlKey };
  };
}

exports.crearHandler = crearHandler;
exports.handler = (event) =>
  crearHandler({ obtenerFirmador: dependencias.firmador, almacen: dependencias.almacen })(event);
