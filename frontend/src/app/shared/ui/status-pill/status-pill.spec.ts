import { TestBed } from '@angular/core/testing';

import { EstadoComprobante } from '../../../core/models/comprobante';
import { StatusPill } from './status-pill';

describe('StatusPill', () => {
  const crear = (estado: EstadoComprobante): HTMLElement => {
    const fixture = TestBed.createComponent(StatusPill);
    fixture.componentRef.setInput('estado', estado);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('muestra la etiqueta y la clase del estado', () => {
    const el = crear('ERROR_ENVIO');
    expect(el.textContent.trim()).toBe('Error de envío');
    expect(el.classList).toContain('pill--ERROR_ENVIO');
  });

  it('muestra "Aceptado" para ACEPTADO', () => {
    expect(crear('ACEPTADO').textContent.trim()).toBe('Aceptado');
  });
});
