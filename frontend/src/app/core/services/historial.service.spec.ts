import { TestBed } from '@angular/core/testing';

import { crearEjemplo } from '../ejemplos/ejemplos-comprobante';
import { ComprobanteGuardado } from '../models/consulta';
import { HistorialService, MAXIMO_ENTRADAS } from './historial.service';

const EMITIDO = crearEjemplo('factura-valida', '2026-11-24', 90_000_001);
const CDR = { codigo: '0', descripcion: 'ok', observaciones: [] };

function servicio(): HistorialService {
  TestBed.resetTestingModule();
  return TestBed.inject(HistorialService);
}

describe('HistorialService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda lo emitido con su estado y lo recuerda al recargar', () => {
    const h = servicio();
    h.registrarEmision(EMITIDO, { resultado: 'ACEPTADO', id: 'A-1', hash: 'h', cdr: CDR });

    expect(h.entradas()).toHaveLength(1);
    expect(h.entradas()[0]).toMatchObject({ id: 'A-1', estado: 'ACEPTADO', total: 295, clienteNombre: 'CLIENTE DEMO S.A.' });
    expect(servicio().entradas()[0]?.id).toBe('A-1');
  });

  it('no guarda lo que no tiene número propio (inválido, duplicado, 429...)', () => {
    const h = servicio();
    h.registrarEmision(EMITIDO, { resultado: 'INVALIDO', errores: [] });
    h.registrarEmision(EMITIDO, { resultado: 'DUPLICADO', id: 'A-1' });
    h.registrarEmision(EMITIDO, { resultado: 'LIMITE_PETICIONES' });
    expect(h.entradas()).toHaveLength(0);
  });

  it('guarda también RECHAZADO y ERROR_ENVIO', () => {
    const h = servicio();
    h.registrarEmision(EMITIDO, { resultado: 'RECHAZADO', id: 'A-2', hash: 'h', cdr: CDR });
    h.registrarEmision(EMITIDO, { resultado: 'ERROR_ENVIO', id: 'A-3' });
    expect(h.entradas().map((e) => e.estado)).toEqual(['ERROR_ENVIO', 'RECHAZADO']);
  });

  it('una consulta actualiza el estado sin reordenar ni duplicar', () => {
    const h = servicio();
    h.registrarEmision(EMITIDO, { resultado: 'ERROR_ENVIO', id: 'A-3' });
    h.registrarEmision(EMITIDO, { resultado: 'ACEPTADO', id: 'A-4', hash: 'h', cdr: CDR });
    const registradoEn = h.entradas()[1]?.registradoEn;

    const guardado: ComprobanteGuardado = { ...EMITIDO, id: 'A-3', estado: 'ACEPTADO', creadoEn: '', actualizadoEn: '' };
    h.registrarConsulta(guardado);

    expect(h.entradas().map((e) => [e.id, e.estado])).toEqual([
      ['A-4', 'ACEPTADO'],
      ['A-3', 'ACEPTADO'],
    ]);
    expect(h.entradas()[1]?.registradoEn).toBe(registradoEn);
  });

  it('consultar un número que no estaba lo agrega al principio', () => {
    const h = servicio();
    h.registrarEmision(EMITIDO, { resultado: 'ACEPTADO', id: 'A-4', hash: 'h', cdr: CDR });
    h.registrarConsulta({ ...EMITIDO, id: 'POSTMAN-1', estado: 'RECHAZADO', creadoEn: '', actualizadoEn: '' });
    expect(h.entradas()[0]?.id).toBe('POSTMAN-1');
  });

  it('calcula el resumen por estado', () => {
    const h = servicio();
    h.registrarEmision(EMITIDO, { resultado: 'ACEPTADO', id: 'A-1', hash: 'h', cdr: CDR });
    h.registrarEmision(EMITIDO, { resultado: 'ACEPTADO', id: 'A-2', hash: 'h', cdr: CDR });
    h.registrarEmision(EMITIDO, { resultado: 'RECHAZADO', id: 'A-3', hash: 'h', cdr: CDR });
    h.registrarEmision(EMITIDO, { resultado: 'ERROR_ENVIO', id: 'A-4' });
    expect(h.resumen()).toEqual({ total: 4, aceptados: 2, rechazados: 1, enProceso: 0, conError: 1 });
  });

  it('quita una fila, vacía todo y respeta el máximo', () => {
    const h = servicio();
    for (let i = 0; i < MAXIMO_ENTRADAS + 5; i++) {
      h.registrarEmision(EMITIDO, { resultado: 'ERROR_ENVIO', id: `ID-${i}` });
    }
    expect(h.entradas()).toHaveLength(MAXIMO_ENTRADAS);
    h.quitar(`ID-${MAXIMO_ENTRADAS + 4}`);
    expect(h.entradas()).toHaveLength(MAXIMO_ENTRADAS - 1);
    h.vaciar();
    expect(servicio().entradas()).toHaveLength(0);
  });

  it('ignora datos dañados en el almacenamiento', () => {
    localStorage.setItem('fn.historial', '{no es json');
    expect(servicio().entradas()).toEqual([]);
    localStorage.setItem('fn.historial', JSON.stringify([{ id: 'x' }, 5]));
    expect(servicio().entradas()).toEqual([]);
  });
});
