import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { interpretarDescarga, interpretarFalloDescarga, mensajeDeDescarga } from './descarga';
import { interpretarFalloListado, interpretarListado, leerPagina } from './listado';

/** Forma real de lo que devolvió AWS en la prueba de la Fase 6. */
const FILA = {
  id: '20000000001-01-F001-99657981',
  tipo: '01',
  serie: 'F001',
  numero: 99657981,
  estado: 'ACEPTADO',
  clienteNombre: 'CLIENTE DEMO S.A.',
  moneda: 'PEN',
  total: 295,
  fechaEmision: '2026-11-24',
  creadoEn: '2026-11-25T05:28:18.031Z',
  actualizadoEn: '2026-11-25T05:28:19.000Z',
  tienePdf: true,
};
const PAGINA = { comprobantes: [FILA], total: 49, siguiente: 1, resumen: { PROCESANDO: 1, ACEPTADO: 32, RECHAZADO: 15, ERROR_ENVIO: 1 } };

describe('leerPagina', () => {
  it('lee la página completa con su resumen por estado', () => {
    const pagina = leerPagina(PAGINA);
    expect(pagina?.comprobantes[0]).toMatchObject({ id: FILA.id, estado: 'ACEPTADO', tienePdf: true, total: 295 });
    expect(pagina?.total).toBe(49);
    expect(pagina?.siguiente).toBe(1);
    expect(pagina?.resumen).toEqual({ PROCESANDO: 1, ACEPTADO: 32, RECHAZADO: 15, ERROR_ENVIO: 1 });
  });

  it('acepta siguiente null (última página) y una lista vacía', () => {
    expect(leerPagina({ ...PAGINA, comprobantes: [], total: 0, siguiente: null })?.siguiente).toBeNull();
  });

  it('devuelve null ante datos incompletos o de tipo equivocado', () => {
    expect(leerPagina(null)).toBeNull();
    expect(leerPagina({ ...PAGINA, resumen: { ACEPTADO: 1 } })).toBeNull();
    expect(leerPagina({ ...PAGINA, siguiente: 'x' })).toBeNull();
    expect(leerPagina({ ...PAGINA, comprobantes: [{ ...FILA, estado: 'INVENTADO' }] })).toBeNull();
    expect(leerPagina({ ...PAGINA, comprobantes: [{ ...FILA, tienePdf: 'si' }] })).toBeNull();
    expect(leerPagina({ ...PAGINA, comprobantes: 'no es lista' })).toBeNull();
  });
});

describe('interpretarListado', () => {
  it('200 con una página válida es LISTADO', () => {
    expect(interpretarListado(200, PAGINA).resultado).toBe('LISTADO');
  });

  it('distingue 401, 429, 400 con mensaje y cuerpos raros', () => {
    expect(interpretarListado(401, {}).resultado).toBe('SESION_EXPIRADA');
    expect(interpretarListado(429, {}).resultado).toBe('LIMITE_PETICIONES');
    expect(interpretarListado(400, { error: 'El estado debe ser uno de: X' })).toEqual({ resultado: 'ERROR', mensaje: 'El estado debe ser uno de: X' });
    expect(interpretarListado(200, { algo: 1 }).resultado).toBe('ERROR');
  });

  it('traduce fallos de red y tiempo agotado', () => {
    expect(interpretarFalloListado(new TimeoutError()).resultado).toBe('TIEMPO_AGOTADO');
    expect(interpretarFalloListado(new HttpErrorResponse({ status: 0 })).resultado).toBe('SIN_CONEXION');
    expect(interpretarFalloListado(new HttpErrorResponse({ status: 429 })).resultado).toBe('LIMITE_PETICIONES');
  });
});

describe('interpretarDescarga', () => {
  const LISTA = { url: 'https://bucket.s3.amazonaws.com/pdf/x.pdf?X-Amz-Signature=abc', nombre: 'x.pdf', expiraEnSegundos: 300 };

  it('200 con una URL https es LISTA', () => {
    expect(interpretarDescarga(200, LISTA)).toEqual({ resultado: 'LISTA', ...LISTA });
  });

  it('rechaza URLs que no sean https (nunca se abre algo raro)', () => {
    expect(interpretarDescarga(200, { ...LISTA, url: 'javascript:alert(1)' }).resultado).toBe('ERROR');
    expect(interpretarDescarga(200, { ...LISTA, url: 'http://inseguro.com/x' }).resultado).toBe('ERROR');
    expect(interpretarDescarga(200, { ...LISTA, expiraEnSegundos: '300' }).resultado).toBe('ERROR');
  });

  it('404 es NO_DISPONIBLE con el motivo que da el backend', () => {
    const r = interpretarDescarga(404, { error: 'El comprobante X no tiene archivo pdf' });
    expect(r).toEqual({ resultado: 'NO_DISPONIBLE', mensaje: 'El comprobante X no tiene archivo pdf' });
    expect(mensajeDeDescarga(r as Exclude<typeof r, { resultado: 'LISTA' }>)).toContain('no tiene archivo pdf');
  });

  it('traduce 401, 429 y fallos de red', () => {
    expect(interpretarDescarga(401, {}).resultado).toBe('SESION_EXPIRADA');
    expect(interpretarDescarga(429, {}).resultado).toBe('LIMITE_PETICIONES');
    expect(interpretarFalloDescarga(new HttpErrorResponse({ status: 0 })).resultado).toBe('SIN_CONEXION');
    expect(interpretarFalloDescarga(new TimeoutError()).resultado).toBe('TIEMPO_AGOTADO');
  });
});
