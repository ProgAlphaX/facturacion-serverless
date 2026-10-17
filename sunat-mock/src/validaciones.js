const JSZip = require('jszip');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { FallaSoap } = require('./soap');

const NOMBRE_ARCHIVO = /^(\d{11})-(01|03)-([FB][A-Z0-9]{3})-(\d{1,8})\.zip$/;
const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';
const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

const TIPOS = { '01': 'Factura', '03': 'Boleta' };

function validarNombre(nombreArchivo, rucUsuario) {
  const partes = NOMBRE_ARCHIVO.exec(nombreArchivo || '');
  if (!partes) {
    throw new FallaSoap('0151', 'El nombre del archivo ZIP es incorrecto');
  }
  if (partes[1] !== rucUsuario) {
    throw new FallaSoap('0154', 'El RUC del archivo no corresponde al RUC del usuario');
  }
  return { id: nombreArchivo.replace(/\.zip$/, ''), ruc: partes[1], tipo: partes[2] };
}

async function extraerXml(contenidoBase64, id) {
  let zip;
  try {
    zip = await JSZip.loadAsync(Buffer.from(contenidoBase64 || '', 'base64'));
  } catch {
    throw new FallaSoap('0155', 'El archivo ZIP está vacío o dañado');
  }
  const archivo = zip.file(`${id}.xml`);
  if (!archivo) {
    throw new FallaSoap('0161', `El ZIP no contiene el archivo ${id}.xml`);
  }
  return archivo.async('string');
}

const comoPem = (base64) =>
  `-----BEGIN CERTIFICATE-----\n${base64.replace(/\s+/g, '').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;

// La SUNAT real valida contra el certificado registrado por el emisor;
// aquí se usa el certificado que viene dentro de la firma (KeyInfo).
function firmaValida(xml) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const firma = doc.getElementsByTagNameNS(NS_DS, 'Signature')[0];
    const certificado = doc.getElementsByTagNameNS(NS_DS, 'X509Certificate')[0];
    if (!firma || !certificado) return false;
    const verificador = new SignedXml({ publicCert: comoPem(certificado.textContent) });
    verificador.loadSignature(firma);
    return verificador.checkSignature(xml);
  } catch {
    return false;
  }
}

function documentoCliente(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const cliente = doc.getElementsByTagNameNS(NS_CAC, 'AccountingCustomerParty')[0];
  const id = cliente && cliente.getElementsByTagNameNS(NS_CBC, 'ID')[0];
  return id ? { tipoDoc: id.getAttribute('schemeID'), numDoc: id.textContent.trim() } : null;
}

async function evaluarComprobante({ rucUsuario, nombreArchivo, contenido }, { rucsInactivos }) {
  const { id, ruc, tipo } = validarNombre(nombreArchivo, rucUsuario);
  const xml = await extraerXml(contenido, id);
  const [, , serie, numero] = id.split('-');

  if (!firmaValida(xml)) {
    return { id, ruc, codigo: '2335', descripcion: 'El documento electrónico ingresado ha sido alterado' };
  }

  const cliente = documentoCliente(xml);
  if (cliente && cliente.tipoDoc === '6' && rucsInactivos.includes(cliente.numDoc)) {
    return {
      id,
      ruc,
      codigo: '2017',
      descripcion: `El RUC del receptor ${cliente.numDoc} no está activo en el padrón (simulado)`,
    };
  }

  return { id, ruc, codigo: '0', descripcion: `La ${TIPOS[tipo]} numero ${serie}-${numero}, ha sido aceptada` };
}

module.exports = { evaluarComprobante, firmaValida };
