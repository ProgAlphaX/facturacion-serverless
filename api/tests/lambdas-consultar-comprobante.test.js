const { crearHandler } = require('../src/lambdas/consultar-comprobante');

const ID = '20000000001-01-F001-00000001';
const evento = (id) => ({ pathParameters: { id } });

describe('Lambda consultar-comprobante', () => {
  test('devuelve 200 con el comprobante guardado', async () => {
    const handler = crearHandler({ repositorio: () => ({ obtener: async () => ({ id: ID, estado: 'ACEPTADO' }) }) });
    const r = await handler(evento(ID));
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ id: ID, estado: 'ACEPTADO' });
  });

  test('devuelve 404 si no existe', async () => {
    const handler = crearHandler({ repositorio: () => ({ obtener: async () => null }) });
    const r = await handler(evento(ID));
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body).error).toContain(ID);
  });

  test('devuelve 404 si el id no tiene el formato esperado, sin consultar DynamoDB', async () => {
    const obtener = jest.fn();
    const handler = crearHandler({ repositorio: () => ({ obtener }) });
    const r = await handler(evento('abc'));
    expect(r.statusCode).toBe(404);
    expect(obtener).not.toHaveBeenCalled();
  });
});
