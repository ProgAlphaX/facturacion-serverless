import { ENTORNO_GENERADO } from './entorno.generado';

/** Datos de conexión que sí pueden vivir en el navegador (la llave de API la agrega el proxy). */
export interface Entorno {
  /** Prefijo que el proxy de `ng serve` reenvía a API Gateway. */
  readonly apiBase: string;
  readonly cognitoRegion: string;
  readonly cognitoClienteId: string;
  /** Con `npm run start:demo` la web usa datos simulados y no llama a AWS. */
  readonly modoDemo: boolean;
}

export const entorno: Entorno = ENTORNO_GENERADO;
