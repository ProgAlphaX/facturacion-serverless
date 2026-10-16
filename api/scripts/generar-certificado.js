// Genera un certificado digital AUTOFIRMADO de prueba para firmar comprobantes.
// En producción el certificado lo emite una entidad autorizada; para el proyecto basta uno de prueba.
// Uso: npm run certificado  →  crea certs/certificado.pem y certs/llave-privada.pem (ignorados por Git)

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const forge = require('node-forge');

function generarCertificado({ ruc = '20000000001', razonSocial = 'EMPRESA DEMO S.A.C.', anios = 1 } = {}) {
  // Las llaves RSA se generan con el módulo nativo de Node (mucho más rápido que forge)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const llaves = {
    privateKey: forge.pki.privateKeyFromPem(privateKey),
    publicKey: forge.pki.publicKeyFromPem(publicKey),
  };
  const cert = forge.pki.createCertificate();

  cert.publicKey = llaves.publicKey;
  cert.serialNumber = `01${forge.util.bytesToHex(forge.random.getBytesSync(8))}`;
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + anios);

  const sujeto = [
    { name: 'commonName', value: razonSocial },
    { name: 'organizationName', value: razonSocial },
    { name: 'serialNumber', value: ruc },
    { name: 'countryName', value: 'PE' },
  ];
  cert.setSubject(sujeto);
  cert.setIssuer(sujeto);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
  ]);
  cert.sign(llaves.privateKey, forge.md.sha256.create());

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(llaves.privateKey),
  };
}

if (require.main === module) {
  const carpeta = path.resolve(__dirname, '..', 'certs');
  fs.mkdirSync(carpeta, { recursive: true });

  const { certPem, keyPem } = generarCertificado({
    ruc: process.env.EMISOR_RUC,
    razonSocial: process.env.EMISOR_RAZON_SOCIAL,
  });
  fs.writeFileSync(path.join(carpeta, 'certificado.pem'), certPem);
  fs.writeFileSync(path.join(carpeta, 'llave-privada.pem'), keyPem, { mode: 0o600 });

  console.log(`Certificado de prueba creado en ${carpeta}`);
  console.log('Recuerda: la carpeta certs/ NO se sube a GitHub.');
}

module.exports = { generarCertificado };
