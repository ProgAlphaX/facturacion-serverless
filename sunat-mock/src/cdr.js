const JSZip = require('jszip');

const RUC_SUNAT = '20131312955';

const escaparXml = (texto) =>
  String(texto).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]);

function fechaHoraLima(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const p = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` };
}

// Estructura del CDR real: ApplicationResponse UBL 2.0 dentro de un ZIP llamado R-<id>.zip
async function construirCdr({ id, rucEmisor, codigo, descripcion }) {
  const { fecha, hora } = fechaHoraLima();
  const [, , serie, numero] = id.split('-');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${Date.now()}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>
  <cbc:ResponseDate>${fecha}</cbc:ResponseDate>
  <cbc:ResponseTime>${hora}</cbc:ResponseTime>
  <cac:SenderParty><cac:PartyIdentification><cbc:ID>${RUC_SUNAT}</cbc:ID></cac:PartyIdentification></cac:SenderParty>
  <cac:ReceiverParty><cac:PartyIdentification><cbc:ID>${rucEmisor}</cbc:ID></cac:PartyIdentification></cac:ReceiverParty>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>${serie}-${numero}</cbc:ReferenceID>
      <cbc:ResponseCode>${codigo}</cbc:ResponseCode>
      <cbc:Description>${escaparXml(descripcion)}</cbc:Description>
    </cac:Response>
    <cac:DocumentReference><cbc:ID>${serie}-${numero}</cbc:ID></cac:DocumentReference>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;

  const zip = new JSZip();
  zip.file(`R-${id}.xml`, xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { construirCdr };
