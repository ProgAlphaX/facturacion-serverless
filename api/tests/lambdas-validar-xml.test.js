const fs = require('node:fs');
const path = require('node:path');
const validar = require('../src/lambdas/validar');
const generarXml = require('../src/lambdas/generar-xml');

process.env.EMISOR_RUC = '20000000001';
process.env.EMISOR_RAZON_SOCIAL = 'EMPRESA DEMO S.A.C.';

const leer = (nombre) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'ejemplos', `${nombre}.json`), 'utf8'));

describe('Lambda validar', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-10-16T12:00:00-05:00') });
  });
  afterAll(() => jest.useRealTimers());

  test('una factura válida pasa', async () => {
    const r = await validar.handler(leer('factura-valida'));
    expect(r.valido).toBe(true);
    expect(r.datos.serie).toBe('F001');
  });

  test('una factura con IGV incorrecto no pasa', async () => {
    const r = await validar.handler(leer('factura-igv-incorrecto'));
    expect(r.valido).toBe(false);
    expect(r.errores[0].regla).toBe('R10');
  });
});

describe('Lambda generar-xml', () => {
  test('devuelve el id y un XML', async () => {
    const r = await generarXml.handler({ datos: leer('factura-valida') });
    expect(r.id).toBe('20000000001-01-F001-00000001');
    expect(r.xml).toContain('<cbc:ID>F001-00000001</cbc:ID>');
  });
});