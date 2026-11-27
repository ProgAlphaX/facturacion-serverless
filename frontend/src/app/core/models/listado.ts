import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { ESTADOS_COMPROBANTE, EstadoComprobante, Moneda, TipoComprobante } from './comprobante';
import { esRegistro } from './emision';

/** Una fila del listado que devuelve `GET /comprobantes` (solo el resumen de cada comprobante). */
export interface ResumenComprobante {
  readonly id: string;
  readonly tipo: TipoComprobante;
  readonly serie: string;
  readonly numero: number;
  readonly estado: EstadoComprobante;
  readonly clienteNombre: string;
  readonly moneda: Moneda;
  readonly total: number;
  readonly fechaEmision: string;
  readonly creadoEn: string;
  readonly actualizadoEn: string;
  readonly tienePdf: boolean;
}

/** Cuántos comprobantes hay por estado, sin importar el filtro de la consulta. */
export type ConteoPorEstado = Readonly<Record<EstadoComprobante, number>>;

export interface PaginaComprobantes {
  readonly comprobantes: readonly ResumenComprobante[];
  /** Total que cumple el filtro (no solo los de esta página). */
  readonly total: number;
  /** Desde dónde pedir la página siguiente, o `null` si no hay más. */
  readonly siguiente: number | null;
  readonly resumen: ConteoPorEstado;
}

export interface ConsultaListado {
  readonly estado?: EstadoComprobante;
  readonly limite?: number;
  readonly desde?: number;
}

export type ResultadoListado =
  | { readonly resultado: 'LISTADO'; readonly pagina: PaginaComprobantes }
  | { readonly resultado: 'LIMITE_PETICIONES' }
  | { readonly resultado: 'SESION_EXPIRADA' }
  | { readonly resultado: 'SIN_CONEXION' }
  | { readonly resultado: 'TIEMPO_AGOTADO' }
  | { readonly resultado: 'ERROR'; readonly mensaje: string };

const esTexto = (valor: unknown): valor is string => typeof valor === 'string';
const esNumero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor);
const esEstado = (valor: unknown): valor is EstadoComprobante =>
  esTexto(valor) && (ESTADOS_COMPROBANTE as readonly string[]).includes(valor);

function leerResumen(valor: unknown): ResumenComprobante | null {
  if (
    !esRegistro(valor) ||
    !esTexto(valor['id']) ||
    (valor['tipo'] !== '01' && valor['tipo'] !== '03') ||
    !esTexto(valor['serie']) ||
    !esNumero(valor['numero']) ||
    !esEstado(valor['estado']) ||
    !esTexto(valor['clienteNombre']) ||
    (valor['moneda'] !== 'PEN' && valor['moneda'] !== 'USD') ||
    !esNumero(valor['total']) ||
    !esTexto(valor['fechaEmision']) ||
    !esTexto(valor['creadoEn']) ||
    !esTexto(valor['actualizadoEn']) ||
    typeof valor['tienePdf'] !== 'boolean'
  ) {
    return null;
  }
  return {
    id: valor['id'],
    tipo: valor['tipo'],
    serie: valor['serie'],
    numero: valor['numero'],
    estado: valor['estado'],
    clienteNombre: valor['clienteNombre'],
    moneda: valor['moneda'],
    total: valor['total'],
    fechaEmision: valor['fechaEmision'],
    creadoEn: valor['creadoEn'],
    actualizadoEn: valor['actualizadoEn'],
    tienePdf: valor['tienePdf'],
  };
}

function leerConteo(valor: unknown): ConteoPorEstado | null {
  if (!esRegistro(valor)) {
    return null;
  }
  const { PROCESANDO, ACEPTADO, RECHAZADO, ERROR_ENVIO } = valor;
  if (!esNumero(PROCESANDO) || !esNumero(ACEPTADO) || !esNumero(RECHAZADO) || !esNumero(ERROR_ENVIO)) {
    return null;
  }
  return { PROCESANDO, ACEPTADO, RECHAZADO, ERROR_ENVIO };
}

/** Valida y tipa la página del listado; si algo no cuadra devuelve `null`. */
export function leerPagina(valor: unknown): PaginaComprobantes | null {
  if (!esRegistro(valor) || !Array.isArray(valor['comprobantes']) || !esNumero(valor['total'])) {
    return null;
  }
  const siguiente = valor['siguiente'];
  if (siguiente !== null && !esNumero(siguiente)) {
    return null;
  }
  const resumen = leerConteo(valor['resumen']);
  const filas = (valor['comprobantes'] as readonly unknown[]).map(leerResumen);
  if (resumen === null || filas.some((fila) => fila === null)) {
    return null;
  }
  return {
    comprobantes: filas.filter((fila): fila is ResumenComprobante => fila !== null),
    total: valor['total'],
    siguiente,
    resumen,
  };
}

const MENSAJE_INESPERADO = 'La API respondió algo inesperado. Inténtalo de nuevo.';

function mensajeDe(cuerpo: unknown): string {
  if (esRegistro(cuerpo)) {
    const texto = cuerpo['error'] ?? cuerpo['mensaje'] ?? cuerpo['message'];
    if (typeof texto === 'string') {
      return texto;
    }
  }
  return MENSAJE_INESPERADO;
}

/** Traduce el código HTTP y el cuerpo de `GET /comprobantes`. */
export function interpretarListado(status: number, cuerpo: unknown): ResultadoListado {
  if (status === 401) {
    return { resultado: 'SESION_EXPIRADA' };
  }
  if (status === 429) {
    return { resultado: 'LIMITE_PETICIONES' };
  }
  if (status === 200) {
    const pagina = leerPagina(cuerpo);
    return pagina !== null ? { resultado: 'LISTADO', pagina } : { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
  }
  return { resultado: 'ERROR', mensaje: mensajeDe(cuerpo) };
}

export function interpretarFalloListado(error: unknown): ResultadoListado {
  if (error instanceof TimeoutError) {
    return { resultado: 'TIEMPO_AGOTADO' };
  }
  if (error instanceof HttpErrorResponse) {
    return error.status === 0 ? { resultado: 'SIN_CONEXION' } : interpretarListado(error.status, error.error);
  }
  return { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
}
