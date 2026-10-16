// Construye un CDR de prueba (como el que devolvería SUNAT) para las pruebas automáticas.

const JSZip = require('jszip');

async function crearCdrZip({ id, codigo = '0', descripcion = `El comprobante ${id} ha sido aceptado`, notas = [] }) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${Date.now()}</cbc:ID>
  ${notas.map((n) => `<cbc:Note>${n}</cbc:Note>`).join('')}
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>${id}</cbc:ReferenceID>
      <cbc:ResponseCode>${codigo}</cbc:ResponseCode>
      <cbc:Description>${descripcion}</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;
  const zip = new JSZip();
  zip.file(`R-${id}.xml`, xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function respuestaSoapCdr(cdrZip) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:br="http://service.sunat.gob.pe">
  <soapenv:Body><br:sendBillResponse><applicationResponse>${cdrZip.toString('base64')}</applicationResponse></br:sendBillResponse></soapenv:Body>
</soapenv:Envelope>`;
}

function respuestaSoapFalla(codigo, mensaje) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body><soapenv:Fault><faultcode>soapenv:Client.${codigo}</faultcode><faultstring>${mensaje}</faultstring></soapenv:Fault></soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { crearCdrZip, respuestaSoapCdr, respuestaSoapFalla };
