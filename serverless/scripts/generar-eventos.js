// Crea en serverless/eventos/ los JSON de prueba para invocar cada Lambda con "serverless invoke --path".
// Usa un número de comprobante nuevo en cada corrida para no chocar con la regla de duplicados.
const fs = require('node:fs');
const path = require('node:path');
const { generarXml, idComprobante } = require('../../api/src/sunat/xml-ubl');
const { crearFirmador } = require('../../api/src/sunat/firma');

const certs = path.resolve(__dirname, '../../api/certs');
const firmador = crearFirmador({
  certPem: fs.readFileSync(path.join(certs, 'certificado.pem'), 'utf8'),
  keyPem: fs.readFileSync(path.join(certs, 'llave-privada.pem'), 'utf8'),
});
const emisor = { ruc: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.' };

const factura = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../ejemplos/factura-valida.json'), 'utf8'));
factura.numero = (Date.now() % 99999999) + 1;
factura.fechaEmision = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const id = idComprobante(emisor.ruc, factura);
const xml = generarXml(factura, emisor);
const { xmlFirmado, hash } = firmador.firmar(xml);

const eventos = {
  'validar.json': factura,
  'generar-xml.json': { datos: factura },
  'generar-pdf.json': { comprobante: factura, hash },
  'reservar.json': { accion: 'RESERVAR', datos: factura },
  'firmar.json': { id, xml },
  'enviar-sunat.json': { id, xmlFirmado },
  'finalizar.json': {
    accion: 'FINALIZAR',
    id,
    cdr: { codigo: '0', descripcion: 'Aceptado (prueba)', observaciones: [], estado: 'ACEPTADO' },
    hash,
    archivos: { xml: `firmados/${id}.xml`, cdr: `cdr/R-${id}.zip` },
  },
};

// Entradas para ejecutar la máquina de estados (Fase 4). Cada una usa su propio número.
const ejemplo = (nombre) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../ejemplos/${nombre}.json`), 'utf8'));
const conNumero = (f, n) => ({ ...f, numero: n, fechaEmision: factura.fechaEmision });
const base = (Date.now() % 90000000) + 1000;
eventos['flujo-aceptado.json'] = conNumero(factura, base);
eventos['flujo-invalido.json'] = conNumero(ejemplo('factura-igv-incorrecto'), base + 1);
eventos['flujo-rechazado.json'] = {
  ...conNumero(factura, base + 2),
  cliente: { ...factura.cliente, numDoc: '20123456786', nombre: 'CLIENTE RUC INACTIVO S.A.' },
};

const carpeta = path.resolve(__dirname, '../eventos');
fs.mkdirSync(carpeta, { recursive: true });
for (const [nombre, contenido] of Object.entries(eventos)) {
  fs.writeFileSync(path.join(carpeta, nombre), JSON.stringify(contenido, null, 2));
}
console.log(`Eventos creados en serverless/eventos/ para el comprobante ${id}`);
