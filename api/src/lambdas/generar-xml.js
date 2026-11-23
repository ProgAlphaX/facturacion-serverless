const { generarXml, idComprobante } = require('../sunat/xml-ubl');

exports.handler = async (event) => {
  const emisor = {
    ruc: process.env.EMISOR_RUC,
    razonSocial: process.env.EMISOR_RAZON_SOCIAL,
  };
  const { datos } = event;
  return {
    id: idComprobante(emisor.ruc, datos),
    xml: generarXml(datos, emisor),
  };
};