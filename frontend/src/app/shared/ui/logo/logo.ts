import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Marca de la aplicación: una nube con el visto de comprobante aceptado. */
@Component({
  selector: 'fn-logo',
  template: `
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path class="nube" d="M11 31a8 8 0 0 1-1.1-15.9A10.5 10.5 0 0 1 30 14a8.6 8.6 0 0 1-1.1 17Z" />
      <path class="visto" d="m14.5 22 4 4 7-7.5" />
    </svg>
  `,
  styles: `
    :host {
      display: grid;
      flex: none;
      place-items: center;
      width: var(--logo, 38px);
      height: var(--logo, 38px);
      border-radius: 30%;
      background: var(--logo-fondo, linear-gradient(135deg, #6b7cf5, #3b4fd8));
      box-shadow: 0 8px 18px -8px rgba(59, 79, 216, 0.7);
    }

    svg {
      width: 80%;
      height: 80%;
    }

    .nube {
      fill: var(--logo-nube, #ffffff);
    }

    .visto {
      fill: none;
      stroke: var(--logo-visto, #3b4fd8);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {}
