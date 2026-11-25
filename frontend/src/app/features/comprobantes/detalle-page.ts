import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Subject, map, merge, switchMap, take, timer } from 'rxjs';

import { ETIQUETA_DOCUMENTO, ETIQUETA_TIPO, ETIQUETA_UNIDAD } from '../../core/models/comprobante';
import { ComprobanteGuardado, ResultadoConsulta, normalizarId } from '../../core/models/consulta';
import { ComprobantesService } from '../../core/services/comprobantes.service';
import { HistorialService } from '../../core/services/historial.service';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';

/** El PDF lo genera un evento de S3 unos 9 s después de aceptar el comprobante. */
const ESPERA_ENTRE_CONSULTAS_MS = 4000;
const MAXIMO_REINTENTOS = 8;

@Component({
  selector: 'fn-detalle-page',
  imports: [DecimalPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, StatusPill],
  templateUrl: './detalle-page.html',
  styleUrl: './detalle-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetallePage {
  private readonly comprobantes = inject(ComprobantesService);
  private readonly historial = inject(HistorialService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();
  private reintentos = 0;

  /** Número del comprobante; llega de la ruta `/comprobantes/:id`. */
  readonly id = input.required<string>();

  protected readonly etiquetaTipo = ETIQUETA_TIPO;
  protected readonly etiquetaDocumento = ETIQUETA_DOCUMENTO;
  protected readonly etiquetaUnidad = ETIQUETA_UNIDAD;

  protected readonly cargando = signal(true);
  protected readonly resultado = signal<ResultadoConsulta | null>(null);
  protected readonly comprobante = computed<ComprobanteGuardado | null>(() => {
    const r = this.resultado();
    return r?.resultado === 'ENCONTRADO' ? r.comprobante : null;
  });
  protected readonly simbolo = computed(() => (this.comprobante()?.moneda === 'USD' ? 'US$' : 'S/'));
  protected readonly esperandoPdf = computed(() => {
    const c = this.comprobante();
    return c !== null && c.estado === 'ACEPTADO' && c.archivos?.pdf === undefined;
  });

  constructor() {
    merge(toObservable(this.id), this.recargar.pipe(map(() => this.id())))
      .pipe(
        switchMap((id) => {
          this.cargando.set(true);
          return this.comprobantes.consultar(normalizarId(id));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.cargando.set(false);
        this.resultado.set(resultado);
        if (resultado.resultado === 'ENCONTRADO') {
          this.historial.registrarConsulta(resultado.comprobante);
          this.programarSiguienteConsulta(resultado.comprobante);
        }
      });
  }

  protected actualizar(): void {
    this.reintentos = 0;
    this.recargar.next();
  }

  protected importe(cantidad: number, valorUnitario: number): number {
    return Math.round((cantidad * valorUnitario + Number.EPSILON) * 100) / 100;
  }

  /** Mientras siga EN PROCESO o falte el PDF de un aceptado, vuelve a consultar unas pocas veces. */
  private programarSiguienteConsulta(c: ComprobanteGuardado): void {
    const pendiente = c.estado === 'PROCESANDO' || (c.estado === 'ACEPTADO' && c.archivos?.pdf === undefined);
    if (!pendiente || this.reintentos >= MAXIMO_REINTENTOS) {
      return;
    }
    this.reintentos += 1;
    timer(ESPERA_ENTRE_CONSULTAS_MS)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.recargar.next();
      });
  }
}
