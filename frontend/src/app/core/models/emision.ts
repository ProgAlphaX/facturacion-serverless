import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { CdrResumen, ReglaIncumplida } from './comprobante';

/** Lo que puede pasar al emitir un comprobante, ya traducido a casos que la pantalla sabe mostrar. */
export type ResultadoEmision =
  | { readonly resultado: 'ACEPTADO' | 'RECHAZADO'; readonly id: string; readonly hash: string; readonly cdr: CdrResumen }
  | { readonly resultado: 'INVALIDO'; readonly errores: readonly ReglaIncumplida[] }
  | { readonly resultado: 'DUPLICADO'; readonly id: string }
  | { readonly resultado: 'ERROR_ENVIO'; readonly id: string }
  | { readonly resultado: 'LIMITE_PETICIONES' }
  | { readonly resultado: 'SESION_EXPIRADA' }
  | { readonly resultado: 'SIN_CONEXION' }
  | { readonly resultado: 'TIEMPO_AGOTADO' }
  | { readonly resultado: 'ERROR'; readonly mensaje: string };

type Registro = Readonly<Record<string, unknown>>;

const esRegistro = (valor: unknown): valor is Registro => typeof valor === 'object' && valor !== null && !Array.isArray(valor);

function leerCdr(valor: unknown): CdrResumen | null {
  if (!esRegistro(valor) || typeof valor['codigo'] !== 'string' || typeof valor['descripcion'] !== 'string') {
    return null;
  }
  const observaciones = Array.isArray(valor['observaciones'])
    ? (valor['observaciones'] as readonly unknown[]).filter((o): o is string => typeof o === 'string')
    : [];
  return { codigo: valor['codigo'], descripcion: valor['descripcion'], observaciones };
}

function leerErrores(valor: unknown): readonly ReglaIncumplida[] {
  if (!Array.isArray(valor)) {
    return [];
  }
  const errores: ReglaIncumplida[] = [];
  for (const elemento of valor as readonly unknown[]) {
    if (
      esRegistro(elemento) &&
      typeof elemento['regla'] === 'string' &&
      typeof elemento['campo'] === 'string' &&
      typeof elemento['mensaje'] === 'string'
    ) {
      errores.push({ regla: elemento['regla'], campo: elemento['campo'], mensaje: elemento['mensaje'] });
    }
  }
  return errores;
}

const MENSAJE_INESPERADO = 'La API respondió algo inesperado. Inténtalo de nuevo.';

/** Traduce el código HTTP y el cuerpo de `POST /comprobantes` (estados de la máquina de Step Functions). */
export function interpretarRespuesta(status: number, cuerpo: unknown): ResultadoEmision {
  if (status === 401) {
    return { resultado: 'SESION_EXPIRADA' };
  }
  if (status === 429) {
    return { resultado: 'LIMITE_PETICIONES' };
  }
  if (!esRegistro(cuerpo)) {
    return { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
  }

  const estado = cuerpo['estado'];
  const id = cuerpo['id'];

  if ((estado === 'ACEPTADO' || estado === 'RECHAZADO') && typeof id === 'string' && typeof cuerpo['hash'] === 'string') {
    const cdr = leerCdr(cuerpo['cdr']);
    if (cdr !== null) {
      return { resultado: estado, id, hash: cuerpo['hash'], cdr };
    }
  }
  if (estado === 'INVALIDO') {
    return { resultado: 'INVALIDO', errores: leerErrores(cuerpo['errores']) };
  }
  if (estado === 'DUPLICADO' && typeof id === 'string') {
    return { resultado: 'DUPLICADO', id };
  }
  if (estado === 'ERROR_ENVIO' && typeof id === 'string') {
    return { resultado: 'ERROR_ENVIO', id };
  }

  // Errores de API Gateway ({"message": ...}) o del flujo ({"estado":"ERROR_FLUJO","mensaje": ...}).
  const mensaje = cuerpo['mensaje'] ?? cuerpo['message'];
  return { resultado: 'ERROR', mensaje: typeof mensaje === 'string' ? mensaje : MENSAJE_INESPERADO };
}

/** Traduce un fallo de la petición (HTTP no 2xx, sin red o sin respuesta a tiempo). */
export function interpretarFallo(error: unknown): ResultadoEmision {
  if (error instanceof TimeoutError) {
    return { resultado: 'TIEMPO_AGOTADO' };
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { resultado: 'SIN_CONEXION' };
    }
    return interpretarRespuesta(error.status, error.error);
  }
  return { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
}
