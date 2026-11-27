import { ComprobanteEntrada, ItemComprobante, ReglaIncumplida, TotalesComprobante } from '../models/comprobante';

/**
 * Copia en el navegador de las reglas del backend (api/src/reglas) para avisar antes de enviar.
 * No incluye R06 (el RUC del emisor lo pone el backend) ni R12 (duplicados): esas las decide AWS.
 * La palabra final siempre es del backend.
 */

export const TASA_IGV = 0.18;
const TOLERANCIA = 0.01;
const MONTO_MAXIMO_BOLETA_SIN_DNI = 700;
const DIAS_MAXIMOS_ANTIGUEDAD = 3;
const FACTORES_RUC: readonly number[] = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS_RUC: readonly string[] = ['10', '15', '17', '20'];

export const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const difiere = (a: number, b: number): boolean => Math.abs(a - b) > TOLERANCIA + Number.EPSILON;

/** Fecha de hoy (AAAA-MM-DD) en la hora de Lima, que es la que usa SUNAT. */
export function hoyEnLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);
}

function partesDeFecha(fecha: string): [number, number, number] {
  const [a = 0, m = 0, d = 0] = fecha.split('-').map(Number);
  return [a, m, d];
}

function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = partesDeFecha(desde);
  const [a2, m2, d2] = partesDeFecha(hasta);
  return (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000;
}

function esFechaReal(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }
  const [a, m, d] = partesDeFecha(fecha);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

export function esRucValido(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc) || !PREFIJOS_RUC.includes(ruc.slice(0, 2))) {
    return false;
  }
  const suma = FACTORES_RUC.reduce((acc, factor, i) => acc + factor * Number(ruc[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 10) {
    verificador = 0;
  }
  if (verificador === 11) {
    verificador = 1;
  }
  return verificador === Number(ruc[10]);
}

export const esDniValido = (dni: string): boolean => /^\d{8}$/.test(dni);

/** Valor de venta, IGV (18 %) y total a partir de los ítems; lo mismo que calcula el backend. */
export function calcularTotales(items: readonly ItemComprobante[]): TotalesComprobante {
  const valorVenta = redondear(items.reduce((acc, item) => acc + redondear(item.cantidad * item.valorUnitario), 0));
  const igv = redondear(valorVenta * TASA_IGV);
  return { valorVenta, igv, total: redondear(valorVenta + igv) };
}

export function validarBorrador(c: ComprobanteEntrada, hoy: string): ReglaIncumplida[] {
  const errores: ReglaIncumplida[] = [];
  const error = (regla: string, campo: string, mensaje: string): void => {
    errores.push({ regla, campo, mensaje });
  };

  if (c.tipo !== '01' && c.tipo !== '03') {
    error('R01', 'tipo', 'El tipo debe ser 01 (factura) o 03 (boleta)');
  }

  if (c.tipo === '01' && !/^F[A-Z0-9]{3}$/.test(c.serie)) {
    error('R02', 'serie', 'La serie de una factura debe ser F + 3 caracteres (ej. F001)');
  }
  if (c.tipo === '03' && !/^B[A-Z0-9]{3}$/.test(c.serie)) {
    error('R02', 'serie', 'La serie de una boleta debe ser B + 3 caracteres (ej. B001)');
  }

  if (!Number.isInteger(c.numero) || c.numero < 1 || c.numero > 99_999_999) {
    error('R03', 'numero', 'El número debe estar entre 1 y 99999999');
  }

  if (!esFechaReal(c.fechaEmision)) {
    error('R04', 'fechaEmision', 'La fecha de emisión no existe');
  } else {
    const dias = diasEntre(c.fechaEmision, hoy);
    if (dias < 0) {
      error('R04', 'fechaEmision', 'La fecha de emisión no puede ser futura');
    } else if (dias > DIAS_MAXIMOS_ANTIGUEDAD) {
      error('R04', 'fechaEmision', `La fecha de emisión no puede tener más de ${DIAS_MAXIMOS_ANTIGUEDAD} días de antigüedad`);
    }
  }

  if (c.moneda !== 'PEN' && c.moneda !== 'USD') {
    error('R05', 'moneda', 'La moneda debe ser PEN o USD');
  }

  if (c.tipo === '01' && (c.cliente.tipoDoc !== '6' || !esRucValido(c.cliente.numDoc))) {
    error('R07', 'cliente', 'Una factura requiere un cliente con RUC válido (tipoDoc 6)');
  }

  if (c.tipo === '03' && c.totales.total > MONTO_MAXIMO_BOLETA_SIN_DNI) {
    if (c.cliente.tipoDoc !== '1' || !esDniValido(c.cliente.numDoc)) {
      error('R08', 'cliente', `Una boleta mayor a S/ ${MONTO_MAXIMO_BOLETA_SIN_DNI} requiere DNI del cliente (tipoDoc 1, 8 dígitos)`);
    }
  }

  if (c.cliente.nombre.trim() === '') {
    error('ESQUEMA', 'cliente.nombre', 'Escribe el nombre o razón social del cliente');
  }

  if (c.items.length === 0) {
    error('R09', 'items', 'El comprobante debe tener al menos un ítem');
  }
  c.items.forEach((item, i) => {
    if (item.descripcion.trim() === '') {
      error('ESQUEMA', `items.${i}.descripcion`, 'Describe el producto o servicio');
    }
    if (!(item.cantidad > 0)) {
      error('R09', `items.${i}.cantidad`, 'La cantidad debe ser mayor a 0');
    }
    if (!(item.valorUnitario > 0)) {
      error('R09', `items.${i}.valorUnitario`, 'El valor unitario debe ser mayor a 0');
    }
  });

  const igvEsperado = redondear(c.totales.valorVenta * TASA_IGV);
  if (difiere(c.totales.igv, igvEsperado)) {
    error('R10', 'totales.igv', `El IGV debe ser el 18% del valor de venta (${igvEsperado.toFixed(2)})`);
  }
  const calculado = calcularTotales(c.items);
  if (difiere(c.totales.valorVenta, calculado.valorVenta)) {
    error('R11', 'totales.valorVenta', `El valor de venta no coincide con la suma de los ítems (${calculado.valorVenta.toFixed(2)})`);
  }
  if (difiere(c.totales.total, redondear(c.totales.valorVenta + c.totales.igv))) {
    error('R11', 'totales.total', 'El total debe ser igual al valor de venta más el IGV');
  }

  return errores;
}

/** Agrupa los mensajes por campo para mostrarlos junto a cada control. */
export function agruparPorCampo(errores: readonly ReglaIncumplida[]): ReadonlyMap<string, readonly string[]> {
  const mapa = new Map<string, string[]>();
  for (const { regla, campo, mensaje } of errores) {
    const lista = mapa.get(campo) ?? [];
    const texto = regla === 'ESQUEMA' ? mensaje : `${regla}: ${mensaje}`;
    if (!lista.includes(texto)) {
      lista.push(texto);
    }
    mapa.set(campo, lista);
  }
  return mapa;
}
