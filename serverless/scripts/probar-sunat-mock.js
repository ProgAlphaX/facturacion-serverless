// Prueba el sunat-mock desplegado con el mismo código de la API: node scripts/probar-sunat-mock.js <URL>/billService
const fs = require('node:fs');
const path = require('node:path');
const { generarXml, idComprobante } = require('../../api/src/sunat/xml-ubl');
const { crearFirmador } = require('../../api/src/sunat/firma');
const { crearClienteSunat, comprimir, ErrorSunat } = require('../../api/src/sunat/cliente-soap');
const { leerCdr } = require('../../api/src/sunat/cdr');

const url = process.argv[2];
if (!url) {
  console.error('Uso: node scripts/probar-sunat-mock.js https://<url-de-la-funcion>/billService');
  process.exit(1);
}

const certs = path.resolve(__dirname, '../../api/certs');
const firmador = crearFirmador({
  certPem: fs.readFileSync(path.join(certs, 'certificado.pem'), 'utf8'),
  keyPem: fs.readFileSync(path.join(certs, 'llave-privada.pem'), 'utf8'),
});
const emisor = { ruc: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.' };
const factura = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../ejemplos/factura-valida.json'), 'utf8'));

async function enviar(nombre, comprobante, clave = 'moddatos') {
  const cliente = crearClienteSunat({ url, ruc: emisor.ruc, usuario: 'MODDATOS', clave });
  const id = idComprobante(emisor.ruc, comprobante);
  try {
    const { xmlFirmado } = firmador.firmar(generarXml(comprobante, emisor));
    const cdr = await leerCdr(await cliente.enviar(`${id}.zip`, await comprimir(`${id}.xml`, xmlFirmado)));
    console.log(`${nombre}: CDR ${cdr.codigo} (${cdr.estado}) ${cdr.descripcion}`);
  } catch (err) {
    if (!(err instanceof ErrorSunat)) throw err;
    console.log(`${nombre}: falla ${err.codigo || ''} ${err.message}`);
  }
}

(async () => {
  await enviar('1. Factura válida          ', factura);
  await enviar('2. Cliente con RUC inactivo', { ...factura, numero: 2, cliente: { ...factura.cliente, numDoc: '20123456786' } });
  await enviar('3. Clave SOL incorrecta    ', { ...factura, numero: 3 }, 'clave-mala');
})();
