import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { interpretarFallo, interpretarRespuesta } from './emision';

const CDR = { codigo: '0', descripcion: 'Aceptado (prueba)', observaciones: [], estado: 'ACEPTADO' };

describe('interpretarRespuesta', () => {
  it('201 ACEPTADO trae id, hash y CDR', () => {
    expect(interpretarRespuesta(201, { http: 201, estado: 'ACEPTADO', id: 'X-1', hash: 'abc', cdr: CDR })).toEqual({
      resultado: 'ACEPTADO',
      id: 'X-1',
      hash: 'abc',
      cdr: { codigo: '0', descripcion: 'Aceptado (prueba)', observaciones: [] },
    });
  });

  it('201 RECHAZADO conserva el código del CDR', () => {
    const resultado = interpretarRespuesta(201, {
      estado: 'RECHAZADO',
      id: 'X-2',
      hash: 'h',
      cdr: { codigo: '2017', descripcion: 'RUC no activo', observaciones: ['detalle'] },
    });
    expect(resultado).toMatchObject({ resultado: 'RECHAZADO', cdr: { codigo: '2017', observaciones: ['detalle'] } });
  });

  it('400 INVALIDO trae la lista de reglas', () => {
    const errores = [{ regla: 'R08', campo: 'cliente', mensaje: 'Falta DNI' }];
    expect(interpretarRespuesta(400, { estado: 'INVALIDO', errores })).toEqual({ resultado: 'INVALIDO', errores });
  });

  it('409 DUPLICADO y 502 ERROR_ENVIO traen el id', () => {
    expect(interpretarRespuesta(409, { estado: 'DUPLICADO', id: 'X-3', regla: 'R12' })).toEqual({ resultado: 'DUPLICADO', id: 'X-3' });
    expect(interpretarRespuesta(502, { estado: 'ERROR_ENVIO', id: 'X-4' })).toEqual({ resultado: 'ERROR_ENVIO', id: 'X-4' });
  });

  it('429 y 401 se distinguen por el código', () => {
    expect(interpretarRespuesta(429, { message: 'Too Many Requests' })).toEqual({ resultado: 'LIMITE_PETICIONES' });
    expect(interpretarRespuesta(401, { message: 'Unauthorized' })).toEqual({ resultado: 'SESION_EXPIRADA' });
  });

  it('un error del flujo o de API Gateway llega como mensaje', () => {
    expect(interpretarRespuesta(502, { estado: 'ERROR_FLUJO', mensaje: 'El flujo no terminó' })).toEqual({
      resultado: 'ERROR',
      mensaje: 'El flujo no terminó',
    });
    expect(interpretarRespuesta(400, { message: 'Invalid request body' })).toEqual({ resultado: 'ERROR', mensaje: 'Invalid request body' });
  });

  it('un cuerpo inesperado no rompe nada', () => {
    expect(interpretarRespuesta(200, null).resultado).toBe('ERROR');
    expect(interpretarRespuesta(201, { estado: 'ACEPTADO' }).resultado).toBe('ERROR');
    expect(interpretarRespuesta(400, { estado: 'INVALIDO', errores: [{ x: 1 }, 'raro'] })).toEqual({ resultado: 'INVALIDO', errores: [] });
  });
});

describe('interpretarFallo', () => {
  it('distingue tiempo agotado, falta de red y errores HTTP', () => {
    expect(interpretarFallo(new TimeoutError())).toEqual({ resultado: 'TIEMPO_AGOTADO' });
    expect(interpretarFallo(new HttpErrorResponse({ status: 0 }))).toEqual({ resultado: 'SIN_CONEXION' });
    expect(interpretarFallo(new HttpErrorResponse({ status: 409, error: { estado: 'DUPLICADO', id: 'X' } }))).toEqual({
      resultado: 'DUPLICADO',
      id: 'X',
    });
    expect(interpretarFallo(new Error('raro')).resultado).toBe('ERROR');
  });
});
