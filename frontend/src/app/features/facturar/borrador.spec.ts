import { ValorFormulario, aComprobante } from './borrador';

const VALOR: ValorFormulario = {
  tipo: '01',
  serie: ' f001 ',
  numero: 7,
  fechaEmision: '2026-11-24',
  moneda: 'PEN',
  cliente: { tipoDoc: '6', numDoc: ' 20100070970 ', nombre: ' CLIENTE DEMO S.A. ' },
  items: [
    { descripcion: ' Consultoría ', unidad: 'ZZ', cantidad: 2, valorUnitario: 100 },
    { descripcion: 'Soporte', unidad: 'ZZ', cantidad: 1, valorUnitario: 50 },
  ],
};

describe('aComprobante', () => {
  it('limpia espacios, pone la serie en mayúsculas y calcula los totales', () => {
    expect(aComprobante(VALOR)).toEqual({
      tipo: '01',
      serie: 'F001',
      numero: 7,
      fechaEmision: '2026-11-24',
      moneda: 'PEN',
      cliente: { tipoDoc: '6', numDoc: '20100070970', nombre: 'CLIENTE DEMO S.A.' },
      items: [
        { descripcion: 'Consultoría', unidad: 'ZZ', cantidad: 2, valorUnitario: 100 },
        { descripcion: 'Soporte', unidad: 'ZZ', cantidad: 1, valorUnitario: 50 },
      ],
      totales: { valorVenta: 250, igv: 45, total: 295 },
    });
  });

  it('los números vacíos pasan como 0 para que las reglas los señalen', () => {
    const comprobante = aComprobante({ ...VALOR, numero: null, items: [{ descripcion: 'x', unidad: 'NIU', cantidad: null, valorUnitario: null }] });
    expect(comprobante.numero).toBe(0);
    expect(comprobante.items[0]).toMatchObject({ cantidad: 0, valorUnitario: 0 });
    expect(comprobante.totales).toEqual({ valorVenta: 0, igv: 0, total: 0 });
  });
});
