/** Estados que el backend guarda en DynamoDB para un comprobante (api/src/sunat/cdr.js y guardar-resultado). */
export const ESTADOS_COMPROBANTE = ['PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR_ENVIO'] as const;
export type EstadoComprobante = (typeof ESTADOS_COMPROBANTE)[number];

export const ETIQUETA_ESTADO: Readonly<Record<EstadoComprobante, string>> = {
  PROCESANDO: 'En proceso',
  ACEPTADO: 'Aceptado',
  RECHAZADO: 'Rechazado',
  ERROR_ENVIO: 'Error de envío',
};

/** Catálogo 01 de SUNAT: la API solo emite facturas y boletas. */
export type TipoComprobante = '01' | '03';
export type Moneda = 'PEN' | 'USD';
/** Catálogo 06: 0 sin documento, 1 DNI, 6 RUC. */
export type TipoDocumento = '0' | '1' | '6';
/** Catálogo de unidades que usa la API: bienes (NIU) y servicios (ZZ). */
export type UnidadMedida = 'NIU' | 'ZZ';

export const ETIQUETA_TIPO: Readonly<Record<TipoComprobante, string>> = { '01': 'Factura', '03': 'Boleta de venta' };
export const ETIQUETA_DOCUMENTO: Readonly<Record<TipoDocumento, string>> = { '0': 'Sin documento', '1': 'DNI', '6': 'RUC' };
export const ETIQUETA_UNIDAD: Readonly<Record<UnidadMedida, string>> = { NIU: 'Unidad (bienes)', ZZ: 'Unidad (servicios)' };

export interface ClienteComprobante {
  readonly tipoDoc: TipoDocumento;
  readonly numDoc: string;
  readonly nombre: string;
}

export interface ItemComprobante {
  readonly descripcion: string;
  readonly unidad: UnidadMedida;
  readonly cantidad: number;
  readonly valorUnitario: number;
}

export interface TotalesComprobante {
  readonly valorVenta: number;
  readonly igv: number;
  readonly total: number;
}

/** Cuerpo de `POST /comprobantes` (igual que `ejemplos/factura-valida.json`). El RUC del emisor lo pone el backend. */
export interface ComprobanteEntrada {
  readonly tipo: TipoComprobante;
  readonly serie: string;
  readonly numero: number;
  /** AAAA-MM-DD */
  readonly fechaEmision: string;
  readonly moneda: Moneda;
  readonly cliente: ClienteComprobante;
  readonly items: readonly ItemComprobante[];
  readonly totales: TotalesComprobante;
}

/** Una regla de negocio (R01–R12) o de forma (ESQUEMA) que el comprobante no cumple. */
export interface ReglaIncumplida {
  readonly regla: string;
  /** Ruta del campo, p. ej. `cliente`, `totales.igv` o `items.0.cantidad`. */
  readonly campo: string;
  readonly mensaje: string;
}

/** Resumen del CDR (constancia de recepción) que devuelve SUNAT. */
export interface CdrResumen {
  readonly codigo: string;
  readonly descripcion: string;
  readonly observaciones: readonly string[];
}
