// Entrada: evento de API Gateway (proxy) con queryStringParameters { estado?, limite?, desde? }
// Salida: { statusCode, body } con { comprobantes, total, siguiente, resumen } (GET /comprobantes)
const dependencias = require('./dependencias');
const { ESTADOS } = require('../almacenamiento/dynamo');

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 100;

const respuesta = (statusCode, cuerpo) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

// Un entero dentro de [minimo, maximo]; si el texto no lo es devuelve null.
function entero(texto, { porDefecto, minimo, maximo }) {
  if (texto === undefined || texto === '') return porDefecto;
  if (!/^\d{1,9}$/.test(texto)) return null;
  const numero = Number(texto);
  return numero >= minimo && numero <= maximo ? numero : null;
}

function crearHandler({ repositorio, ruc }) {
  return async (event) => {
    const { estado, limite: textoLimite, desde: textoDesde } = event.queryStringParameters ?? {};

    if (estado !== undefined && estado !== '' && !ESTADOS.includes(estado)) {
      return respuesta(400, { error: `El estado debe ser uno de: ${ESTADOS.join(', ')}` });
    }
    const limite = entero(textoLimite, { porDefecto: LIMITE_POR_DEFECTO, minimo: 1, maximo: LIMITE_MAXIMO });
    if (limite === null) {
      return respuesta(400, { error: `El límite debe ser un número entre 1 y ${LIMITE_MAXIMO}` });
    }
    const desde = entero(textoDesde, { porDefecto: 0, minimo: 0, maximo: 999_999_999 });
    if (desde === null) {
      return respuesta(400, { error: 'El parámetro desde debe ser un número entero mayor o igual a 0' });
    }

    const pagina = await repositorio().listar({ ruc: ruc(), estado: estado || undefined, limite, desde });
    return respuesta(200, pagina);
  };
}

exports.crearHandler = crearHandler;
exports.handler = (event) =>
  crearHandler({ repositorio: dependencias.repositorio, ruc: () => process.env.EMISOR_RUC })(event);
