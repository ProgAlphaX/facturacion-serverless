// Arma el comprobante en XML UBL 2.1 (formato oficial SUNAT).
// Factura (01) y boleta (03) usan el mismo documento "Invoice".

const { create } = require('xmlbuilder2');
const { redondear, TASA_IGV } = require('../reglas/reglas-negocio');

const NS = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
};

const monto = (n) => redondear(n).toFixed(2);
const correlativo = (numero) => String(numero).padStart(8, '0');

// Identificador del comprobante: RUC-TIPO-SERIE-NUMERO (también nombre de archivos).
function idComprobante(ruc, c) {
  return `${ruc}-${c.tipo}-${c.serie}-${correlativo(c.numero)}`;
}

// Tributo IGV (catálogo 05: código 1000, VAT).
function agregarTributoIgv(nodo, { base, impuesto, moneda, porLinea }) {
  const sub = nodo.ele('cac:TaxSubtotal');
  sub.ele('cbc:TaxableAmount', { currencyID: moneda }).txt(monto(base));
  sub.ele('cbc:TaxAmount', { currencyID: moneda }).txt(monto(impuesto));
  const categoria = sub.ele('cac:TaxCategory');
  if (porLinea) {
    categoria.ele('cbc:Percent').txt(String(TASA_IGV * 100));
    // Catálogo 07: 10 = gravado, operación onerosa
    categoria.ele('cbc:TaxExemptionReasonCode').txt('10');
  }
  const esquema = categoria.ele('cac:TaxScheme');
  esquema.ele('cbc:ID').txt('1000');
  esquema.ele('cbc:Name').txt('IGV');
  esquema.ele('cbc:TaxTypeCode').txt('VAT');
}

function generarXml(c, emisor) {
  const moneda = c.moneda;
  const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele(NS.invoice, 'Invoice', {
    'xmlns:cac': NS.cac,
    'xmlns:cbc': NS.cbc,
    'xmlns:ext': NS.ext,
    'xmlns:ds': NS.ds,
  });

  // Aquí se insertará la firma digital
  doc.ele('ext:UBLExtensions').ele('ext:UBLExtension').ele('ext:ExtensionContent');

  doc.ele('cbc:UBLVersionID').txt('2.1');
  doc.ele('cbc:CustomizationID').txt('2.0');
  doc.ele('cbc:ID').txt(`${c.serie}-${correlativo(c.numero)}`);
  doc.ele('cbc:IssueDate').txt(c.fechaEmision);
  // Catálogo 51: 0101 = venta interna
  doc.ele('cbc:InvoiceTypeCode', { listID: '0101' }).txt(c.tipo);
  doc.ele('cbc:DocumentCurrencyCode').txt(moneda);

  // Referencia a la firma
  const firma = doc.ele('cac:Signature');
  firma.ele('cbc:ID').txt(emisor.ruc);
  const firmante = firma.ele('cac:SignatoryParty');
  firmante.ele('cac:PartyIdentification').ele('cbc:ID').txt(emisor.ruc);
  firmante.ele('cac:PartyName').ele('cbc:Name').txt(emisor.razonSocial);
  firma.ele('cac:DigitalSignatureAttachment').ele('cac:ExternalReference').ele('cbc:URI').txt('#SignatureSP');

  // Emisor (catálogo 06: 6 = RUC)
  const proveedor = doc.ele('cac:AccountingSupplierParty').ele('cac:Party');
  proveedor.ele('cac:PartyIdentification').ele('cbc:ID', { schemeID: '6' }).txt(emisor.ruc);
  const legalEmisor = proveedor.ele('cac:PartyLegalEntity');
  legalEmisor.ele('cbc:RegistrationName').txt(emisor.razonSocial);
  legalEmisor.ele('cac:RegistrationAddress').ele('cbc:AddressTypeCode').txt('0000');

  // Cliente
  const cliente = doc.ele('cac:AccountingCustomerParty').ele('cac:Party');
  cliente.ele('cac:PartyIdentification').ele('cbc:ID', { schemeID: c.cliente.tipoDoc }).txt(c.cliente.numDoc);
  cliente.ele('cac:PartyLegalEntity').ele('cbc:RegistrationName').txt(c.cliente.nombre);

  // Totales de impuestos
  const totalImpuestos = doc.ele('cac:TaxTotal');
  totalImpuestos.ele('cbc:TaxAmount', { currencyID: moneda }).txt(monto(c.totales.igv));
  agregarTributoIgv(totalImpuestos, { base: c.totales.valorVenta, impuesto: c.totales.igv, moneda });

  // Totales del comprobante
  const totales = doc.ele('cac:LegalMonetaryTotal');
  totales.ele('cbc:LineExtensionAmount', { currencyID: moneda }).txt(monto(c.totales.valorVenta));
  totales.ele('cbc:TaxInclusiveAmount', { currencyID: moneda }).txt(monto(c.totales.total));
  totales.ele('cbc:PayableAmount', { currencyID: moneda }).txt(monto(c.totales.total));

  // Líneas
  c.items.forEach((item, i) => {
    const valorVenta = redondear(item.cantidad * item.valorUnitario);
    const igv = redondear(valorVenta * TASA_IGV);
    const precioConIgv = redondear(item.valorUnitario * (1 + TASA_IGV));

    const linea = doc.ele('cac:InvoiceLine');
    linea.ele('cbc:ID').txt(String(i + 1));
    linea.ele('cbc:InvoicedQuantity', { unitCode: item.unidad }).txt(String(item.cantidad));
    linea.ele('cbc:LineExtensionAmount', { currencyID: moneda }).txt(monto(valorVenta));
    const precio = linea.ele('cac:PricingReference').ele('cac:AlternativeConditionPrice');
    precio.ele('cbc:PriceAmount', { currencyID: moneda }).txt(monto(precioConIgv));
    // Catálogo 16: 01 = precio unitario incluye IGV
    precio.ele('cbc:PriceTypeCode').txt('01');
    const impuestoLinea = linea.ele('cac:TaxTotal');
    impuestoLinea.ele('cbc:TaxAmount', { currencyID: moneda }).txt(monto(igv));
    agregarTributoIgv(impuestoLinea, { base: valorVenta, impuesto: igv, moneda, porLinea: true });
    linea.ele('cac:Item').ele('cbc:Description').txt(item.descripcion);
    linea.ele('cac:Price').ele('cbc:PriceAmount', { currencyID: moneda }).txt(monto(item.valorUnitario));
  });

  return doc.end({ prettyPrint: false });
}

module.exports = { generarXml, idComprobante, correlativo, NS };
