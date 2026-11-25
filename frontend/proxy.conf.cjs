// Proxy de `ng serve`: el navegador llama a /api/... en localhost y este archivo lo reenvía a API Gateway
// agregando la llave de API. Así no hay CORS y la llave no queda dentro del código de la web.
const { leerEnvLocal } = require('./scripts/leer-env-local.cjs');

const env = leerEnvLocal();
const destino = new URL(env['API_URL']);
// La API vive bajo la etapa (p. ej. /dev): /api/comprobantes → /dev/comprobantes
const etapa = destino.pathname.replace(/\/$/, '');

module.exports = {
  '/api': {
    target: destino.origin,
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/api': etapa },
    headers: { 'x-api-key': env['API_KEY'] },
  },
};
