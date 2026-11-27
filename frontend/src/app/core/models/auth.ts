/** Sesión del usuario; vive en memoria y en sessionStorage (se borra al cerrar la pestaña). */
export interface Sesion {
  readonly usuario: string;
  /** ID token: es el que la API exige en la cabecera Authorization (no el access token). */
  readonly idToken: string;
  readonly refreshToken: string;
  /** Instante de vencimiento del ID token, en milisegundos desde 1970. */
  readonly expiraEn: number;
}

/** Respuesta de InitiateAuth de Cognito (solo los campos que usamos). */
export interface RespuestaAutenticacion {
  readonly AuthenticationResult?: {
    readonly IdToken: string;
    readonly AccessToken: string;
    readonly RefreshToken?: string;
    /** Segundos de vida del ID token. */
    readonly ExpiresIn: number;
  };
  /** Presente cuando Cognito pide un paso extra (p. ej. NEW_PASSWORD_REQUIRED). */
  readonly ChallengeName?: string;
}

/** Cuerpo de un error de Cognito. */
export interface ErrorCognito {
  readonly __type: string;
  readonly message?: string;
}

/** Campos del ID token que usa la web. */
export interface PayloadToken {
  readonly exp: number;
  readonly 'cognito:username'?: string;
}

export function esErrorCognito(valor: unknown): valor is ErrorCognito {
  return typeof valor === 'object' && valor !== null && typeof (valor as { __type?: unknown }).__type === 'string';
}

export function esSesion(valor: unknown): valor is Sesion {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const candidato = valor as Record<string, unknown>;
  return (
    typeof candidato['usuario'] === 'string' &&
    typeof candidato['idToken'] === 'string' &&
    typeof candidato['refreshToken'] === 'string' &&
    typeof candidato['expiraEn'] === 'number'
  );
}
