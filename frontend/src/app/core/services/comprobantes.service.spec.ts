import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { entorno } from '../config/entorno';
import { crearEjemplo } from '../ejemplos/ejemplos-comprobante';
import { ResultadoConsulta } from '../models/consulta';
import { ResultadoEmision } from '../models/emision';
import { ComprobantesService } from './comprobantes.service';

const RUTA = `${entorno.apiBase}/comprobantes`;
const COMPROBANTE = crearEjemplo('factura-valida', '2026-11-24', 90_000_001);

describe('ComprobantesService.emitir', () => {
  let servicio: ComprobantesService;
  let http: HttpTestingController;
  let resultado: ResultadoEmision | undefined;

  beforeEach(() => {
    resultado = undefined;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ComprobantesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  const emitir = (): void => {
    servicio.emitir(COMPROBANTE).subscribe((r) => {
      resultado = r;
    });
  };

  it('envía el comprobante tal cual y traduce un 201 ACEPTADO', () => {
    emitir();
    const peticion = http.expectOne(RUTA);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(COMPROBANTE);
    peticion.flush(
      { http: 201, estado: 'ACEPTADO', id: 'X-1', hash: 'h', cdr: { codigo: '0', descripcion: 'ok', observaciones: [] } },
      { status: 201, statusText: 'Created' },
    );
    expect(resultado?.resultado).toBe('ACEPTADO');
  });

  it('traduce un 409 a DUPLICADO sin lanzar error', () => {
    emitir();
    http.expectOne(RUTA).flush({ estado: 'DUPLICADO', id: 'X-2', regla: 'R12' }, { status: 409, statusText: 'Conflict' });
    expect(resultado).toEqual({ resultado: 'DUPLICADO', id: 'X-2' });
  });

  it('traduce un 429 a LIMITE_PETICIONES', () => {
    emitir();
    http.expectOne(RUTA).flush({ message: 'Too Many Requests' }, { status: 429, statusText: 'Too Many Requests' });
    expect(resultado).toEqual({ resultado: 'LIMITE_PETICIONES' });
  });

  it('traduce un fallo de red a SIN_CONEXION', () => {
    emitir();
    http.expectOne(RUTA).error(new ProgressEvent('error'));
    expect(resultado).toEqual({ resultado: 'SIN_CONEXION' });
  });
});

describe('ComprobantesService.consultar', () => {
  let servicio: ComprobantesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ComprobantesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('pide el comprobante por su número y traduce un 404 sin lanzar error', () => {
    let resultado: ResultadoConsulta | undefined;
    servicio.consultar('20000000001-01-F001-00000001').subscribe((r) => {
      resultado = r;
    });
    const peticion = http.expectOne(`${entorno.apiBase}/comprobantes/20000000001-01-F001-00000001`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ error: 'No existe el comprobante' }, { status: 404, statusText: 'Not Found' });
    expect(resultado).toEqual({ resultado: 'NO_EXISTE', mensaje: 'No existe el comprobante' });
  });
});
