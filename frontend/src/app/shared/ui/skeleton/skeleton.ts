import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Barras grises animadas mientras llega un dato o un bloque diferido. */
@Component({
  selector: 'fn-skeleton',
  template: `
    @for (fila of lista(); track fila) {
      <span [style.height.px]="alto()"></span>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 10px;
      padding: 4px 0;
    }

    span {
      display: block;
      border-radius: 12px;
      background: linear-gradient(90deg, #e9ebf4 25%, #f6f7fc 50%, #e9ebf4 75%);
      background-size: 200% 100%;
      animation: brillo 1.3s linear infinite;
    }

    @keyframes brillo {
      to {
        background-position: -200% 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Cargando' },
})
export class Skeleton {
  readonly filas = input(3);
  readonly alto = input(18);
  protected readonly lista = computed(() => Array.from({ length: this.filas() }, (_, i) => i));
}
