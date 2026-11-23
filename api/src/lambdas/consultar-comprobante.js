// Entrada: evento de API Gateway (proxy) con pathParameters.id · Salida: { statusCode, body } igual que el GET de la entrega 2.
const dependencias = require('./dependencias');
const { FORMATO_ID } = require('../almacenamiento/dynamo');

const respuesta = (statusCode, cuerpo) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

function crearHandler({ repositorio }) {
  return async (event) => {
    const id = event.pathParameters?.id;
    if (!FORMATO_ID.test(id || '')) {
      return respuesta(404, { error: 'Formato de id esperado: RUC-TIPO-SERIE-NUMERO (ej. 20000000001-01-F001-00000001)' });
    }
    const comprobante = await repositorio().obtener(id);
    if (!comprobante) return respuesta(404, { error: `No existe el comprobante ${id}` });
    return respuesta(200, comprobante);
  };
}

exports.crearHandler = crearHandler;
exports.handler = (event) => crearHandler({ repositorio: dependencias.repositorio })(event);
