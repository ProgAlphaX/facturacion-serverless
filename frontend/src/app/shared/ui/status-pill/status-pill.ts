import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ETIQUETA_ESTADO, EstadoComprobante } from '../../../core/models/comprobante';

@Component({
  selector: 'fn-status-pill',
  template: '{{ etiqueta() }}',
  styleUrl: './status-pill.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"pill pill--" + estado()' },
})
export class StatusPill {
  readonly estado = input.required<EstadoComprobante>();

  protected readonly etiqueta = computed(() => ETIQUETA_ESTADO[this.estado()]);
}
