// Genera src/app/core/config/entorno.generado.ts con los datos NO secretos que el navegador necesita.
// La llave de API y la contraseña no se copian: la llave la agrega el proxy y la contraseña nunca sale de .env.local.
// Con FN_DEMO=1 (npm run start:demo) no hace falta .env.local: la web corre con datos simulados y sin AWS.
const fs = require('node:fs');
const path = require('node:path');
const { leerEnvLocal } = require('./leer-env-local.cjs');

const modoDemo = process.env['FN_DEMO'] === '1';
const env = modoDemo ? { COGNITO_REGION: 'us-east-1', COGNITO_CLIENT_ID: 'demo' } : leerEnvLocal();
const destino = path.join(__dirname, '..', 'src', 'app', 'core', 'config', 'entorno.generado.ts');

const contenido = `// Archivo generado por \`npm run entorno\`. No editar ni subir a git.
import type { Entorno } from './entorno';

export const ENTORNO_GENERADO: Entorno = {
  apiBase: '/api',
  cognitoRegion: ${JSON.stringify(env['COGNITO_REGION'])},
  cognitoClienteId: ${JSON.stringify(env['COGNITO_CLIENT_ID'])},
  modoDemo: ${modoDemo},
};
`;

fs.writeFileSync(destino, contenido);
console.log('Entorno generado:', path.relative(process.cwd(), destino), modoDemo ? '(modo demo)' : '');
