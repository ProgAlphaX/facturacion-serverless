const { esRucValido, esDniValido } = require('../src/reglas/ruc');
const { validarEsquema } = require('../src/reglas/esquema');
const { validarReglas, calcularTotales } = require('../src/reglas/reglas-negocio');

const HOY = '2026-10-17';
const EMISOR = '20000000001';

function factura(cambios = {}) {
  return {
    tipo: '01',
    serie: 'F001',
    numero: 1,
    fechaEmision: HOY,
    moneda: 'PEN',
    cliente: { tipoDoc: '6', numDoc: '20100070970', nombre: 'CLIENTE DEMO S.A.' },
    items: [{ descripcion: 'Servicio de consultoría', unidad: 'ZZ', cantidad: 2, valorUnitario: 100 }],
    totales: { valorVenta: 200, igv: 36, total: 236 },
    ...cambios,
  };
}

function boleta(total, cliente) {
  const valorVenta = Math.round((total / 1.18) * 100) / 100;
  const igv = Math.round((total - valorVenta) * 100) / 100;
  return factura({
    tipo: '03',
    serie: 'B001',
    cliente,
    items: [{ descripcion: 'Producto', unidad: 'NIU', cantidad: 1, valorUnitario: valorVenta }],
    totales: { valorVenta, igv, total: Math.round((valorVenta + igv) * 100) / 100 },
  });
}

const reglas = (c) => validarReglas(c, { emisorRuc: EMISOR, hoy: HOY }).map((e) => e.regla);

describe('RUC y DNI', () => {
  test.each(['20000000001', '20100070970', '10467793549'])('RUC válido %s', (ruc) => {
    expect(esRucValido(ruc)).toBe(true);
  });

  test.each(['20000000002', '30000000001', '2010007097', 'ABCDEFGHIJK', 20100070970])(
    'RUC inválido %s',
    (ruc) => expect(esRucValido(ruc)).toBe(false),
  );

  test('DNI de 8 dígitos', () => {
    expect(esDniValido('12345678')).toBe(true);
    expect(esDniValido('1234567')).toBe(false);
  });
});

describe('Esquema del JSON', () => {
  test('acepta una factura completa', () => {
    expect(validarEsquema(factura()).errores).toEqual([]);
  });

  test('rechaza campos faltantes indicando cuáles', () => {
    const { errores } = validarEsquema({ tipo: '01' });
    const campos = errores.map((e) => e.campo);
    expect(campos).toEqual(expect.arrayContaining(['serie', 'numero', 'cliente', 'items', 'totales']));
  });
});

describe('Reglas de negocio SUNAT', () => {
  test('una factura correcta no tiene errores', () => {
    expect(reglas(factura())).toEqual([]);
  });

  test('R01 tipo inválido', () => {
    expect(reglas(factura({ tipo: '05' }))).toContain('R01');
  });

  test('R02 factura con serie de boleta', () => {
    expect(reglas(factura({ serie: 'B001' }))).toContain('R02');
  });

  test('R03 número fuera de rango', () => {
    expect(reglas(factura({ numero: 0 }))).toContain('R03');
  });

  test('R04 fecha futura y fecha muy antigua', () => {
    expect(reglas(factura({ fechaEmision: '2026-10-18' }))).toContain('R04');
    expect(reglas(factura({ fechaEmision: '2026-10-10' }))).toContain('R04');
    expect(reglas(factura({ fechaEmision: '2026-10-14' }))).not.toContain('R04');
  });

  test('R05 moneda no permitida', () => {
    expect(reglas(factura({ moneda: 'EUR' }))).toContain('R05');
  });

  test('R06 RUC del emisor inválido', () => {
    const errores = validarReglas(factura(), { emisorRuc: '20000000002', hoy: HOY });
    expect(errores.map((e) => e.regla)).toContain('R06');
  });

  test('R07 factura a un cliente con DNI', () => {
    const c = factura({ cliente: { tipoDoc: '1', numDoc: '12345678', nombre: 'Juan Pérez' } });
    expect(reglas(c)).toContain('R07');
  });

  test('R07 factura con RUC de cliente mal escrito', () => {
    const c = factura({ cliente: { tipoDoc: '6', numDoc: '20100070971', nombre: 'X' } });
    expect(reglas(c)).toContain('R07');
  });

  test('R08 boleta mayor a S/ 700 sin DNI', () => {
    expect(reglas(boleta(900, { tipoDoc: '0', numDoc: '-', nombre: 'Varios' }))).toContain('R08');
  });

  test('R08 boleta mayor a S/ 700 con DNI es válida', () => {
    expect(reglas(boleta(900, { tipoDoc: '1', numDoc: '12345678', nombre: 'Juan Pérez' }))).toEqual([]);
  });

  test('R08 boleta menor a S/ 700 sin DNI es válida', () => {
    expect(reglas(boleta(500, { tipoDoc: '0', numDoc: '-', nombre: 'Varios' }))).toEqual([]);
  });

  test('R09 sin ítems y con cantidad 0', () => {
    expect(reglas(factura({ items: [], totales: { valorVenta: 0, igv: 0, total: 0 } }))).toContain('R09');
    const c = factura({ items: [{ descripcion: 'X', unidad: 'NIU', cantidad: 0, valorUnitario: 100 }] });
    expect(reglas(c)).toContain('R09');
  });

  test('R10 IGV mal calculado', () => {
    expect(reglas(factura({ totales: { valorVenta: 200, igv: 30, total: 230 } }))).toContain('R10');
  });

  test('R11 total que no cuadra', () => {
    expect(reglas(factura({ totales: { valorVenta: 200, igv: 36, total: 250 } }))).toContain('R11');
  });

  test('R11 valor de venta distinto a la suma de ítems', () => {
    expect(reglas(factura({ totales: { valorVenta: 300, igv: 54, total: 354 } }))).toContain('R11');
  });

  test('devuelve todos los errores juntos', () => {
    const c = factura({ serie: 'X1', moneda: 'EUR', totales: { valorVenta: 200, igv: 10, total: 999 } });
    expect(reglas(c)).toEqual(expect.arrayContaining(['R02', 'R05', 'R10', 'R11']));
  });

  test('calcularTotales aplica IGV 18%', () => {
    expect(calcularTotales([{ cantidad: 3, valorUnitario: 33.33 }])).toEqual({ valorVenta: 99.99, igv: 18, total: 117.99 });
  });
});
