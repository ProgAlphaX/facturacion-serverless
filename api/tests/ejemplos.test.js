const fs = require('node:fs');
const path = require('node:path');
const { validarEsquema } = require('../src/reglas/esquema');
const { validarReglas } = require('../src/reglas/reglas-negocio');

const CARPETA = path.resolve(__dirname, '..', '..', 'ejemplos');
const HOY = '2026-10-16';

const leer = (nombre) => JSON.parse(fs.readFileSync(path.join(CARPETA, `${nombre}.json`), 'utf8'));

function reglasIncumplidas(nombre) {
  const { datos, errores } = validarEsquema(leer(nombre));
  expect(errores).toEqual([]);
  return validarReglas(datos, { emisorRuc: '20000000001', hoy: HOY }).map((e) => e.regla);
}

describe('Ejemplos de comprobantes', () => {
  test.each(['factura-valida', 'boleta-valida'])('%s no tiene errores', (nombre) => {
    expect(reglasIncumplidas(nombre)).toEqual([]);
  });

  test.each([
    ['boleta-mayor-700-sin-dni', 'R08'],
    ['factura-ruc-invalido', 'R07'],
    ['factura-igv-incorrecto', 'R10'],
    ['factura-serie-incorrecta', 'R02'],
  ])('%s incumple %s', (nombre, regla) => {
    expect(reglasIncumplidas(nombre)).toEqual([regla]);
  });
});
