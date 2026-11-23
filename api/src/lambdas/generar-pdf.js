const { generarPdf } = require('../pdf/representacion-impresa');

exports.handler = async (event) => {
  const emisor = {
    ruc: process.env.EMISOR_RUC,
    razonSocial: process.env.EMISOR_RAZON_SOCIAL,
  };
  const { comprobante, hash } = event;
  const pdf = await generarPdf({ emisor, comprobante, hash });
  return { pdfBase64: pdf.toString('base64') };
};
