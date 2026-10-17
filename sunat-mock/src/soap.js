const { DOMParser } = require('@xmldom/xmldom');

class FallaSoap extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'FallaSoap';
    this.codigo = codigo;
  }
}

function textoPorNombre(doc, nombreLocal) {
  const nodos = doc.getElementsByTagName('*');
  for (let i = 0; i < nodos.length; i += 1) {
    if (nodos[i].localName === nombreLocal) return nodos[i].textContent.trim();
  }
  return null;
}

function operacionDe(doc) {
  const nodos = doc.getElementsByTagName('*');
  for (let i = 0; i < nodos.length; i += 1) {
    if (nodos[i].localName === 'Body') {
      const hijo = Array.from(nodos[i].childNodes).find((n) => n.nodeType === 1);
      return hijo ? hijo.localName : null;
    }
  }
  return null;
}

function leerSobre(xml) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(xml || '', 'text/xml');
  } catch {
    doc = null;
  }
  if (!doc || !doc.documentElement || doc.documentElement.localName !== 'Envelope') {
    throw new FallaSoap('0200', 'El mensaje no es un sobre SOAP válido');
  }
  return {
    operacion: operacionDe(doc),
    usuario: textoPorNombre(doc, 'Username'),
    clave: textoPorNombre(doc, 'Password'),
    nombreArchivo: textoPorNombre(doc, 'fileName'),
    contenido: textoPorNombre(doc, 'contentFile'),
  };
}

function respuestaSendBill(cdrZip) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Body>
    <br:sendBillResponse xmlns:br="http://service.sunat.gob.pe">
      <applicationResponse>${cdrZip.toString('base64')}</applicationResponse>
    </br:sendBillResponse>
  </soap-env:Body>
</soap-env:Envelope>`;
}

const escaparXml = (texto) =>
  String(texto).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]);

function respuestaFalla({ codigo, mensaje }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Body>
    <soap-env:Fault>
      <faultcode>soap-env:Client.${codigo}</faultcode>
      <faultstring>${escaparXml(mensaje)}</faultstring>
    </soap-env:Fault>
  </soap-env:Body>
</soap-env:Envelope>`;
}

module.exports = { leerSobre, respuestaSendBill, respuestaFalla, FallaSoap };
