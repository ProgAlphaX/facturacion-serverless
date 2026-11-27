import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { entorno } from '../../core/config/entorno';
import { ComprobantesPage } from './comprobantes-page';

const RUTA = `${entorno.apiBase}/comprobantes`;
const RESUMEN = { PROCESANDO: 0, ACEPTADO: 2, RECHAZADO: 1, ERROR_ENVIO: 0 };
const fila = (n: number, estado: string, tienePdf: boolean): Record<string, unknown> => ({
  id: `20000000001-01-F001-${String(n).padStart(8, '0')}`,
  tipo: '01',
  serie: 'F001',
  numero: n,
  estado,
  clienteNombre: `CLIENTE ${n}`,
  moneda: 'PEN',
  total: 100,
  fechaEmision: '2026-11-24',
  creadoEn: '2026-11-25T05:00:00Z',
  actualizadoEn: '2026-11-25T05:00:00Z',
  tienePdf,
});

describe('ComprobantesPage', () => {
  let fixture: ComponentFixture<ComprobantesPage>;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const lista = (): TestRequest => http.expectOne((p) => p.url === RUTA);
  const responder = (filas: Record<string, unknown>[], extra: Record<string, unknown> = {}): void => {
    lista().flush({ comprobantes: filas, total: filas.length, siguiente: null, resumen: RESUMEN, ...extra });
    fixture.detectChanges();
  };
  const escribir = (texto: string): void => {
    const entrada = raiz().querySelector<HTMLInputElement>('input[formcontrolname="numero"]');
    if (entrada === null) {
      throw new Error('No se encontró la caja de consulta');
    }
    entrada.value = texto;
    entrada.dispatchEvent(new Event('input'));
    raiz().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ComprobantesPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('al abrir pide la primera página al backend y muestra las filas', () => {
    const peticion = lista();
    expect(peticion.request.params.get('limite')).toBe('25');
    peticion.flush({ comprobantes: [fila(1, 'ACEPTADO', true), fila(2, 'RECHAZADO', false)], total: 2, siguiente: null, resumen: RESUMEN });
    fixture.detectChanges();
    expect(raiz().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(raiz().querySelector('.conteo')?.textContent).toContain('Mostrando 2 de 2');
  });

  it('el botón de PDF solo está activo si el comprobante tiene PDF', () => {
    responder([fila(1, 'ACEPTADO', true), fila(2, 'RECHAZADO', false)]);
    const botones = raiz().querySelectorAll<HTMLButtonElement>('tbody tr button');
    expect(botones[0]?.disabled).toBe(false);
    expect(botones[1]?.disabled).toBe(true);
  });

  it('sin ningún comprobante invita a emitir uno', () => {
    responder([], { resumen: { PROCESANDO: 0, ACEPTADO: 0, RECHAZADO: 0, ERROR_ENVIO: 0 } });
    expect(raiz().querySelector('.vacio h2')?.textContent).toContain('Todavía no hay comprobantes');
  });

  it('si el filtro no encuentra nada lo dice sin invitar a emitir', () => {
    responder([], { total: 0 });
    expect(raiz().querySelector('.vacio h2')?.textContent).toContain('No hay comprobantes con ese estado');
  });

  it('al cambiar el filtro vuelve a pedir la lista con ese estado', () => {
    responder([fila(1, 'ACEPTADO', true)]);
    (fixture.componentInstance as unknown as { cambiarFiltro: (e: string) => void }).cambiarFiltro('RECHAZADO');
    expect(lista().request.params.get('estado')).toBe('RECHAZADO');
    http.verify();
  });

  it('"Cargar más" pide desde donde quedó y agrega las filas', () => {
    responder([fila(1, 'ACEPTADO', true)], { total: 2, siguiente: 1 });
    raiz().querySelector<HTMLButtonElement>('.mas button')?.click();
    const segunda = lista();
    expect(segunda.request.params.get('desde')).toBe('1');
    segunda.flush({ comprobantes: [fila(2, 'ACEPTADO', true)], total: 2, siguiente: null, resumen: RESUMEN });
    fixture.detectChanges();
    expect(raiz().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(raiz().querySelector('.mas')).toBeNull();
  });

  it('un fallo de la API muestra el aviso en vez de romper la pantalla', () => {
    lista().flush({ message: 'Too Many Requests' }, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(raiz().querySelector('.aviso')?.textContent).toContain('Demasiadas consultas');
  });

  it('al enviar un número válido va al detalle (con espacios y minúsculas incluidos)', () => {
    responder([]);
    escribir(' 20000000001-01-f001-94338240 ');
    expect(navegar).toHaveBeenCalledWith(['/comprobantes', '20000000001-01-F001-94338240']);
  });

  it('con un formato inválido muestra el error y no navega', () => {
    responder([]);
    escribir('F001-12');
    expect(navegar).not.toHaveBeenCalled();
    expect(raiz().querySelector('.error')?.textContent).toContain('RUC-TIPO-SERIE-NUMERO');
  });
});
