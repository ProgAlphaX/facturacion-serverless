import { HttpErrorResponse } from '@angular/common/http';

import { esErrorCognito } from '../models/auth';

/** Error de autenticación con un mensaje que ya se puede mostrar al usuario. */
export class ErrorAutenticacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAutenticacion';
  }
}

const MENSAJES_COGNITO: Readonly<Record<string, string>> = {
  NotAuthorizedException: 'Usuario o contraseña incorrectos.',
  UserNotFoundException: 'Usuario o contraseña incorrectos.',
  UserNotConfirmedException: 'Tu usuario aún no está confirmado. Pide al administrador que lo active.',
  PasswordResetRequiredException: 'Debes restablecer tu contraseña antes de entrar.',
  TooManyRequestsException: 'Demasiados intentos. Espera un momento e inténtalo otra vez.',
  LimitExceededException: 'Demasiados intentos. Espera un momento e inténtalo otra vez.',
};

const MENSAJE_GENERICO = 'No se pudo iniciar sesión. Inténtalo de nuevo.';

/** Convierte cualquier error del login en un texto claro para la pantalla. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorAutenticacion) {
    return error.message;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No hay conexión con el servicio de acceso. Revisa tu internet.';
    }
    const cuerpo: unknown = error.error;
    if (esErrorCognito(cuerpo)) {
      return MENSAJES_COGNITO[cuerpo.__type] ?? MENSAJE_GENERICO;
    }
  }
  return MENSAJE_GENERICO;
}
