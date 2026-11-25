// Entrada: evento de API Gateway (proxy) con pathParameters { id, tipo } (GET /comprobantes/{id}/archivos/{tipo})
// Salida: { statusCode, body } con { url, nombre, expiraEnSegundos }: una URL de S3 que vence en pocos minutos.
const dependencias = require('./dependencias');
const { FORMATO_ID } = require('../almacenamiento/dynamo');

const SEGUNDOS_DE_VIDA = 300;
const EXTENSION_POR_TIPO = { xml: 'xml', cdr: 'zip', pdf: 'pdf' };

const respuesta = (statusCode, cuerpo) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

function crearHandler({ repositorio, almacen }) {
  return async (event) => {
    const { id, tipo } = event.pathParameters ?? {};

    if (!FORMATO_ID.test(id || '')) {
      return respuesta(404, { error: 'Formato de id esperado: RUC-TIPO-SERIE-NUMERO (ej. 20000000001-01-F001-00000001)' });
    }
    if (!Object.hasOwn(EXTENSION_POR_TIPO, tipo)) {
      return respuesta(400, { error: 'El tipo de archivo debe ser xml, cdr o pdf' });
    }

    const comprobante = await repositorio().obtener(id);
    if (!comprobante) return respuesta(404, { error: `No existe el comprobante ${id}` });

    // La clave de S3 sale de DynamoDB, nunca de lo que mande quien llama: solo se firman archivos de este comprobante.
    const clave = comprobante.archivos?.[tipo];
    if (!clave) {
      return respuesta(404, { error: `El comprobante ${id} no tiene archivo ${tipo}${tipo === 'pdf' ? ' (se genera unos segundos después de aceptarlo y solo si fue aceptado)' : ''}` });
    }

    const nombre = `${id}.${EXTENSION_POR_TIPO[tipo]}`;
    const url = await almacen().urlDescarga(clave, { nombre, segundos: SEGUNDOS_DE_VIDA });
    return respuesta(200, { url, nombre, expiraEnSegundos: SEGUNDOS_DE_VIDA });
  };
}

exports.crearHandler = crearHandler;
exports.handler = (event) =>
  crearHandler({ repositorio: dependencias.repositorio, almacen: dependencias.almacen })(event);
