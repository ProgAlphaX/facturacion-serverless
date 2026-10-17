const crypto = require('node:crypto');
const forge = require('node-forge');
const JSZip = require('jszip');
const { SignedXml } = require('xml-crypto');

function certificadoDePrueba() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const sujeto = [{ name: 'commonName', value: 'EMPRESA DEMO S.A.C.' }];
  cert.setSubject(sujeto);
  cert.setIssuer(sujeto);
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());
  return { certPem: forge.pki.certificateToPem(cert), keyPem: privateKey };
}

function xmlComprobante({ serie = 'F001', numero = '00000001', clienteTipoDoc = '6', clienteNumDoc = '20100070970', total = '236.00' }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:ID>${serie}-${numero}</cbc:ID><cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="6">20000000001</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="${clienteTipoDoc}">${clienteNumDoc}</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingCustomerParty><cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="PEN">${total}</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>`;
}

function firmar(xml, { certPem, keyPem }) {
  const firma = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  firma.addReference({
    xpath: '/*',
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    isEmptyUri: true,
  });
  firma.computeSignature(xml, {
    prefix: 'ds',
    attrs: { Id: 'SignatureSP' },
    location: { reference: "//*[local-name()='ExtensionContent']", action: 'append' },
  });
  return firma.getSignedXml();
}

async function zipBase64(nombre, contenido) {
  const zip = new JSZip();
  zip.file(nombre, contenido);
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');
}

module.exports = { certificadoDePrueba, xmlComprobante, firmar, zipBase64 };
