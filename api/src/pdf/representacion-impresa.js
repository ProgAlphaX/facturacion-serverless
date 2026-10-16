// Genera la representación impresa (PDF) del comprobante aceptado, con el hash de la firma
// y el código QR en el formato de SUNAT:
// RUC|TIPO|SERIE|NÚMERO|IGV|TOTAL|FECHA|TIPO DOC CLIENTE|NÚM DOC CLIENTE|HASH|

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { correlativo } = require('../sunat/xml-ubl');

const NOMBRES_TIPO = { '01': 'FACTURA ELECTRÓNICA', '03': 'BOLETA DE VENTA ELECTRÓNICA' };
const SIMBOLOS = { PEN: 'S/', USD: 'US$' };

function textoQr({ emisor, comprobante: c, hash }) {
  return [
    emisor.ruc,
    c.tipo,
    c.serie,
    correlativo(c.numero),
    c.totales.igv.toFixed(2),
    c.totales.total.toFixed(2),
    c.fechaEmision,
    c.cliente.tipoDoc,
    c.cliente.numDoc,
    hash,
  ].join('|').concat('|');
}

async function generarPdf({ emisor, comprobante: c, hash }) {
  const qr = await QRCode.toBuffer(textoQr({ emisor, comprobante: c, hash }), {
    errorCorrectionLevel: 'Q',
    margin: 1,
    width: 130,
  });
  const nombreTipo = NOMBRES_TIPO[c.tipo];
  const simbolo = SIMBOLOS[c.moneda] || c.moneda;
  const dinero = (n) => `${simbolo} ${n.toFixed(2)}`;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: { Title: `${nombreTipo} ${c.serie}-${correlativo(c.numero)}`, Author: emisor.razonSocial },
  });
  const partes = [];
  doc.on('data', (parte) => partes.push(parte));
  const terminado = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  // Encabezado: emisor (izquierda) y recuadro del comprobante (derecha)
  doc.font('Helvetica-Bold').fontSize(14).text(emisor.razonSocial, 40, 50, { width: 300 });
  doc.font('Helvetica').fontSize(9).text(`RUC: ${emisor.ruc}`, 40, doc.y + 4);

  doc.rect(360, 40, 195, 62).stroke();
  doc.font('Helvetica-Bold').fontSize(11)
    .text(`RUC ${emisor.ruc}`, 360, 52, { width: 195, align: 'center' })
    .text(nombreTipo, { width: 195, align: 'center' })
    .text(`${c.serie}-${correlativo(c.numero)}`, { width: 195, align: 'center' });

  // Datos del cliente
  doc.font('Helvetica').fontSize(9);
  const tipoDocCliente = { 6: 'RUC', 1: 'DNI' }[c.cliente.tipoDoc] || 'DOC';
  doc.text(`Fecha de emisión: ${c.fechaEmision}`, 40, 140);
  doc.text(`Cliente: ${c.cliente.nombre}`);
  doc.text(`${tipoDocCliente}: ${c.cliente.numDoc}`);
  doc.text(`Moneda: ${c.moneda}`);

  // Tabla de ítems
  const columnas = [
    { titulo: 'Cant.', x: 40, ancho: 40 },
    { titulo: 'Unid.', x: 80, ancho: 40 },
    { titulo: 'Descripción', x: 120, ancho: 255 },
    { titulo: 'V. unitario', x: 375, ancho: 85, alinear: 'right' },
    { titulo: 'V. venta', x: 460, ancho: 95, alinear: 'right' },
  ];
  let y = 215;
  doc.font('Helvetica-Bold');
  columnas.forEach((col) => doc.text(col.titulo, col.x, y, { width: col.ancho, align: col.alinear || 'left' }));
  doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke();
  y += 20;

  doc.font('Helvetica');
  c.items.forEach((item) => {
    const valores = [
      String(item.cantidad),
      item.unidad,
      item.descripcion,
      item.valorUnitario.toFixed(2),
      (item.cantidad * item.valorUnitario).toFixed(2),
    ];
    const alto = doc.heightOfString(item.descripcion, { width: 255 });
    columnas.forEach((col, i) => doc.text(valores[i], col.x, y, { width: col.ancho, align: col.alinear || 'left' }));
    y += Math.max(alto, 12) + 4;
  });
  doc.moveTo(40, y).lineTo(555, y).stroke();

  // Totales
  y += 10;
  const filaTotal = (etiqueta, valor, negrita = false) => {
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(etiqueta, 360, y, { width: 100, align: 'right' });
    doc.text(dinero(valor), 460, y, { width: 95, align: 'right' });
    y += 15;
  };
  filaTotal('Op. gravada:', c.totales.valorVenta);
  filaTotal('IGV (18%):', c.totales.igv);
  filaTotal('Importe total:', c.totales.total, true);

  // Pie: QR, hash y leyenda
  y += 20;
  doc.image(qr, 40, y, { width: 110 });
  doc.font('Helvetica').fontSize(8)
    .text(`Representación impresa de la ${nombreTipo}`, 165, y + 10, { width: 390 })
    .text(`Valor resumen (hash): ${hash}`, { width: 390 })
    .text('Documento firmado digitalmente y aceptado por la entidad tributaria (CDR).', { width: 390 });

  doc.end();
  return terminado;
}

module.exports = { generarPdf, textoQr };
