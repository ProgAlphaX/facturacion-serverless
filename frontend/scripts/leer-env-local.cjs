// Lee frontend/.env.local (líneas CLAVE=valor). Lo comparten el proxy y el generador de entorno.
const fs = require('node:fs');
const path = require('node:path');

const CLAVES_OBLIGATORIAS = ['API_URL', 'COGNITO_REGION', 'COGNITO_CLIENT_ID', 'API_KEY'];

function leerEnvLocal() {
  const archivo = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(archivo)) {
    throw new Error('Falta frontend/.env.local. Se crea en la Fase 1 (ver plans/apf4/frontend/FASE-1-ENCENDER-Y-CREDENCIALES.md).');
  }
  /** @type {Record<string, string>} */
  const valores = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const posicion = linea.indexOf('=');
    if (posicion > 0 && !linea.trimStart().startsWith('#')) {
      valores[linea.slice(0, posicion).trim()] = linea.slice(posicion + 1).trim();
    }
  }
  const faltan = CLAVES_OBLIGATORIAS.filter((clave) => !valores[clave]);
  if (faltan.length > 0) {
    throw new Error(`Faltan claves en .env.local: ${faltan.join(', ')}`);
  }
  return valores;
}

module.exports = { leerEnvLocal };
