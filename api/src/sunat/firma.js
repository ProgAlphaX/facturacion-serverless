// Firma digital del XML (XMLDSig "enveloped"), como exige SUNAT.
// La firma se guarda dentro del mismo XML, en ext:ExtensionContent.
// Si alguien cambia un solo dato del comprobante, la verificación falla.

const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');

const ALGORITMOS = {
  firma: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  digest: 'http://www.w3.org/2001/04/xmlenc#sha256',
  canonicalizacion: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
};
const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';

function buscarNodo(xml, ns, nombre) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return doc.getElementsByTagNameNS(ns, nombre)[0] || null;
}

function crearFirmador({ certPem, keyPem }) {
  // Devuelve el XML firmado y el hash (DigestValue) que va en el PDF y el QR.
  function firmar(xml) {
    const firma = new SignedXml({
      privateKey: keyPem,
      publicCert: certPem,
      signatureAlgorithm: ALGORITMOS.firma,
      canonicalizationAlgorithm: ALGORITMOS.canonicalizacion,
    });
    firma.addReference({
      xpath: '/*',
      transforms: [ALGORITMOS.enveloped, ALGORITMOS.canonicalizacion],
      digestAlgorithm: ALGORITMOS.digest,
      isEmptyUri: true,
    });
    firma.computeSignature(xml, {
      prefix: 'ds',
      attrs: { Id: 'SignatureSP' },
      location: { reference: "//*[local-name()='ExtensionContent']", action: 'append' },
    });

    const xmlFirmado = firma.getSignedXml();
    const hash = buscarNodo(xmlFirmado, NS_DS, 'DigestValue').textContent;
    return { xmlFirmado, hash };
  }

  // Comprueba que la firma sea válida con el certificado público.
  function verificar(xmlFirmado) {
    const nodoFirma = buscarNodo(xmlFirmado, NS_DS, 'Signature');
    if (!nodoFirma) return false;
    const verificador = new SignedXml({ publicCert: certPem });
    verificador.loadSignature(nodoFirma);
    try {
      return verificador.checkSignature(xmlFirmado);
    } catch {
      return false;
    }
  }

  return { firmar, verificar };
}

module.exports = { crearFirmador };
