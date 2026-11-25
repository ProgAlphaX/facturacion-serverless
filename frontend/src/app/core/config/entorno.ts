import { ENTORNO_GENERADO } from './entorno.generado';

/** Datos de conexión que sí pueden vivir en el navegador (la llave de API la agrega el proxy). */
export interface Entorno {
  /** Prefijo que el proxy de `ng serve` reenvía a API Gateway. */
  readonly apiBase: string;
  readonly cognitoRegion: string;
  readonly cognitoClienteId: string;
}

export const entorno: Entorno = ENTORNO_GENERADO;
