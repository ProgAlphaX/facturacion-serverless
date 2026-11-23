const { generarCertificado } = require('../scripts/generar-certificado');
const { generarXml, idComprobante } = require('../src/sunat/xml-ubl');
const { crearFirmador } = require('../src/sunat/firma');
const { crearHandler } = require('../src/lambdas/firmar');
const { crearAlmacenEnMemoria } = require('./ayudas/memoria');

const EMISOR = { ruc: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.' };
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

test('firma el XML, lo guarda en firmados/ y devuelve el hash', async () => {
  const firmador = crearFirmador(generarCertificado(EMISOR));
  const almacen = crearAlmacenEnMemoria();
  const handler = crearHandler({ obtenerFirmador: async () => firmador, almacen: () => almacen });
  const id = idComprobante(EMISOR.ruc, FACTURA);

  const r = await handler({ id, xml: generarXml(FACTURA, EMISOR) });

  expect(r.id).toBe(id);
  expect(r.xmlKey).toBe(`firmados/${id}.xml`);
  expect(r.hash).toEqual(expect.any(String));
  expect(firmador.verificar(r.xmlFirmado)).toBe(true);
  expect(almacen.archivos.get(`firmados/${id}.xml`)).toBe(r.xmlFirmado);
});
