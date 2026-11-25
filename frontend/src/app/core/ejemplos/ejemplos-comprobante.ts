import { ComprobanteEntrada } from '../models/comprobante';
import { calcularTotales } from '../reglas/reglas-comprobante';

export type ClaveEjemplo =
  | 'factura-valida'
  | 'boleta-valida'
  | 'factura-dolares'
  | 'ruc-inactivo'
  | 'ruc-invalido'
  | 'serie-incorrecta'
  | 'boleta-sin-dni'
  | 'fecha-futura'
  | 'cantidad-cero';

export interface InfoEjemplo {
  readonly clave: ClaveEjemplo;
  readonly etiqueta: string;
  /** Lo que se espera que responda el backend. */
  readonly esperado: string;
}

export const EJEMPLOS: readonly InfoEjemplo[] = [
  { clave: 'factura-valida', etiqueta: 'Factura válida', esperado: '201 ACEPTADO' },
  { clave: 'boleta-valida', etiqueta: 'Boleta válida', esperado: '201 ACEPTADO' },
  { clave: 'factura-dolares', etiqueta: 'Factura en dólares', esperado: '201 ACEPTADO' },
  { clave: 'ruc-inactivo', etiqueta: 'Cliente con RUC inactivo', esperado: '201 RECHAZADO (CDR 2017)' },
  { clave: 'ruc-invalido', etiqueta: 'RUC del cliente mal escrito', esperado: '400 INVALIDO (R07)' },
  { clave: 'serie-incorrecta', etiqueta: 'Factura con serie de boleta', esperado: '400 INVALIDO (R02)' },
  { clave: 'boleta-sin-dni', etiqueta: 'Boleta mayor a S/ 700 sin DNI', esperado: '400 INVALIDO (R08)' },
  { clave: 'fecha-futura', etiqueta: 'Fecha de emisión futura', esperado: '400 INVALIDO (R04)' },
  { clave: 'cantidad-cero', etiqueta: 'Ítem con cantidad 0', esperado: '400 INVALIDO (R09)' },
];

const CLIENTE_FACTURA = { tipoDoc: '6', numDoc: '20100070970', nombre: 'CLIENTE DEMO S.A.' } as const;

const SERVICIOS = [
  { descripcion: 'Servicio de consultoría', unidad: 'ZZ', cantidad: 2, valorUnitario: 100 },
  { descripcion: 'Soporte técnico mensual', unidad: 'ZZ', cantidad: 1, valorUnitario: 50 },
] as const;

function sumarDias(fecha: string, dias: number): string {
  const [a = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Arma un comprobante de ejemplo con los mismos datos de `ejemplos/*.json`, pero con la fecha de hoy
 * (la regla R04 solo acepta hasta 3 días de antigüedad) y el número que se le indique (R12: no se repite).
 */
export function crearEjemplo(clave: ClaveEjemplo, hoy: string, numero: number): ComprobanteEntrada {
  const base: ComprobanteEntrada = {
    tipo: '01',
    serie: 'F001',
    numero,
    fechaEmision: hoy,
    moneda: 'PEN',
    cliente: CLIENTE_FACTURA,
    items: SERVICIOS,
    totales: calcularTotales(SERVICIOS),
  };

  switch (clave) {
    case 'factura-valida':
      return base;
    case 'boleta-valida': {
      const items = [{ descripcion: 'Mouse inalámbrico', unidad: 'NIU', cantidad: 3, valorUnitario: 50 }] as const;
      return {
        ...base,
        tipo: '03',
        serie: 'B001',
        cliente: { tipoDoc: '1', numDoc: '12345678', nombre: 'JUAN PÉREZ QUISPE' },
        items,
        totales: calcularTotales(items),
      };
    }
    case 'factura-dolares': {
      const items = [{ descripcion: 'Licencia de software', unidad: 'ZZ', cantidad: 1, valorUnitario: 500 }] as const;
      return { ...base, moneda: 'USD', items, totales: calcularTotales(items) };
    }
    case 'ruc-inactivo':
      return { ...base, cliente: { ...CLIENTE_FACTURA, numDoc: '20123456786' } };
    case 'ruc-invalido':
      return { ...base, cliente: { ...CLIENTE_FACTURA, numDoc: '20100070971' } };
    case 'serie-incorrecta':
      return { ...base, serie: 'B001' };
    case 'boleta-sin-dni': {
      const items = [{ descripcion: 'Monitor 27 pulgadas', unidad: 'NIU', cantidad: 1, valorUnitario: 800 }] as const;
      return {
        ...base,
        tipo: '03',
        serie: 'B001',
        cliente: { tipoDoc: '0', numDoc: '-', nombre: 'CLIENTES VARIOS' },
        items,
        totales: calcularTotales(items),
      };
    }
    case 'fecha-futura':
      return { ...base, fechaEmision: sumarDias(hoy, 4) };
    case 'cantidad-cero': {
      const items = [{ descripcion: 'Servicio de consultoría', unidad: 'ZZ', cantidad: 0, valorUnitario: 100 }] as const;
      return { ...base, items, totales: calcularTotales(items) };
    }
  }
}

/** Número al azar entre 90 000 000 y 99 999 999, como hace `probar-api.ps1`, para no chocar con R12. */
export function numeroAleatorio(): number {
  return 90_000_000 + Math.floor(Math.random() * 10_000_000);
}
