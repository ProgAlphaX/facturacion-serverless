// npm run start:demo → web con datos simulados: no necesita AWS, .env.local ni la pila desplegada.
const { spawn } = require('node:child_process');

process.env['FN_DEMO'] = '1';
require('./generar-entorno.cjs');

const servidor = spawn('npx', ['ng', 'serve'], { stdio: 'inherit', shell: true, env: process.env });
servidor.on('exit', (codigo) => {
  process.exit(codigo ?? 0);
});
