const { crearHandler } = require('../src/lambdas/listar-comprobantes');

const PAGINA = { comprobantes: [], total: 0, siguiente: null, resumen: { PROCESANDO: 0, ACEPTADO: 0, RECHAZADO: 0, ERROR_ENVIO: 0 } };

function preparar() {
  const listar = jest.fn().mockResolvedValue(PAGINA);
  const handler = crearHandler({ repositorio: () => ({ listar }), ruc: () => '20000000001' });
  return { listar, handler };
}
const evento = (queryStringParameters) => ({ queryStringParameters });

describe('Lambda listar-comprobantes', () => {
  test('sin parámetros lista con el límite por defecto del emisor configurado', async () => {
    const { listar, handler } = preparar();
    const r = await handler(evento(null));
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual(PAGINA);
    expect(listar).toHaveBeenCalledWith({ ruc: '20000000001', estado: undefined, limite: 50, desde: 0 });
  });

  test('pasa estado, limite y desde al repositorio', async () => {
    const { listar, handler } = preparar();
    await handler(evento({ estado: 'RECHAZADO', limite: '10', desde: '20' }));
    expect(listar).toHaveBeenCalledWith({ ruc: '20000000001', estado: 'RECHAZADO', limite: 10, desde: 20 });
  });

  test.each([
    [{ estado: 'INVENTADO' }, 'estado'],
    [{ limite: '0' }, 'límite'],
    [{ limite: '101' }, 'límite'],
    [{ limite: 'abc' }, 'límite'],
    [{ limite: '-5' }, 'límite'],
    [{ desde: '-1' }, 'desde'],
    [{ desde: '1.5' }, 'desde'],
  ])('rechaza %j con 400 sin consultar DynamoDB', async (parametros, palabra) => {
    const { listar, handler } = preparar();
    const r = await handler(evento(parametros));
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).error).toContain(palabra);
    expect(listar).not.toHaveBeenCalled();
  });

  test('un estado vacío cuenta como "sin filtro"', async () => {
    const { listar, handler } = preparar();
    await handler(evento({ estado: '' }));
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ estado: undefined }));
  });
});
