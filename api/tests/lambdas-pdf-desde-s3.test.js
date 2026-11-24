const { crearHandler } = require('../src/lambdas/pdf-desde-s3');
const factura = require('../../ejemplos/factura-valida.json');

const ID = '20000000001-01-F001-00000001';
const evento = (clave) => ({ Records: [{ s3: { object: { key: clave } } }] });
const emisor = () => ({ ruc: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.' });

function armar(estados) {
  const guardados = [];
  const actualizaciones = [];
  const lecturas = [...estados];
  const handler = crearHandler({
    repositorio: () => ({
      obtener: async () => ({ ...factura, id: ID, estado: lecturas.length > 1 ? lecturas.shift() : lecturas[0], hash: 'abc=', archivos: { xml: `firmados/${ID}.xml` } }),
      actualizar: async (id, campos) => actualizaciones.push({ id, campos }),
    }),
    almacen: () => ({ guardar: async (clave, contenido) => { guardados.push({ clave, contenido }); return clave; } }),
    emisor,
    esperar: async () => {},
  });
  return { handler, guardados, actualizaciones };
}

describe('Lambda pdf-desde-s3', () => {
  test('comprobante ACEPTADO: guarda pdf/<id>.pdf y lo registra en archivos', async () => {
    const { handler, guardados, actualizaciones } = armar(['ACEPTADO']);
    const r = await handler(evento(`cdr/R-${ID}.zip`));
    expect(r).toEqual([{ id: ID, pdf: `pdf/${ID}.pdf` }]);
    expect(guardados[0].clave).toBe(`pdf/${ID}.pdf`);
    expect(guardados[0].contenido.subarray(0, 4).toString()).toBe('%PDF');
    expect(actualizaciones[0].campos.archivos).toEqual({ xml: `firmados/${ID}.xml`, pdf: `pdf/${ID}.pdf` });
  });

  test('comprobante RECHAZADO: no genera PDF', async () => {
    const { handler, guardados } = armar(['RECHAZADO']);
    const r = await handler(evento(`cdr/R-${ID}.zip`));
    expect(r).toEqual([{ id: ID, pdf: null, motivo: 'RECHAZADO' }]);
    expect(guardados).toHaveLength(0);
  });

  test('si aún está PROCESANDO espera y genera el PDF cuando pasa a ACEPTADO', async () => {
    const { handler, guardados } = armar(['PROCESANDO', 'PROCESANDO', 'ACEPTADO']);
    await handler(evento(`cdr/R-${ID}.zip`));
    expect(guardados).toHaveLength(1);
  });

  test('si sigue PROCESANDO tras los intentos lanza error para que S3 reintente', async () => {
    const { handler, guardados } = armar(['PROCESANDO']);
    await expect(handler(evento(`cdr/R-${ID}.zip`))).rejects.toThrow('PROCESANDO');
    expect(guardados).toHaveLength(0);
  });

  test('ignora objetos que no son un CDR', async () => {
    const { handler, guardados } = armar(['ACEPTADO']);
    expect(await handler(evento(`pdf/${ID}.pdf`))).toEqual([]);
    expect(guardados).toHaveLength(0);
  });
});
