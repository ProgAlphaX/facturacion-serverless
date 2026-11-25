import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, concatMap, delay, exhaustMap, from, interval, of, tap } from 'rxjs';

import { ESTADOS_COMPROBANTE, ETIQUETA_ESTADO, EstadoComprobante, ETIQUETA_TIPO } from '../../core/models/comprobante';
import { FORMATO_ID, ResultadoConsulta, normalizarId } from '../../core/models/consulta';
import { ComprobantesService } from '../../core/services/comprobantes.service';
import { HistorialService } from '../../core/services/historial.service';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';

type FiltroEstado = EstadoComprobante | 'TODOS';

/** La API permite 5 peticiones por segundo: al actualizar varias se espera entre una y otra. */
const PAUSA_ENTRE_CONSULTAS_MS = 300;
const INTERVALO_EN_PROCESO_MS = 5000;

@Component({
  selector: 'fn-comprobantes-page',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    StatusPill,
  ],
  templateUrl: './comprobantes-page.html',
  styleUrl: './comprobantes-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComprobantesPage {
  private readonly comprobantes = inject(ComprobantesService);
  private readonly historial = inject(HistorialService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly etiquetaTipo = ETIQUETA_TIPO;
  protected readonly estados: readonly EstadoComprobante[] = ESTADOS_COMPROBANTE;

  protected readonly formularioNumero = new FormGroup({ numero: new FormControl('', { nonNullable: true }) });
  protected readonly errorNumero = signal<string | null>(null);
  protected readonly filtro = signal<FiltroEstado>('TODOS');
  protected readonly aviso = signal<string | null>(null);
  protected readonly actualizando = signal<ReadonlySet<string>>(new Set());

  protected readonly todas = this.historial.entradas;
  protected readonly filas = computed(() => {
    const filtro = this.filtro();
    return filtro === 'TODOS' ? this.todas() : this.todas().filter((entrada) => entrada.estado === filtro);
  });
  protected readonly hayActualizacion = computed(() => this.actualizando().size > 0);

  constructor() {
    // Los comprobantes EN PROCESO se vuelven a consultar solos, de uno en uno.
    interval(INTERVALO_EN_PROCESO_MS)
      .pipe(
        exhaustMap(() => {
          const pendiente = this.todas().find((entrada) => entrada.estado === 'PROCESANDO');
          return pendiente ? this.refrescar(pendiente.id) : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected cambiarFiltro(valor: FiltroEstado): void {
    this.filtro.set(valor);
  }

  protected consultarNumero(): void {
    const id = normalizarId(this.formularioNumero.controls.numero.value);
    if (!FORMATO_ID.test(id)) {
      this.errorNumero.set('El número tiene el formato RUC-TIPO-SERIE-NUMERO, por ejemplo 20000000001-01-F001-00000001.');
      return;
    }
    this.errorNumero.set(null);
    void this.router.navigate(['/comprobantes', id]);
  }

  protected actualizar(id: string): void {
    this.aviso.set(null);
    this.refrescar(id).subscribe();
  }

  protected actualizarTodo(): void {
    this.aviso.set(null);
    from(this.todas().map((entrada) => entrada.id))
      .pipe(
        concatMap((id, indice) => of(id).pipe(delay(indice === 0 ? 0 : PAUSA_ENTRE_CONSULTAS_MS))),
        concatMap((id) => this.refrescar(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected quitar(id: string): void {
    this.historial.quitar(id);
  }

  protected vaciar(): void {
    this.historial.vaciar();
  }

  protected simbolo(moneda: 'PEN' | 'USD'): string {
    return moneda === 'USD' ? 'US$' : 'S/';
  }

  private refrescar(id: string): Observable<ResultadoConsulta> {
    this.marcar(id, true);
    return this.comprobantes.consultar(id).pipe(
      tap((resultado) => {
        this.marcar(id, false);
        if (resultado.resultado === 'ENCONTRADO') {
          this.historial.registrarConsulta(resultado.comprobante);
        } else {
          this.aviso.set(this.textoDeAviso(id, resultado));
        }
      }),
    );
  }

  private marcar(id: string, activo: boolean): void {
    this.actualizando.update((actual) => {
      const nuevo = new Set(actual);
      if (activo) {
        nuevo.add(id);
      } else {
        nuevo.delete(id);
      }
      return nuevo;
    });
  }

  private textoDeAviso(id: string, resultado: Exclude<ResultadoConsulta, { resultado: 'ENCONTRADO' }>): string {
    switch (resultado.resultado) {
      case 'NO_EXISTE':
        return `${id}: ya no existe en la base de datos.`;
      case 'LIMITE_PETICIONES':
        return 'Demasiadas consultas seguidas. Espera unos segundos y vuelve a intentar.';
      case 'SESION_EXPIRADA':
        return 'Tu sesión venció. Vuelve a iniciar sesión.';
      case 'SIN_CONEXION':
        return 'No hay conexión con la API.';
      case 'TIEMPO_AGOTADO':
        return 'La API tardó demasiado en responder.';
      case 'ERROR':
        return resultado.mensaje;
    }
  }
}
