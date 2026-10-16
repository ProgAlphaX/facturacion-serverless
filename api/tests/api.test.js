const request = require('supertest');
const { crearApp } = require('../src/app');
const { crearServicioEmision } = require('../src/servicios/emitir-comprobante');
const { crearFirmador } = require('../src/sunat/firma');
const { ErrorSunat } = require('../src/sunat/cliente-soap');
const { generarCertificado } = require('../scripts/generar-certificado');
const { crearRepositorioEnMemoria, crearAlmacenEnMemoria } = require('./ayudas/memoria');
const { crearCdrZip } = require('./ayudas/cdr-falso');

const EMISOR = { ruc: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.' };
const HOY = '2026-10-17';
const firmador = crearFirmador(generarCertificado(EMISOR));

const factura = (cambios = {}) => ({
  tipo: '01',
  serie: 'F001',
  numero: 1,
  fechaEmision: HOY,
  moneda: 'PEN',
  cliente: { tipoDoc: '6', numDoc: '20100070970', nombre: 'CLIENTE DEMO S.A.' },
  items: [{ descripcion: 'Servicio de consultoría', unidad: 'ZZ', cantidad: 2, valorUnitario: 100 }],
  totales: { valorVenta: 200, igv: 36, total: 236 },
  ...cambios,
});

function sunatFalsa(responder = (id) => crearCdrZip({ id })) {
  return {
    recibidos: [],
    async enviar(nombreZip, zip) {
      this.recibidos.push({ nombreZip, zip });
      return responder(nombreZip.replace(/\.zip$/, ''));
    },
  };
}

function preparar(sunat = sunatFalsa()) {
  const repositorio = crearRepositorioEnMemoria();
  const almacen = crearAlmacenEnMemoria();
  const servicio = crearServicioEmision({
    emisor: EMISOR,
    repositorio,
    almacen,
    clienteSunat: sunat,
    firmador,
    hoy: () => HOY,
  });
  return { app: crearApp({ servicio, repositorio }), repositorio, almacen, sunat };
}

describe('API', () => {
  test('GET /health responde ok', async () => {
    const { app } = preparar();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('una ruta inexistente responde 404', async () => {
    const { app } = preparar();
    expect((await request(app).get('/no-existe')).status).toBe(404);
  });

  test('un JSON mal escrito responde 400', async () => {
    const { app } = preparar();
    const res = await request(app).post('/comprobantes').set('Content-Type', 'application/json').send('{"tipo":');
    expect(res.status).toBe(400);
  });
});

describe('POST /comprobantes', () => {
  test('factura válida → 201 ACEPTADO con XML firmado, CDR y PDF guardados', async () => {
    const { app, almacen, repositorio, sunat } = preparar();
    const id = '20000000001-01-F001-00000001';

    const res = await request(app).post('/comprobantes').send(factura());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id, estado: 'ACEPTADO', cdr: { codigo: '0' } });
    expect(res.body.hash).toBeTruthy();
    expect(res.body.archivos).toEqual({
      xml: `firmados/${id}.xml`,
      cdr: `cdr/R-${id}.zip`,
      pdf: `pdf/${id}.pdf`,
    });
    expect(sunat.recibidos[0].nombreZip).toBe(`${id}.zip`);
    expect(firmador.verificar(almacen.archivos.get(`firmados/${id}.xml`))).toBe(true);
    expect(almacen.archivos.get(`pdf/${id}.pdf`).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await repositorio.obtener(id)).estado).toBe('ACEPTADO');
  });

  test('datos que no cumplen reglas → 400 con todos los errores y sin enviar a SUNAT', async () => {
    const { app, sunat } = preparar();
    const res = await request(app)
      .post('/comprobantes')
      .send(factura({ serie: 'B001', totales: { valorVenta: 200, igv: 10, total: 210 } }));

    expect(res.status).toBe(400);
    expect(res.body.errores.map((e) => e.regla)).toEqual(expect.arrayContaining(['R02', 'R10']));
    expect(sunat.recibidos).toHaveLength(0);
  });

  test('campos faltantes → 400 de esquema', async () => {
    const { app } = preparar();
    const res = await request(app).post('/comprobantes').send({ tipo: '01' });
    expect(res.status).toBe(400);
    expect(res.body.errores[0].regla).toBe('ESQUEMA');
  });

  test('mismo número dos veces → 409 (R12)', async () => {
    const { app } = preparar();
    await request(app).post('/comprobantes').send(factura());
    const res = await request(app).post('/comprobantes').send(factura());
    expect(res.status).toBe(409);
    expect(res.body.regla).toBe('R12');
  });

  test('SUNAT rechaza (CDR 2xxx) → 201 RECHAZADO y sin PDF', async () => {
    const sunat = sunatFalsa((id) => crearCdrZip({ id, codigo: '2017', descripcion: 'El RUC del receptor no existe' }));
    const { app } = preparar(sunat);
    const res = await request(app).post('/comprobantes').send(factura());
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('RECHAZADO');
    expect(res.body.archivos.pdf).toBeUndefined();
  });

  test('SUNAT no responde → 502, queda ERROR_ENVIO y se puede reintentar', async () => {
    let caida = true;
    const sunat = sunatFalsa(async (id) => {
      if (caida) throw new ErrorSunat('No se pudo conectar con SUNAT');
      return crearCdrZip({ id });
    });
    const { app, repositorio } = preparar(sunat);

    const primero = await request(app).post('/comprobantes').send(factura());
    expect(primero.status).toBe(502);
    expect((await repositorio.obtener(primero.body.id)).estado).toBe('ERROR_ENVIO');

    caida = false;
    const reintento = await request(app).post('/comprobantes').send(factura());
    expect(reintento.status).toBe(201);
    expect(reintento.body.estado).toBe('ACEPTADO');
  });
});

describe('GET /comprobantes/:id', () => {
  test('devuelve el comprobante emitido', async () => {
    const { app } = preparar();
    await request(app).post('/comprobantes').send(factura());
    const res = await request(app).get('/comprobantes/20000000001-01-F001-00000001');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serie: 'F001', numero: 1, estado: 'ACEPTADO' });
  });

  test('id inexistente o mal formado → 404', async () => {
    const { app } = preparar();
    expect((await request(app).get('/comprobantes/20000000001-01-F001-00000099')).status).toBe(404);
    expect((await request(app).get('/comprobantes/abc')).status).toBe(404);
  });
});
