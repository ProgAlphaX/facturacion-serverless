import { ClaveEjemplo, crearEjemplo } from '../ejemplos/ejemplos-comprobante';
import { agruparPorCampo, calcularTotales, esRucValido, hoyEnLima, validarBorrador } from './reglas-comprobante';

const HOY = '2026-11-24';

const reglasDe = (clave: ClaveEjemplo): string[] => validarBorrador(crearEjemplo(clave, HOY, 90_000_001), HOY).map((e) => e.regla);

describe('reglas del comprobante (copia local de R01–R12)', () => {
  it('los ejemplos válidos no incumplen ninguna regla', () => {
    for (const clave of ['factura-valida', 'boleta-valida', 'factura-dolares', 'ruc-inactivo'] as const) {
      expect(reglasDe(clave)).toEqual([]);
    }
  });

  it('detecta cada ejemplo inválido con la regla esperada', () => {
    expect(reglasDe('ruc-invalido')).toEqual(['R07']);
    expect(reglasDe('serie-incorrecta')).toEqual(['R02']);
    expect(reglasDe('boleta-sin-dni')).toEqual(['R08']);
    expect(reglasDe('fecha-futura')).toEqual(['R04']);
    expect(reglasDe('cantidad-cero')).toContain('R09');
  });

  it('rechaza fechas con más de 3 días de antigüedad y acepta 3', () => {
    const base = crearEjemplo('factura-valida', HOY, 1);
    expect(validarBorrador({ ...base, fechaEmision: '2026-11-21' }, HOY)).toEqual([]);
    expect(validarBorrador({ ...base, fechaEmision: '2026-11-20' }, HOY).map((e) => e.regla)).toEqual(['R04']);
  });

  it('rechaza una fecha que no existe', () => {
    const base = crearEjemplo('factura-valida', HOY, 1);
    expect(validarBorrador({ ...base, fechaEmision: '2026-02-30' }, HOY).map((e) => e.regla)).toEqual(['R04']);
  });

  it('exige número entre 1 y 99999999', () => {
    const base = crearEjemplo('factura-valida', HOY, 1);
    expect(validarBorrador({ ...base, numero: 0 }, HOY).map((e) => e.regla)).toEqual(['R03']);
    expect(validarBorrador({ ...base, numero: 100_000_000 }, HOY).map((e) => e.regla)).toEqual(['R03']);
  });

  it('detecta totales que no cuadran (R10 y R11)', () => {
    const base = crearEjemplo('factura-valida', HOY, 1);
    const reglas = validarBorrador({ ...base, totales: { valorVenta: 250, igv: 40, total: 295 } }, HOY).map((e) => e.regla);
    expect(reglas).toContain('R10');
    expect(reglas).toContain('R11');
  });

  it('pide nombre del cliente y descripción de los ítems', () => {
    const base = crearEjemplo('factura-valida', HOY, 1);
    const errores = validarBorrador(
      { ...base, cliente: { ...base.cliente, nombre: ' ' }, items: [{ descripcion: '', unidad: 'ZZ', cantidad: 1, valorUnitario: 10 }] },
      HOY,
    );
    expect(errores.map((e) => e.campo)).toEqual(expect.arrayContaining(['cliente.nombre', 'items.0.descripcion']));
  });

  it('calcula valor de venta, IGV y total como el backend', () => {
    expect(calcularTotales([{ descripcion: 'a', unidad: 'ZZ', cantidad: 3, valorUnitario: 33.33 }])).toEqual({
      valorVenta: 99.99,
      igv: 18,
      total: 117.99,
    });
  });

  it('valida el dígito verificador del RUC', () => {
    expect(esRucValido('20100070970')).toBe(true);
    expect(esRucValido('20100070971')).toBe(false);
    expect(esRucValido('2010007097')).toBe(false);
  });

  it('agrupa los mensajes por campo', () => {
    const mapa = agruparPorCampo([
      { regla: 'R09', campo: 'items.0.cantidad', mensaje: 'La cantidad debe ser mayor a 0' },
      { regla: 'ESQUEMA', campo: 'cliente.nombre', mensaje: 'Escribe el nombre' },
    ]);
    expect(mapa.get('items.0.cantidad')).toEqual(['R09: La cantidad debe ser mayor a 0']);
    expect(mapa.get('cliente.nombre')).toEqual(['Escribe el nombre']);
  });

  it('no repite el mismo aviso si el servidor y la revisión en vivo coinciden', () => {
    const mapa = agruparPorCampo([
      { regla: 'R08', campo: 'cliente', mensaje: 'Falta DNI' },
      { regla: 'R08', campo: 'cliente', mensaje: 'Falta DNI' },
    ]);
    expect(mapa.get('cliente')).toEqual(['R08: Falta DNI']);
  });

  it('da la fecha de Lima, no la UTC', () => {
    // 2026-11-25 03:00 UTC sigue siendo 24 de noviembre en Lima (UTC-5)
    expect(hoyEnLima(new Date('2026-11-25T03:00:00Z'))).toBe('2026-11-24');
  });
});
