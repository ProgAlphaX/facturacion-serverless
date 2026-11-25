const { crearHandler } = require('../src/lambdas/descargar-archivo');
const { crearAlmacen } = require('../src/almacenamiento/s3');
const { S3Client } = require('@aws-sdk/client-s3');

const ID = '20000000001-01-F001-00000001';
const COMPROBANTE = {
  id: ID,
  estado: 'ACEPTADO',
  archivos: { xml: `firmados/${ID}.xml`, cdr: `cdr/R-${ID}.zip`, pdf: `pdf/${ID}.pdf` },
};
const evento = (id, tipo) => ({ pathParameters: { id, tipo } });

function preparar(comprobante = COMPROBANTE) {
  const urlDescarga = jest.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/firmado?firma=abc');
  const obtener = jest.fn().mockResolvedValue(comprobante);
  const handler = crearHandler({ repositorio: () => ({ obtener }), almacen: () => ({ urlDescarga }) });
  return { urlDescarga, obtener, handler };
}

describe('Lambda descargar-archivo', () => {
  test.each([
    ['xml', `firmados/${ID}.xml`, `${ID}.xml`],
    ['cdr', `cdr/R-${ID}.zip`, `${ID}.zip`],
    ['pdf', `pdf/${ID}.pdf`, `${ID}.pdf`],
  ])('devuelve una URL temporal para %s usando la clave guardada en DynamoDB', async (tipo, clave, nombre) => {
    const { urlDescarga, handler } = preparar();
    const r = await handler(evento(ID, tipo));
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ url: 'https://bucket.s3.amazonaws.com/firmado?firma=abc', nombre, expiraEnSegundos: 300 });
    expect(urlDescarga).toHaveBeenCalledWith(clave, { nombre, segundos: 300 });
  });

  test('un tipo desconocido da 400 sin consultar nada', async () => {
    const { obtener, urlDescarga, handler } = preparar();
    for (const tipo of ['exe', '../secreto', 'constructor', undefined]) {
      const r = await handler(evento(ID, tipo));
      expect(r.statusCode).toBe(400);
    }
    expect(obtener).not.toHaveBeenCalled();
    expect(urlDescarga).not.toHaveBeenCalled();
  });

  test('un id mal formado da 404 sin consultar DynamoDB', async () => {
    const { obtener, handler } = preparar();
    const r = await handler(evento('../../otro-bucket', 'xml'));
    expect(r.statusCode).toBe(404);
    expect(obtener).not.toHaveBeenCalled();
  });

  test('un comprobante inexistente da 404', async () => {
    const { handler } = preparar(null);
    const r = await handler(evento(ID, 'xml'));
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body).error).toContain(ID);
  });

  test('si el archivo aún no existe (PDF pendiente o rechazado) da 404 y no firma nada', async () => {
    const { urlDescarga, handler } = preparar({ id: ID, estado: 'RECHAZADO', archivos: { xml: 'a', cdr: 'b' } });
    const r = await handler(evento(ID, 'pdf'));
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body).error).toContain('pdf');
    expect(urlDescarga).not.toHaveBeenCalled();
  });

  test('un comprobante sin campo archivos tampoco rompe', async () => {
    const { handler } = preparar({ id: ID, estado: 'ERROR_ENVIO' });
    expect((await handler(evento(ID, 'xml'))).statusCode).toBe(404);
  });
});

describe('almacen.urlDescarga', () => {
  test('firma una URL GET del objeto con vencimiento y nombre de descarga', async () => {
    const cliente = new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'AKIAEJEMPLO', secretAccessKey: 'secreto-de-prueba' } });
    const almacen = crearAlmacen({ bucket: 'bucket-de-prueba', cliente });

    const url = new URL(await almacen.urlDescarga('pdf/x.pdf', { nombre: 'x.pdf', segundos: 300 }));

    expect(url.hostname).toContain('bucket-de-prueba');
    expect(url.pathname).toBe('/pdf/x.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="x.pdf"');
  });
});
