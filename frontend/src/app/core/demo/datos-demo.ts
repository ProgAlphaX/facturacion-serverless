import { ComprobanteGuardado } from '../models/consulta';
import {
  ClienteComprobante,
  ItemComprobante,
  Moneda,
  TipoComprobante,
} from '../models/comprobante';
import { calcularTotales, hoyEnLima } from '../reglas/reglas-comprobante';

/** RUC del emisor de la demostración (el mismo que usa el backend real). */
export const RUC_EMISOR_DEMO = '20000000001';

/** Número de comprobante con el formato del backend: RUC-TIPO-SERIE-NUMERO (número de 8 dígitos). */
export const idDe = (tipo: TipoComprobante, serie: string, numero: number): string =>
  `${RUC_EMISOR_DEMO}-${tipo}-${serie}-${String(numero).padStart(8, '0')}`;

const CDR_ACEPTADO = (tipo: TipoComprobante, serie: string, numero: number): string =>
  `La ${tipo === '01' ? 'Factura' : 'Boleta'} numero ${serie}-${String(numero).padStart(8, '0')}, ha sido aceptada`;

interface EspecificacionDemo {
  readonly tipo: TipoComprobante;
  readonly serie: string;
  readonly numero: number;
  readonly cliente: ClienteComprobante;
  readonly items: readonly ItemComprobante[];
  readonly moneda?: Moneda;
  readonly estado: 'ACEPTADO' | 'RECHAZADO' | 'ERROR_ENVIO';
  readonly minutosAtras: number;
}

const servicio = (descripcion: string, cantidad: number, valorUnitario: number): ItemComprobante => ({
  descripcion,
  unidad: 'ZZ',
  cantidad,
  valorUnitario,
});
const bien = (descripcion: string, cantidad: number, valorUnitario: number): ItemComprobante => ({
  descripcion,
  unidad: 'NIU',
  cantidad,
  valorUnitario,
});
const empresa = (numDoc: string, nombre: string): ClienteComprobante => ({ tipoDoc: '6', numDoc, nombre });
const persona = (numDoc: string, nombre: string): ClienteComprobante => ({ tipoDoc: '1', numDoc, nombre });

const ESPECIFICACIONES: readonly EspecificacionDemo[] = [
  { tipo: '01', serie: 'F001', numero: 1, cliente: empresa('20100070970', 'CLIENTE DEMO S.A.'), items: [servicio('Servicio de consultoría', 2, 100), servicio('Soporte técnico mensual', 1, 50)], estado: 'ACEPTADO', minutosAtras: 6 },
  { tipo: '03', serie: 'B001', numero: 1, cliente: persona('12345678', 'JUAN PÉREZ QUISPE'), items: [bien('Mouse inalámbrico', 3, 50)], estado: 'ACEPTADO', minutosAtras: 18 },
  { tipo: '01', serie: 'F001', numero: 2, cliente: empresa('20100070970', 'DISTRIBUIDORA ANDINA S.A.C.'), items: [servicio('Licencia de software', 1, 500)], moneda: 'USD', estado: 'ACEPTADO', minutosAtras: 35 },
  { tipo: '01', serie: 'F001', numero: 3, cliente: empresa('20123456786', 'COMERCIAL SIN RUC ACTIVO E.I.R.L.'), items: [servicio('Servicio de consultoría', 1, 300)], estado: 'RECHAZADO', minutosAtras: 52 },
  { tipo: '03', serie: 'B001', numero: 2, cliente: persona('45678912', 'MARÍA LÓPEZ RAMOS'), items: [bien('Teclado mecánico', 1, 220), bien('Mousepad', 2, 25)], estado: 'ACEPTADO', minutosAtras: 80 },
  { tipo: '01', serie: 'F001', numero: 4, cliente: empresa('20100070970', 'CLIENTE DEMO S.A.'), items: [servicio('Mantenimiento de servidores', 3, 180)], estado: 'ACEPTADO', minutosAtras: 130 },
  { tipo: '01', serie: 'F001', numero: 5, cliente: empresa('20100070970', 'INVERSIONES DEL SUR S.A.'), items: [servicio('Capacitación', 4, 95)], estado: 'ERROR_ENVIO', minutosAtras: 190 },
  { tipo: '03', serie: 'B001', numero: 3, cliente: persona('70123456', 'CARLOS MENDOZA TORRES'), items: [bien('Monitor 24 pulgadas', 1, 650)], estado: 'ACEPTADO', minutosAtras: 260 },
  { tipo: '01', serie: 'F001', numero: 6, cliente: empresa('20123456786', 'IMPORTADORA NORTE S.R.L.'), items: [bien('Cable de red cat6', 40, 8)], estado: 'RECHAZADO', minutosAtras: 400 },
  { tipo: '01', serie: 'F001', numero: 7, cliente: empresa('20100070970', 'CLIENTE DEMO S.A.'), items: [servicio('Servicio de consultoría', 1, 100)], estado: 'ACEPTADO', minutosAtras: 620 },
  { tipo: '03', serie: 'B001', numero: 4, cliente: persona('87654321', 'ANA TORRES VEGA'), items: [bien('Auriculares', 2, 90)], estado: 'ACEPTADO', minutosAtras: 900 },
  { tipo: '01', serie: 'F001', numero: 8, cliente: empresa('20100070970', 'DISTRIBUIDORA ANDINA S.A.C.'), items: [servicio('Soporte técnico mensual', 2, 50)], estado: 'ACEPTADO', minutosAtras: 1300 },
];

/** Huella de ejemplo con aspecto de SHA-256 en base64 (no es una firma real). */
export function huellaDemo(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Comprobantes de muestra, con fechas relativas al momento actual para que se vean recientes. */
export function semilla(ahora: number): readonly ComprobanteGuardado[] {
  const fecha = hoyEnLima(new Date(ahora));
  return ESPECIFICACIONES.map((e): ComprobanteGuardado => {
    const id = idDe(e.tipo, e.serie, e.numero);
    const creado = new Date(ahora - e.minutosAtras * 60_000).toISOString();
    const base = {
      id,
      tipo: e.tipo,
      serie: e.serie,
      numero: e.numero,
      fechaEmision: fecha,
      moneda: e.moneda ?? 'PEN',
      cliente: e.cliente,
      items: e.items,
      totales: calcularTotales(e.items),
      creadoEn: creado,
      actualizadoEn: creado,
    } as const;
    if (e.estado === 'ACEPTADO') {
      return {
        ...base,
        estado: 'ACEPTADO',
        hash: huellaDemo(),
        cdr: { codigo: '0', descripcion: CDR_ACEPTADO(e.tipo, e.serie, e.numero), observaciones: [] },
        archivos: { xml: `firmados/${id}.xml`, cdr: `cdr/R-${id}.zip`, pdf: `pdf/${id}.pdf` },
      };
    }
    if (e.estado === 'RECHAZADO') {
      return {
        ...base,
        estado: 'RECHAZADO',
        hash: huellaDemo(),
        cdr: { codigo: '2017', descripcion: 'El numero de RUC del receptor no esta activo', observaciones: [] },
        archivos: { xml: `firmados/${id}.xml`, cdr: `cdr/R-${id}.zip` },
      };
    }
    return { ...base, estado: 'ERROR_ENVIO', error: 'States.TaskFailed' };
  });
}

export { CDR_ACEPTADO };
