const { crearHandler } = require('../src/lambdas/guardar-resultado');
const { crearRepositorioEnMemoria } = require('./ayudas/memoria');

const FACTURA = {
  tipo: '01',
  serie: 'F001',
  numero: 1,
  fechaEmision: '2026-10-17',
  moneda: 'PEN',
  cliente: { tipoDoc: '6', numDoc: '20100070970', nombre: 'CLIENTE DEMO S.A.' },
  items: [{ descripcion: 'Servicio de consultoría', unidad: 'ZZ', cantidad: 2, valorUnitario: 100 }],
  totales: { valorVenta: 200, igv: 36, total: 236 },
};
const ID = '20000000001-01-F001-00000001';

const armar = () => {
  const repositorio = crearRepositorioEnMemoria();
  const handler = crearHandler({ repositorio: () => repositorio, emisorRuc: '20000000001', ahora: () => '2026-10-17T10:00:00Z' });
  return { repositorio, handler };
};

describe('Lambda guardar-resultado', () => {
  test('RESERVAR registra el comprobante como PROCESANDO', async () => {
    const { handler, repositorio } = armar();
    expect(await handler({ accion: 'RESERVAR', datos: FACTURA })).toEqual({ id: ID, reservado: true });
    expect(repositorio.items.get(ID)).toMatchObject({ estado: 'PROCESANDO', serie: 'F001' });
  });

  test('RESERVAR dos veces el mismo comprobante devuelve reservado: false (409)', async () => {
    const { handler } = armar();
    await handler({ accion: 'RESERVAR', datos: FACTURA });
    expect((await handler({ accion: 'RESERVAR', datos: FACTURA })).reservado).toBe(false);
  });

  test('FINALIZAR guarda el estado del CDR, el hash y los archivos', async () => {
    const { handler, repositorio } = armar();
    await handler({ accion: 'RESERVAR', datos: FACTURA });
    const cdr = { codigo: '0', descripcion: 'Aceptada', observaciones: [], estado: 'ACEPTADO' };

    const r = await handler({ accion: 'FINALIZAR', id: ID, cdr, hash: 'abc', archivos: { xml: 'firmados/x.xml' } });

    expect(r).toEqual({ id: ID, estado: 'ACEPTADO' });
    expect(repositorio.items.get(ID)).toMatchObject({
      estado: 'ACEPTADO',
      hash: 'abc',
      cdr: { codigo: '0', descripcion: 'Aceptada', observaciones: [] },
    });
  });

  test('ERROR deja el comprobante en ERROR_ENVIO y permite reintentar con el mismo número', async () => {
    const { handler } = armar();
    await handler({ accion: 'RESERVAR', datos: FACTURA });
    await handler({ accion: 'ERROR', id: ID, error: 'SUNAT no responde' });
    expect((await handler({ accion: 'RESERVAR', datos: FACTURA })).reservado).toBe(true);
  });

  test('una acción desconocida falla', async () => {
    await expect(armar().handler({ accion: 'BORRAR' })).rejects.toThrow('Acción no soportada');
  });
});
