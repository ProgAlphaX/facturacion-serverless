import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { HistorialService } from '../../core/services/historial.service';

interface Tarjeta {
  readonly etiqueta: string;
  readonly valor: number;
  readonly color: string;
}

@Component({
  selector: 'fn-inicio-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  private readonly historial = inject(HistorialService);

  protected readonly tarjetas = computed<readonly Tarjeta[]>(() => {
    const r = this.historial.resumen();
    return [
      { etiqueta: 'Emitidos', valor: r.total, color: 'var(--fn-ink)' },
      { etiqueta: 'Aceptados', valor: r.aceptados, color: 'var(--fn-aceptado)' },
      { etiqueta: 'Rechazados', valor: r.rechazados, color: 'var(--fn-rechazado)' },
      { etiqueta: 'Con error de envío', valor: r.conError, color: 'var(--fn-error-envio)' },
    ];
  });
}
