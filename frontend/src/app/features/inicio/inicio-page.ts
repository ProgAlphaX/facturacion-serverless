import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { EstadoComprobante, ETIQUETA_TIPO } from '../../core/models/comprobante';
import { ConteoPorEstado, ResumenComprobante } from '../../core/models/listado';
import { AuthService } from '../../core/services/auth.service';
import { ComprobantesService } from '../../core/services/comprobantes.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { StatCard, TonoStat } from '../../shared/ui/stat-card/stat-card';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';

interface Tarjeta {
  readonly etiqueta: string;
  readonly valor: number;
  readonly icono: string;
  readonly tono: TonoStat;
  /** Filtro con el que se abre la lista al pulsar la tarjeta. */
  readonly estado: EstadoComprobante | null;
}

const ULTIMOS = 5;

@Component({
  selector: 'fn-inicio-page',
  imports: [DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatIconModule, EmptyState, Skeleton, StatCard, StatusPill],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fn-page' },
})
export class InicioPage {
  private readonly comprobantes = inject(ComprobantesService);

  protected readonly auth = inject(AuthService);
  protected readonly hoy = new Date();
  protected readonly etiquetaTipo = ETIQUETA_TIPO;
  protected readonly resumen = signal<ConteoPorEstado | null>(null);
  protected readonly ultimos = signal<readonly ResumenComprobante[]>([]);
  protected readonly cargando = signal(true);
  protected readonly aviso = signal<string | null>(null);

  protected readonly tarjetas = computed<readonly Tarjeta[]>(() => {
    const r = this.resumen();
    if (r === null) {
      return [];
    }
    const total = r.PROCESANDO + r.ACEPTADO + r.RECHAZADO + r.ERROR_ENVIO;
    return [
      { etiqueta: 'Emitidos', valor: total, icono: 'receipt_long', tono: 'TOTAL', estado: null },
      { etiqueta: 'Aceptados', valor: r.ACEPTADO, icono: 'check_circle', tono: 'ACEPTADO', estado: 'ACEPTADO' },
      { etiqueta: 'Rechazados', valor: r.RECHAZADO, icono: 'cancel', tono: 'RECHAZADO', estado: 'RECHAZADO' },
      { etiqueta: 'Error de envío', valor: r.ERROR_ENVIO, icono: 'cloud_off', tono: 'ERROR_ENVIO', estado: 'ERROR_ENVIO' },
    ];
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.aviso.set(null);
    this.comprobantes.listar({ limite: ULTIMOS }).subscribe((resultado) => {
      this.cargando.set(false);
      if (resultado.resultado === 'LISTADO') {
        this.resumen.set(resultado.pagina.resumen);
        this.ultimos.set(resultado.pagina.comprobantes);
      } else {
        this.aviso.set('No se pudo traer el resumen. Revisa que la API esté encendida.');
      }
    });
  }
}
