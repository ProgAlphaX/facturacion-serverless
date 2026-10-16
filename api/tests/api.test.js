const request = require('supertest');
const { crearApp } = require('../src/app');

describe('API', () => {
  const app = crearApp();

  test('GET /health responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('una ruta inexistente responde 404', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
  });
});
