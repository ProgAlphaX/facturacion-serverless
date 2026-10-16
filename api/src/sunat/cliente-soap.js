// Igual que el servicio real de SUNAT: XML en ZIP, Base64 y usuario RUC+SOL por WS-Security.

const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

const TIEMPO_MAXIMO_MS = 15000;

class ErrorSunat extends Error {
  constructor(mensaje, codigo = null) {
    super(mensaje);
    this.name = 'ErrorSunat';
    this.codigo = codigo;
  }
}

async function comprimir(nombreArchivo, contenido) {
  const zip = new JSZip();
  zip.file(nombreArchivo, contenido);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const escaparXml = (texto) =>
  String(texto).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]);

function construirSobre({ usuario, clave, nombreZip, zipBase64 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${escaparXml(usuario)}</wsse:Username>
        <wsse:Password>${escaparXml(clave)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${escaparXml(nombreZip)}</fileName>
      <contentFile>${zipBase64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;
}

const primerTexto = (doc, nombreLocal) => {
  const nodos = doc.getElementsByTagName('*');
  for (let i = 0; i < nodos.length; i += 1) {
    if (nodos[i].localName === nombreLocal) return nodos[i].textContent.trim();
  }
  return null;
};

// Ej.: "soap-env:Client.2033" → "2033"
const codigoDeFalla = (faultcode) => (faultcode && faultcode.match(/(\d{4})$/)?.[1]) || null;

function crearClienteSunat({ url, ruc, usuario, clave, fetch = globalThis.fetch }) {
  async function enviar(nombreZip, zipBuffer) {
    const sobre = construirSobre({
      usuario: `${ruc}${usuario}`,
      clave,
      nombreZip,
      zipBase64: zipBuffer.toString('base64'),
    });

    let respuesta;
    try {
      respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'urn:sendBill' },
        body: sobre,
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch (err) {
      throw new ErrorSunat(`No se pudo conectar con SUNAT: ${err.message}`);
    }

    const cuerpo = await respuesta.text();
    const doc = new DOMParser().parseFromString(cuerpo, 'text/xml');

    const faultcode = primerTexto(doc, 'faultcode');
    if (faultcode) {
      throw new ErrorSunat(primerTexto(doc, 'faultstring') || 'Falla SOAP', codigoDeFalla(faultcode));
    }

    const cdrBase64 = primerTexto(doc, 'applicationResponse');
    if (!respuesta.ok || !cdrBase64) {
      throw new ErrorSunat(`Respuesta inesperada de SUNAT (HTTP ${respuesta.status})`);
    }
    return Buffer.from(cdrBase64, 'base64');
  }

  return { enviar };
}

module.exports = { crearClienteSunat, comprimir, construirSobre, ErrorSunat };
