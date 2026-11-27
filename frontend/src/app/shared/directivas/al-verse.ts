import { DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

/** Avisa cuando el elemento entra en pantalla; sirve para pedir la siguiente página sola. */
@Directive({ selector: '[fnAlVerse]' })
export class AlVerse {
  readonly fnAlVerse = output();

  constructor() {
    const elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destruir = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        return;
      }
      const observador = new IntersectionObserver((entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          this.fnAlVerse.emit();
        }
      });
      observador.observe(elemento);
      destruir.onDestroy(() => {
        observador.disconnect();
      });
    });
  }
}
