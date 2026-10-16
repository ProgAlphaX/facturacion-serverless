// Lee la Constancia de Recepción (CDR) que devuelve SUNAT: un ZIP con R-<id>.xml (ApplicationResponse).
// Códigos: 0 = aceptado · 2000–3999 = rechazado · 4000+ = aceptado con observaciones.

const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

const ESTADOS = {
  ACEPTADO: 'ACEPTADO',
  RECHAZADO: 'RECHAZADO',
  ERROR_ENVIO: 'ERROR_ENVIO',
};

function estadoSegunCodigo(codigo) {
  const n = Number(codigo);
  if (n >= 2000 && n <= 3999) return ESTADOS.RECHAZADO;
  if (n === 0 || n >= 4000) return ESTADOS.ACEPTADO;
  return ESTADOS.ERROR_ENVIO;
}

async function leerCdr(zipBuffer) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const archivo = Object.values(zip.files).find((f) => !f.dir && /^R-.*\.xml$/i.test(f.name.split('/').pop()));
  if (!archivo) throw new Error('El CDR no contiene un archivo R-*.xml');

  const xml = await archivo.async('string');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const texto = (nombre) => doc.getElementsByTagNameNS(NS_CBC, nombre)[0]?.textContent.trim() ?? null;

  const codigo = texto('ResponseCode');
  if (codigo === null) throw new Error('El CDR no tiene ResponseCode');

  const observaciones = Array.from(doc.getElementsByTagNameNS(NS_CBC, 'Note')).map((n) => n.textContent.trim());

  return {
    codigo,
    descripcion: texto('Description'),
    observaciones,
    estado: estadoSegunCodigo(codigo),
  };
}

module.exports = { leerCdr, estadoSegunCodigo, ESTADOS };
