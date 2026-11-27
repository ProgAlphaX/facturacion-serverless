import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import {
  CdrResumen,
  ComprobanteEntrada,
  ESTADOS_COMPROBANTE,
  EstadoComprobante,
  ItemComprobante,
  Moneda,
  TipoComprobante,
  TipoDocumento,
  UnidadMedida,
} from './comprobante';
import { esRegistro, leerCdr } from './emision';

/** Formato del id de un comprobante: RUC-TIPO-SERIE-NUMERO (api/src/almacenamiento/dynamo.js). */
export const FORMATO_ID = /^\d{11}-(01|03)-[A-Z0-9]{4}-\d{8}$/;

export const normalizarId = (texto: string): string => texto.trim().toUpperCase();

/** Claves de S3 de los archivos del comprobante; el PDF aparece unos segundos después de aceptarlo. */
export interface ArchivosComprobante {
  readonly xml?: string;
  readonly cdr?: string;
  readonly pdf?: string;
}

/** Registro que `GET /comprobantes/{id}` devuelve desde DynamoDB. */
export interface ComprobanteGuardado extends ComprobanteEntrada {
  readonly id: string;
  readonly estado: EstadoComprobante;
  readonly creadoEn: string;
  readonly actualizadoEn: string;
  readonly hash?: string;
  readonly cdr?: CdrResumen;
  /** Motivo técnico cuando el estado es ERROR_ENVIO. */
  readonly error?: string;
  readonly archivos?: ArchivosComprobante;
}

export type ResultadoConsulta =
  | { readonly resultado: 'ENCONTRADO'; readonly comprobante: ComprobanteGuardado }
  | { readonly resultado: 'NO_EXISTE'; readonly mensaje: string }
  | { readonly resultado: 'LIMITE_PETICIONES' }
  | { readonly resultado: 'SESION_EXPIRADA' }
  | { readonly resultado: 'SIN_CONEXION' }
  | { readonly resultado: 'TIEMPO_AGOTADO' }
  | { readonly resultado: 'ERROR'; readonly mensaje: string };

const esUno = <T extends string>(valor: unknown, validos: readonly T[]): valor is T =>
  typeof valor === 'string' && (validos as readonly string[]).includes(valor);

const esTexto = (valor: unknown): valor is string => typeof valor === 'string';
const esNumero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor);

function leerItem(valor: unknown): ItemComprobante | null {
  if (
    !esRegistro(valor) ||
    !esTexto(valor['descripcion']) ||
    !esUno<UnidadMedida>(valor['unidad'], ['NIU', 'ZZ']) ||
    !esNumero(valor['cantidad']) ||
    !esNumero(valor['valorUnitario'])
  ) {
    return null;
  }
  return { descripcion: valor['descripcion'], unidad: valor['unidad'], cantidad: valor['cantidad'], valorUnitario: valor['valorUnitario'] };
}

function leerArchivos(valor: unknown): ArchivosComprobante | undefined {
  if (!esRegistro(valor)) {
    return undefined;
  }
  const { xml, cdr, pdf } = valor;
  return {
    ...(esTexto(xml) ? { xml } : {}),
    ...(esTexto(cdr) ? { cdr } : {}),
    ...(esTexto(pdf) ? { pdf } : {}),
  };
}

/** Valida y tipa el registro guardado; si falta algo esencial devuelve `null` en vez de inventar datos. */
export function leerComprobante(valor: unknown): ComprobanteGuardado | null {
  if (!esRegistro(valor)) {
    return null;
  }
  const { cliente, totales, items } = valor;
  if (
    !esUno<EstadoComprobante>(valor['estado'], ESTADOS_COMPROBANTE) ||
    !esTexto(valor['id']) ||
    !esUno<TipoComprobante>(valor['tipo'], ['01', '03']) ||
    !esTexto(valor['serie']) ||
    !esNumero(valor['numero']) ||
    !esTexto(valor['fechaEmision']) ||
    !esUno<Moneda>(valor['moneda'], ['PEN', 'USD']) ||
    !esRegistro(cliente) ||
    !esUno<TipoDocumento>(cliente['tipoDoc'], ['0', '1', '6']) ||
    !esTexto(cliente['numDoc']) ||
    !esTexto(cliente['nombre']) ||
    !esRegistro(totales) ||
    !esNumero(totales['valorVenta']) ||
    !esNumero(totales['igv']) ||
    !esNumero(totales['total']) ||
    !Array.isArray(items)
  ) {
    return null;
  }
  const itemsLeidos = (items as readonly unknown[]).map(leerItem);
  if (itemsLeidos.some((item) => item === null)) {
    return null;
  }

  const cdr = leerCdr(valor['cdr']);
  const archivos = leerArchivos(valor['archivos']);
  return {
    id: valor['id'],
    estado: valor['estado'],
    tipo: valor['tipo'],
    serie: valor['serie'],
    numero: valor['numero'],
    fechaEmision: valor['fechaEmision'],
    moneda: valor['moneda'],
    cliente: { tipoDoc: cliente['tipoDoc'], numDoc: cliente['numDoc'], nombre: cliente['nombre'] },
    items: itemsLeidos.filter((item): item is ItemComprobante => item !== null),
    totales: { valorVenta: totales['valorVenta'], igv: totales['igv'], total: totales['total'] },
    creadoEn: esTexto(valor['creadoEn']) ? valor['creadoEn'] : '',
    actualizadoEn: esTexto(valor['actualizadoEn']) ? valor['actualizadoEn'] : '',
    ...(esTexto(valor['hash']) ? { hash: valor['hash'] } : {}),
    ...(cdr !== null ? { cdr } : {}),
    ...(esTexto(valor['error']) ? { error: valor['error'] } : {}),
    ...(archivos !== undefined ? { archivos } : {}),
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

/** Traduce el código HTTP y el cuerpo de `GET /comprobantes/{id}`. */
export function interpretarConsulta(status: number, cuerpo: unknown): ResultadoConsulta {
  if (status === 401) {
    return { resultado: 'SESION_EXPIRADA' };
  }
  if (status === 429) {
    return { resultado: 'LIMITE_PETICIONES' };
  }
  if (status === 404) {
    return { resultado: 'NO_EXISTE', mensaje: mensajeDe(cuerpo) };
  }
  if (status === 200) {
    const comprobante = leerComprobante(cuerpo);
    return comprobante !== null ? { resultado: 'ENCONTRADO', comprobante } : { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
  }
  return { resultado: 'ERROR', mensaje: mensajeDe(cuerpo) };
}

export function interpretarFalloConsulta(error: unknown): ResultadoConsulta {
  if (error instanceof TimeoutError) {
    return { resultado: 'TIEMPO_AGOTADO' };
  }
  if (error instanceof HttpErrorResponse) {
    return error.status === 0 ? { resultado: 'SIN_CONEXION' } : interpretarConsulta(error.status, error.error);
  }
  return { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
}
