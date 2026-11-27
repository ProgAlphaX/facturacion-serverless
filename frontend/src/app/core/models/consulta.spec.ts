import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { FORMATO_ID, interpretarConsulta, interpretarFalloConsulta, leerComprobante, normalizarId } from './consulta';

/** Registro igual al que devolvió AWS para una factura aceptada (GET /comprobantes/{id}). */
const REGISTRO = {
  actualizadoEn: '2026-11-25T04:33:01.470Z',
  archivos: { cdr: 'cdr/R-20000000001-01-F001-94338240.zip', xml: 'firmados/20000000001-01-F001-94338240.xml' },
  cdr: { codigo: '0', descripcion: 'La Factura ha sido aceptada', observaciones: [] },
  cliente: { nombre: 'CLIENTE DEMO S.A.', numDoc: '20100070970', tipoDoc: '6' },
  creadoEn: '2026-11-25T04:32:55.141Z',
  estado: 'ACEPTADO',
  fechaEmision: '2026-11-24',
  hash: 'oZDN0eIU6/3x',
  id: '20000000001-01-F001-94338240',
  items: [{ cantidad: 1, descripcion: 'x', unidad: 'ZZ', valorUnitario: 100 }],
  moneda: 'PEN',
  numero: 94338240,
  serie: 'F001',
  tipo: '01',
  totales: { igv: 18, total: 118, valorVenta: 100 },
};

describe('leerComprobante', () => {
  it('lee un registro completo de DynamoDB', () => {
    const c = leerComprobante(REGISTRO);
    expect(c).toMatchObject({ id: REGISTRO.id, estado: 'ACEPTADO', hash: 'oZDN0eIU6/3x', totales: { total: 118 } });
    expect(c?.archivos).toEqual({ cdr: REGISTRO.archivos.cdr, xml: REGISTRO.archivos.xml });
    expect(c?.archivos?.pdf).toBeUndefined();
    expect(c?.cdr?.codigo).toBe('0');
  });

  it('lee el PDF cuando ya se generó y el error de un ERROR_ENVIO', () => {
    const conPdf = leerComprobante({ ...REGISTRO, archivos: { ...REGISTRO.archivos, pdf: 'pdf/x.pdf' } });
    expect(conPdf?.archivos?.pdf).toBe('pdf/x.pdf');

    const conError = leerComprobante({ ...REGISTRO, estado: 'ERROR_ENVIO', error: 'States.TaskFailed', cdr: undefined, hash: undefined });
    expect(conError).toMatchObject({ estado: 'ERROR_ENVIO', error: 'States.TaskFailed' });
    expect(conError?.cdr).toBeUndefined();
  });

  it('devuelve null si falta algo esencial o tiene un tipo raro', () => {
    expect(leerComprobante(null)).toBeNull();
    expect(leerComprobante({ ...REGISTRO, estado: 'INVENTADO' })).toBeNull();
    expect(leerComprobante({ ...REGISTRO, totales: { igv: '18', total: 118, valorVenta: 100 } })).toBeNull();
    expect(leerComprobante({ ...REGISTRO, items: [{ descripcion: 'x' }] })).toBeNull();
    expect(leerComprobante({ ...REGISTRO, cliente: undefined })).toBeNull();
  });
});

describe('interpretarConsulta', () => {
  it('200 con un registro válido es ENCONTRADO', () => {
    expect(interpretarConsulta(200, REGISTRO).resultado).toBe('ENCONTRADO');
  });

  it('404 trae el mensaje del backend', () => {
    expect(interpretarConsulta(404, { error: 'No existe el comprobante X' })).toEqual({ resultado: 'NO_EXISTE', mensaje: 'No existe el comprobante X' });
  });

  it('distingue 401, 429 y respuestas raras', () => {
    expect(interpretarConsulta(401, {}).resultado).toBe('SESION_EXPIRADA');
    expect(interpretarConsulta(429, {}).resultado).toBe('LIMITE_PETICIONES');
    expect(interpretarConsulta(200, { algo: 1 }).resultado).toBe('ERROR');
    expect(interpretarConsulta(500, { message: 'Internal' })).toEqual({ resultado: 'ERROR', mensaje: 'Internal' });
  });

  it('traduce fallos de red y tiempo agotado', () => {
    expect(interpretarFalloConsulta(new TimeoutError()).resultado).toBe('TIEMPO_AGOTADO');
    expect(interpretarFalloConsulta(new HttpErrorResponse({ status: 0 })).resultado).toBe('SIN_CONEXION');
    expect(interpretarFalloConsulta(new HttpErrorResponse({ status: 404, error: { error: 'No existe' } })).resultado).toBe('NO_EXISTE');
  });
});

describe('número de comprobante', () => {
  it('acepta el formato RUC-TIPO-SERIE-NUMERO y rechaza lo demás', () => {
    expect(FORMATO_ID.test('20000000001-01-F001-94338240')).toBe(true);
    expect(FORMATO_ID.test('20000000001-03-B001-00000001')).toBe(true);
    expect(FORMATO_ID.test('20000000001-02-F001-00000001')).toBe(false);
    expect(FORMATO_ID.test('F001-1')).toBe(false);
  });

  it('limpia espacios y pasa a mayúsculas', () => {
    expect(normalizarId(' 20000000001-01-f001-00000001 ')).toBe('20000000001-01-F001-00000001');
  });
});
