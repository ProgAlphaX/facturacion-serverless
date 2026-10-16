const { DOMParser } = require('@xmldom/xmldom');
const { generarCertificado } = require('../scripts/generar-certificado');
const { generarXml, idComprobante, NS } = require('../src/sunat/xml-ubl');
const { crearFirmador } = require('../src/sunat/firma');

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

const texto = (xml, ns, nombre) =>
  new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagNameNS(ns, nombre)[0]?.textContent;

describe('XML UBL 2.1', () => {
  const xml = generarXml(FACTURA, EMISOR);

  test('tiene los datos principales del comprobante', () => {
    expect(texto(xml, NS.cbc, 'UBLVersionID')).toBe('2.1');
    expect(texto(xml, NS.cbc, 'ID')).toBe('F001-00000001');
    expect(texto(xml, NS.cbc, 'InvoiceTypeCode')).toBe('01');
    expect(texto(xml, NS.cbc, 'PayableAmount')).toBe('236.00');
  });

  test('el identificador sigue el formato RUC-TIPO-SERIE-NUMERO', () => {
    expect(idComprobante(EMISOR.ruc, FACTURA)).toBe('20000000001-01-F001-00000001');
  });
});

describe('Firma digital', () => {
  const firmador = crearFirmador(generarCertificado(EMISOR));
  const { xmlFirmado, hash } = firmador.firmar(generarXml(FACTURA, EMISOR));

  test('la firma queda dentro de ExtensionContent y devuelve el hash', () => {
    expect(xmlFirmado).toMatch(/<ext:ExtensionContent><ds:Signature[^>]*Id="SignatureSP"/);
    expect(xmlFirmado).toContain('<ds:X509Certificate>');
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test('un XML firmado sin cambios se verifica correctamente', () => {
    expect(firmador.verificar(xmlFirmado)).toBe(true);
  });

  test('si se cambia un monto, la firma deja de ser válida', () => {
    const alterado = xmlFirmado.replace('>236.00<', '>999.00<');
    expect(alterado).not.toBe(xmlFirmado);
    expect(firmador.verificar(alterado)).toBe(false);
  });

  test('otro certificado no puede validar la firma', () => {
    const otro = crearFirmador(generarCertificado({ ruc: '20100070970', razonSocial: 'OTRA' }));
    expect(otro.verificar(xmlFirmado)).toBe(false);
  });
});
