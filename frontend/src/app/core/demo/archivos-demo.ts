import { ComprobanteGuardado } from '../models/consulta';
import { TipoArchivo } from '../models/descarga';

/** Quita tildes y caracteres que un PDF básico (Latin-1) no puede mostrar. */
const aAscii = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
const escaparPdf = (texto: string): string => aAscii(texto).replace(/[\\()]/g, '\\$&');

/** Arma un PDF de una página con las líneas indicadas (fuente Helvetica, tabla de referencias correcta). */
export function pdfSimple(lineas: readonly string[]): Uint8Array {
  const texto = lineas
    .map((linea, i) => `${i === 0 ? '' : '0 -18 Td\n'}(${escaparPdf(linea)}) Tj`)
    .join('\n');
  const contenido = `BT\n/F1 14 Tf\n60 760 Td\n${texto}\nET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
  ];

  let salida = '%PDF-1.4\n';
  const posiciones: number[] = [];
  objetos.forEach((objeto, i) => {
    posiciones.push(salida.length);
    salida += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioTabla = salida.length;
  salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const posicion of posiciones) {
    salida += `${String(posicion).padStart(10, '0')} 00000 n \n`;
  }
  salida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioTabla}\n%%EOF\n`;
  return new TextEncoder().encode(salida);
}

export interface ArchivoDemo {
  readonly nombre: string;
  readonly contenido: Uint8Array | string;
  readonly tipoMime: string;
}

const resumen = (c: ComprobanteGuardado): string[] => [
  `COMPROBANTE ${c.serie}-${String(c.numero).padStart(8, '0')} (DEMO)`,
  `Cliente: ${c.cliente.nombre}`,
  `Documento: ${c.cliente.numDoc}`,
  `Fecha de emision: ${c.fechaEmision}`,
  `Total: ${c.moneda} ${c.totales.total.toFixed(2)}`,
  'Documento simulado: no tiene validez tributaria.',
];

/** Contenido de ejemplo del archivo pedido: sirve para mostrar la descarga sin AWS. */
export function archivoDemo(c: ComprobanteGuardado, tipo: TipoArchivo): ArchivoDemo {
  switch (tipo) {
    case 'pdf':
      return { nombre: `${c.id}.pdf`, contenido: pdfSimple(resumen(c)), tipoMime: 'application/pdf' };
    case 'xml':
      return {
        nombre: `${c.id}.xml`,
        tipoMime: 'application/xml',
        contenido: `<?xml version="1.0" encoding="UTF-8"?>\n<!-- XML simulado de la demostracion -->\n<Invoice>\n  <ID>${c.serie}-${c.numero}</ID>\n  <IssueDate>${c.fechaEmision}</IssueDate>\n  <Customer>${c.cliente.nombre}</Customer>\n  <PayableAmount currencyID="${c.moneda}">${c.totales.total.toFixed(2)}</PayableAmount>\n</Invoice>\n`,
      };
    case 'cdr':
      return {
        nombre: `${c.id}-cdr.txt`,
        tipoMime: 'text/plain',
        contenido: `CDR simulado\nCodigo: ${c.cdr?.codigo ?? '-'}\nDescripcion: ${c.cdr?.descripcion ?? '-'}\n`,
      };
  }
}
