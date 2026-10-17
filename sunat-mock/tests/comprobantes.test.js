const request = require('supertest');
const JSZip = require('jszip');
const { crearApp } = require('../src/app');
const { cargarConfig } = require('../src/config');
const { sobreSendBill } = require('./ayudas/sobre');
const { certificadoDePrueba, xmlComprobante, firmar, zipBase64 } = require('./ayudas/comprobante');

const ID = '20000000001-01-F001-00000001';
const certificado = certificadoDePrueba();

const codigoFalla = (res) => res.text.match(/Client\.(\d{4})/)?.[1];

async function leerCdr(res) {
  const base64 = res.text.match(/<applicationResponse>([^<]+)<\/applicationResponse>/)[1];
  const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
  const nombre = Object.keys(zip.files)[0];
  const xml = await zip.file(nombre).async('string');
  return {
    nombre,
    xml,
    codigo: xml.match(/<cbc:ResponseCode>(\d+)<\/cbc:ResponseCode>/)[1],
    descripcion: xml.match(/<cbc:Description>([^<]+)<\/cbc:Description>/)[1],
  };
}

async function enviar({ app = crearApp(cargarConfig({})), id = ID, xml, nombreArchivo = `${id}.zip`, nombreXml = `${id}.xml`, ...otros }) {
  const contenido = await zipBase64(nombreXml, xml);
  return request(app)
    .post('/billService')
    .set('Content-Type', 'text/xml')
    .send(sobreSendBill({ nombreArchivo, contenido, ...otros }));
}

describe('Evaluación de comprobantes', () => {
  test('comprobante firmado correctamente → CDR 0 (aceptado)', async () => {
    const res = await enviar({ xml: firmar(xmlComprobante({}), certificado) });
    expect(res.status).toBe(200);
    const cdr = await leerCdr(res);
    expect(cdr.nombre).toBe(`R-${ID}.xml`);
    expect(cdr.codigo).toBe('0');
    expect(cdr.descripcion).toBe('La Factura numero F001-00000001, ha sido aceptada');
    expect(cdr.xml).toContain('<cbc:ReferenceID>F001-00000001</cbc:ReferenceID>');
  });

  test('XML modificado después de firmar → CDR 2335 (rechazado)', async () => {
    const alterado = firmar(xmlComprobante({}), certificado).replace('>236.00<', '>999.00<');
    const cdr = await leerCdr(await enviar({ xml: alterado }));
    expect(cdr.codigo).toBe('2335');
  });

  test('XML sin firma → CDR 2335', async () => {
    const cdr = await leerCdr(await enviar({ xml: xmlComprobante({}) }));
    expect(cdr.codigo).toBe('2335');
  });

  test('factura a un RUC inactivo en el padrón → CDR 2017 (rechazado)', async () => {
    const xml = firmar(xmlComprobante({ clienteNumDoc: '20123456786' }), certificado);
    const cdr = await leerCdr(await enviar({ xml }));
    expect(cdr.codigo).toBe('2017');
    expect(cdr.descripcion).toContain('20123456786');
  });

  test('reenviar un comprobante aceptado devuelve el mismo CDR', async () => {
    const app = crearApp(cargarConfig({}));
    const xml = firmar(xmlComprobante({}), certificado);
    const primero = await leerCdr(await enviar({ app, xml }));
    const segundo = await leerCdr(await enviar({ app, xml }));
    expect(segundo.xml).toBe(primero.xml);
  });
});

describe('Validación del archivo', () => {
  test('nombre del ZIP con formato incorrecto → falla 0151', async () => {
    const res = await enviar({ xml: '<a/>', nombreArchivo: 'factura.zip' });
    expect(codigoFalla(res)).toBe('0151');
  });

  test('ZIP de otro RUC distinto al usuario → falla 0154', async () => {
    const id = '20100070970-01-F001-00000001';
    const res = await enviar({ id, xml: '<a/>' });
    expect(codigoFalla(res)).toBe('0154');
  });

  test('contenido que no es ZIP → falla 0155', async () => {
    const res = await request(crearApp(cargarConfig({})))
      .post('/billService')
      .set('Content-Type', 'text/xml')
      .send(sobreSendBill({ nombreArchivo: `${ID}.zip`, contenido: Buffer.from('no es zip').toString('base64') }));
    expect(codigoFalla(res)).toBe('0155');
  });

  test('ZIP sin el XML esperado → falla 0161', async () => {
    const res = await enviar({ xml: '<a/>', nombreXml: 'otro.xml' });
    expect(codigoFalla(res)).toBe('0161');
  });
});
