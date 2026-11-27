import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, map, merge, switchMap, take, timer } from 'rxjs';

import { ETIQUETA_DOCUMENTO, ETIQUETA_TIPO, ETIQUETA_UNIDAD } from '../../core/models/comprobante';
import { ComprobanteGuardado, ResultadoConsulta, normalizarId } from '../../core/models/consulta';
import { ETIQUETA_ARCHIVO, TIPOS_ARCHIVO, TipoArchivo, iniciarDescarga, mensajeDeDescarga } from '../../core/models/descarga';
import { ComprobantesService } from '../../core/services/comprobantes.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';

/** El PDF lo genera un evento de S3 unos 9 s después de aceptar el comprobante. */
const ESPERA_ENTRE_CONSULTAS_MS = 4000;
const MAXIMO_REINTENTOS = 8;

@Component({
  selector: 'fn-detalle-page',
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, EmptyState, Skeleton, StatusPill],
  templateUrl: './detalle-page.html',
  styleUrl: './detalle-page.scss',
  host: { class: 'fn-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetallePage {
  private readonly comprobantes = inject(ComprobantesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();
  private reintentos = 0;

  /** Número del comprobante; llega de la ruta `/comprobantes/:id`. */
  readonly id = input.required<string>();

  protected readonly etiquetaTipo = ETIQUETA_TIPO;
  protected readonly etiquetaDocumento = ETIQUETA_DOCUMENTO;
  protected readonly etiquetaUnidad = ETIQUETA_UNIDAD;

  protected readonly tiposArchivo = TIPOS_ARCHIVO;
  protected readonly etiquetaArchivo = ETIQUETA_ARCHIVO;
  protected readonly descargando = signal<ReadonlySet<TipoArchivo>>(new Set());
  protected readonly avisoDescarga = signal<string | null>(null);

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
          this.programarSiguienteConsulta(resultado.comprobante);
        }
      });
  }

  protected actualizar(): void {
    this.reintentos = 0;
    this.recargar.next();
  }

  /** Pide un enlace temporal de S3 y empieza la descarga; el archivo no pasa por la web. */
  protected descargar(tipo: TipoArchivo): void {
    this.avisoDescarga.set(null);
    this.marcar(tipo, true);
    this.comprobantes.urlDescarga(normalizarId(this.id()), tipo).subscribe((resultado) => {
      this.marcar(tipo, false);
      if (resultado.resultado === 'LISTA') {
        iniciarDescarga(resultado.url, resultado.nombre);
      } else {
        this.avisoDescarga.set(mensajeDeDescarga(resultado));
      }
    });
  }

  protected claveDe(c: ComprobanteGuardado, tipo: TipoArchivo): string | undefined {
    return c.archivos?.[tipo];
  }

  private marcar(tipo: TipoArchivo, activo: boolean): void {
    this.descargando.update((actual) => {
      const nuevo = new Set(actual);
      if (activo) {
        nuevo.add(tipo);
      } else {
        nuevo.delete(tipo);
      }
      return nuevo;
    });
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
