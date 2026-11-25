import { ESTADOS_COMPROBANTE, EstadoComprobante, Moneda, TipoComprobante } from './comprobante';

/** Una fila del historial que la web guarda en el navegador (el backend aún no tiene un listado). */
export interface EntradaHistorial {
  readonly id: string;
  readonly tipo: TipoComprobante;
  readonly serie: string;
  readonly numero: number;
  readonly clienteNombre: string;
  readonly moneda: Moneda;
  readonly total: number;
  readonly fechaEmision: string;
  /** Cuándo se agregó al historial (ISO 8601). */
  readonly registradoEn: string;
  /** Último estado conocido: se actualiza al consultar. */
  readonly estado: EstadoComprobante;
}

export interface ResumenHistorial {
  readonly total: number;
  readonly aceptados: number;
  readonly rechazados: number;
  readonly enProceso: number;
  readonly conError: number;
}

export function esEntradaHistorial(valor: unknown): valor is EntradaHistorial {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const c = valor as Record<string, unknown>;
  return (
    typeof c['id'] === 'string' &&
    (c['tipo'] === '01' || c['tipo'] === '03') &&
    typeof c['serie'] === 'string' &&
    typeof c['numero'] === 'number' &&
    typeof c['clienteNombre'] === 'string' &&
    (c['moneda'] === 'PEN' || c['moneda'] === 'USD') &&
    typeof c['total'] === 'number' &&
    typeof c['fechaEmision'] === 'string' &&
    typeof c['registradoEn'] === 'string' &&
    typeof c['estado'] === 'string' &&
    (ESTADOS_COMPROBANTE as readonly string[]).includes(c['estado'])
  );
}
