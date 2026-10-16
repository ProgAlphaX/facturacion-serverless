// R12 (no duplicados) no está aquí: la garantiza la escritura condicional en DynamoDB.
// Se devuelven todos los errores juntos para que la PYME corrija todo de una vez.

const { esRucValido, esDniValido } = require('./ruc');

const TASA_IGV = 0.18;
const TOLERANCIA = 0.01;
const MONTO_MAXIMO_BOLETA_SIN_DNI = 700;
const DIAS_MAXIMOS_ANTIGUEDAD = 3;

const TIPOS = { FACTURA: '01', BOLETA: '03' };
const TIPO_DOC = { DNI: '1', RUC: '6' };

const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const difiere = (a, b) => Math.abs(a - b) > TOLERANCIA + Number.EPSILON;

function hoyEnLima(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);
}

function diasEntre(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000;
}

function esFechaReal(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

function calcularTotales(items) {
  const valorVenta = redondear(
    items.reduce((acc, item) => acc + redondear(item.cantidad * item.valorUnitario), 0),
  );
  const igv = redondear(valorVenta * TASA_IGV);
  return { valorVenta, igv, total: redondear(valorVenta + igv) };
}

function validarReglas(c, { emisorRuc, hoy = hoyEnLima() }) {
  const errores = [];
  const error = (regla, campo, mensaje) => errores.push({ regla, campo, mensaje });

  const tipoValido = Object.values(TIPOS).includes(c.tipo);
  if (!tipoValido) {
    error('R01', 'tipo', 'El tipo debe ser 01 (factura) o 03 (boleta)');
  }

  if (c.tipo === TIPOS.FACTURA && !/^F[A-Z0-9]{3}$/.test(c.serie)) {
    error('R02', 'serie', 'La serie de una factura debe ser F + 3 caracteres (ej. F001)');
  }
  if (c.tipo === TIPOS.BOLETA && !/^B[A-Z0-9]{3}$/.test(c.serie)) {
    error('R02', 'serie', 'La serie de una boleta debe ser B + 3 caracteres (ej. B001)');
  }

  if (!Number.isInteger(c.numero) || c.numero < 1 || c.numero > 99999999) {
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

  if (!['PEN', 'USD'].includes(c.moneda)) {
    error('R05', 'moneda', 'La moneda debe ser PEN o USD');
  }

  if (!esRucValido(emisorRuc)) {
    error('R06', 'emisor', 'El RUC del emisor no es válido');
  }

  if (c.tipo === TIPOS.FACTURA) {
    if (c.cliente.tipoDoc !== TIPO_DOC.RUC || !esRucValido(c.cliente.numDoc)) {
      error('R07', 'cliente', 'Una factura requiere un cliente con RUC válido (tipoDoc 6)');
    }
  }

  if (c.tipo === TIPOS.BOLETA && c.totales.total > MONTO_MAXIMO_BOLETA_SIN_DNI) {
    if (c.cliente.tipoDoc !== TIPO_DOC.DNI || !esDniValido(c.cliente.numDoc)) {
      error('R08', 'cliente', `Una boleta mayor a S/ ${MONTO_MAXIMO_BOLETA_SIN_DNI} requiere DNI del cliente (tipoDoc 1, 8 dígitos)`);
    }
  }

  if (c.items.length === 0) {
    error('R09', 'items', 'El comprobante debe tener al menos un ítem');
  }
  c.items.forEach((item, i) => {
    if (!(item.cantidad > 0)) error('R09', `items.${i}.cantidad`, 'La cantidad debe ser mayor a 0');
    if (!(item.valorUnitario > 0)) error('R09', `items.${i}.valorUnitario`, 'El valor unitario debe ser mayor a 0');
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

module.exports = { validarReglas, calcularTotales, hoyEnLima, redondear, TIPOS, TASA_IGV };
