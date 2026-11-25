import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ComprobantesPage } from './comprobantes-page';

describe('ComprobantesPage', () => {
  let fixture: ComponentFixture<ComprobantesPage>;
  let navegar: ReturnType<typeof vi.spyOn>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const consultar = (texto: string): void => {
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
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ComprobantesPage);
    fixture.detectChanges();
  });

  it('al enviar un número válido va al detalle (con espacios y minúsculas incluidos)', () => {
    consultar(' 20000000001-01-f001-94338240 ');
    expect(navegar).toHaveBeenCalledWith(['/comprobantes', '20000000001-01-F001-94338240']);
  });

  it('con un formato inválido muestra el error y no navega', () => {
    consultar('F001-12');
    expect(navegar).not.toHaveBeenCalled();
    expect(raiz().querySelector('.error')?.textContent).toContain('RUC-TIPO-SERIE-NUMERO');
  });

  it('sin historial muestra el mensaje vacío', () => {
    expect(raiz().querySelector('.vacio h2')?.textContent).toContain('Aún no emitiste comprobantes');
  });
});
