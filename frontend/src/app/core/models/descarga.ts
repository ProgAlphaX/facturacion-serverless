import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { esRegistro } from './emision';

/** Archivos de un comprobante que se pueden descargar. */
export const TIPOS_ARCHIVO = ['xml', 'cdr', 'pdf'] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];

export const ETIQUETA_ARCHIVO: Readonly<Record<TipoArchivo, string>> = {
  xml: 'XML firmado',
  cdr: 'CDR de SUNAT',
  pdf: 'PDF con QR',
};

export type ResultadoDescarga =
  | {
      readonly resultado: 'LISTA';
      /** URL temporal de S3 (vence a los `expiraEnSegundos`). */
      readonly url: string;
      readonly nombre: string;
      readonly expiraEnSegundos: number;
    }
  | { readonly resultado: 'NO_DISPONIBLE'; readonly mensaje: string }
  | { readonly resultado: 'LIMITE_PETICIONES' }
  | { readonly resultado: 'SESION_EXPIRADA' }
  | { readonly resultado: 'SIN_CONEXION' }
  | { readonly resultado: 'TIEMPO_AGOTADO' }
  | { readonly resultado: 'ERROR'; readonly mensaje: string };

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

/** Traduce el código HTTP y el cuerpo de `GET /comprobantes/{id}/archivos/{tipo}`. */
export function interpretarDescarga(status: number, cuerpo: unknown): ResultadoDescarga {
  if (status === 401) {
    return { resultado: 'SESION_EXPIRADA' };
  }
  if (status === 429) {
    return { resultado: 'LIMITE_PETICIONES' };
  }
  if (status === 404) {
    return { resultado: 'NO_DISPONIBLE', mensaje: mensajeDe(cuerpo) };
  }
  if (status === 200 && esRegistro(cuerpo)) {
    const { url, nombre, expiraEnSegundos } = cuerpo;
    // Solo se aceptan enlaces https: la URL va a un enlace que el navegador abrirá.
    if (typeof url === 'string' && url.startsWith('https://') && typeof nombre === 'string' && typeof expiraEnSegundos === 'number') {
      return { resultado: 'LISTA', url, nombre, expiraEnSegundos };
    }
    return { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
  }
  return { resultado: 'ERROR', mensaje: mensajeDe(cuerpo) };
}

export function interpretarFalloDescarga(error: unknown): ResultadoDescarga {
  if (error instanceof TimeoutError) {
    return { resultado: 'TIEMPO_AGOTADO' };
  }
  if (error instanceof HttpErrorResponse) {
    return error.status === 0 ? { resultado: 'SIN_CONEXION' } : interpretarDescarga(error.status, error.error);
  }
  return { resultado: 'ERROR', mensaje: MENSAJE_INESPERADO };
}

/** Texto para mostrar cuando una descarga no se pudo preparar. */
export function mensajeDeDescarga(resultado: Exclude<ResultadoDescarga, { resultado: 'LISTA' }>): string {
  switch (resultado.resultado) {
    case 'NO_DISPONIBLE':
      return resultado.mensaje;
    case 'LIMITE_PETICIONES':
      return 'Demasiadas peticiones seguidas. Espera unos segundos e inténtalo otra vez.';
    case 'SESION_EXPIRADA':
      return 'Tu sesión venció. Vuelve a iniciar sesión.';
    case 'SIN_CONEXION':
      return 'No hay conexión con la API.';
    case 'TIEMPO_AGOTADO':
      return 'La API tardó demasiado en responder.';
    case 'ERROR':
      return resultado.mensaje;
  }
}

/** Inicia la descarga con un enlace temporal; S3 responde con `Content-Disposition: attachment`, así que la página no cambia. */
export function iniciarDescarga(url: string, nombre: string): void {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
}
