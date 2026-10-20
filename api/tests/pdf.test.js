const { generarPdf, textoQr } = require('../src/pdf/representacion-impresa');

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
const HASH = 'q7Jm0bPZ0x4m2Tq3s2pV3w9hYb0=';

describe('Representación impresa (PDF)', () => {
  test('el QR sigue el formato de SUNAT', () => {
    expect(textoQr({ emisor: EMISOR, comprobante: FACTURA, hash: HASH })).toBe(
      `20000000001|01|F001|00000001|36.00|236.00|2026-10-17|6|20100070970|${HASH}|`,
    );
  });

  test('genera un PDF válido', async () => {
    const pdf = await generarPdf({ emisor: EMISOR, comprobante: FACTURA, hash: HASH });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
