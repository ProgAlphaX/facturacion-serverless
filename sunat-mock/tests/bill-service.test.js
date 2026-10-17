const request = require('supertest');
const { crearApp } = require('../src/app');
const { cargarConfig } = require('../src/config');
const { sobreSendBill } = require('./ayudas/sobre');

const app = crearApp(cargarConfig({}));
const ID = '20000000001-01-F001-00000001';

const enviar = (sobre) => request(app).post('/billService').set('Content-Type', 'text/xml').send(sobre);
const codigoFalla = (res) => res.text.match(/Client\.(\d{4})/)?.[1];

describe('SUNAT simulada', () => {
  test('GET /health responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('un cuerpo que no es SOAP → falla 0200', async () => {
    const res = await enviar('<hola/>');
    expect(res.status).toBe(500);
    expect(codigoFalla(res)).toBe('0200');
  });

  test.each([
    ['clave incorrecta', { clave: 'otra' }],
    ['usuario SOL incorrecto', { usuario: '20000000001OTRO' }],
    ['usuario sin RUC', { usuario: 'MODDATOS' }],
  ])('%s → falla 0102', async (_, datos) => {
    const res = await enviar(sobreSendBill({ nombreArchivo: `${ID}.zip`, ...datos }));
    expect(res.status).toBe(500);
    expect(codigoFalla(res)).toBe('0102');
    expect(res.text).toContain('Usuario o contraseña incorrectos');
  });
});
