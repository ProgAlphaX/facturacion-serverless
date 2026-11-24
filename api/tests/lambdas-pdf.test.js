const generarPdf = require('../src/lambdas/generar-pdf');

process.env.EMISOR_RUC = '20000000001';
process.env.EMISOR_RAZON_SOCIAL = 'EMPRESA DEMO S.A.C.';

const COMPROBANTE = {
  tipo: '01',
  serie: 'F001',
  numero: 1,
  fechaEmision: '2026-10-17',
  moneda: 'PEN',
  cliente: { tipoDoc: '6', numDoc: '20100070970', nombre: 'CLIENTE DEMO S.A.' },
  items: [{ descripcion: 'Servicio de consultoría', unidad: 'ZZ', cantidad: 2, valorUnitario: 100 }],
  totales: { valorVenta: 200, igv: 36, total: 236 },
};

test('devuelve un PDF en base64', async () => {
  const r = await generarPdf.handler({ comprobante: COMPROBANTE, hash: 'q7Jm0bPZ0x4m2Tq3s2pV3w9hYb0=' });
  const pdf = Buffer.from(r.pdfBase64, 'base64');
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
});
