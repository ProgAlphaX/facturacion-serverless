import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';

import { ESTADOS_COMPROBANTE, ETIQUETA_ESTADO, ETIQUETA_TIPO, EstadoComprobante } from '../../core/models/comprobante';
import { FORMATO_ID, normalizarId } from '../../core/models/consulta';
import { iniciarDescarga, mensajeDeDescarga } from '../../core/models/descarga';
import { ConteoPorEstado, ResultadoListado, ResumenComprobante } from '../../core/models/listado';
import { ComprobantesService } from '../../core/services/comprobantes.service';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';

type FiltroEstado = EstadoComprobante | 'TODOS';

const FILAS_POR_PAGINA = 25;

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
    MatProgressSpinnerModule,
    MatSelectModule,
    StatusPill,
  ],
  templateUrl: './comprobantes-page.html',
  styleUrl: './comprobantes-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComprobantesPage {
  private readonly comprobantes = inject(ComprobantesService);
  private readonly router = inject(Router);

  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly etiquetaTipo = ETIQUETA_TIPO;
  protected readonly estados: readonly EstadoComprobante[] = ESTADOS_COMPROBANTE;

  protected readonly formularioNumero = new FormGroup({ numero: new FormControl('', { nonNullable: true }) });
  protected readonly errorNumero = signal<string | null>(null);

  protected readonly filtro = signal<FiltroEstado>('TODOS');
  protected readonly filas = signal<readonly ResumenComprobante[]>([]);
  protected readonly total = signal(0);
  protected readonly siguiente = signal<number | null>(null);
  protected readonly resumen = signal<ConteoPorEstado | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly descargando = signal<ReadonlySet<string>>(new Set());

  protected readonly vacio = computed(() => !this.cargando() && this.filas().length === 0);
  protected readonly sinNingunComprobante = computed(() => {
    const r = this.resumen();
    return r !== null && r.PROCESANDO + r.ACEPTADO + r.RECHAZADO + r.ERROR_ENVIO === 0;
  });

  constructor() {
    this.cargar();
  }

  /** Trae la primera página con el filtro actual. */
  protected cargar(): void {
    this.cargando.set(true);
    this.aviso.set(null);
    this.comprobantes.listar(this.consulta(0)).subscribe((resultado) => {
      this.cargando.set(false);
      if (resultado.resultado === 'LISTADO') {
        this.filas.set(resultado.pagina.comprobantes);
        this.total.set(resultado.pagina.total);
        this.siguiente.set(resultado.pagina.siguiente);
        this.resumen.set(resultado.pagina.resumen);
      } else {
        this.aviso.set(this.textoDeFallo(resultado));
      }
    });
  }

  protected cargarMas(): void {
    const desde = this.siguiente();
    if (desde === null || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    this.comprobantes.listar(this.consulta(desde)).subscribe((resultado) => {
      this.cargandoMas.set(false);
      if (resultado.resultado === 'LISTADO') {
        this.filas.update((actuales) => [...actuales, ...resultado.pagina.comprobantes]);
        this.total.set(resultado.pagina.total);
        this.siguiente.set(resultado.pagina.siguiente);
        this.resumen.set(resultado.pagina.resumen);
      } else {
        this.aviso.set(this.textoDeFallo(resultado));
      }
    });
  }

  protected cambiarFiltro(valor: FiltroEstado): void {
    this.filtro.set(valor);
    this.cargar();
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

  protected descargarPdf(fila: ResumenComprobante): void {
    const clave = `${fila.id}:pdf`;
    this.marcarDescarga(clave, true);
    this.comprobantes.urlDescarga(fila.id, 'pdf').subscribe((resultado) => {
      this.marcarDescarga(clave, false);
      if (resultado.resultado === 'LISTA') {
        iniciarDescarga(resultado.url, resultado.nombre);
      } else {
        this.aviso.set(mensajeDeDescarga(resultado));
      }
    });
  }

  protected simbolo(moneda: 'PEN' | 'USD'): string {
    return moneda === 'USD' ? 'US$' : 'S/';
  }

  private consulta(desde: number): { estado?: EstadoComprobante; limite: number; desde: number } {
    const filtro = this.filtro();
    return filtro === 'TODOS' ? { limite: FILAS_POR_PAGINA, desde } : { estado: filtro, limite: FILAS_POR_PAGINA, desde };
  }

  private marcarDescarga(clave: string, activo: boolean): void {
    this.descargando.update((actual) => {
      const nuevo = new Set(actual);
      if (activo) {
        nuevo.add(clave);
      } else {
        nuevo.delete(clave);
      }
      return nuevo;
    });
  }

  private textoDeFallo(resultado: Exclude<ResultadoListado, { resultado: 'LISTADO' }>): string {
    switch (resultado.resultado) {
      case 'LIMITE_PETICIONES':
        return 'Demasiadas consultas seguidas. Espera unos segundos y vuelve a intentar.';
      case 'SESION_EXPIRADA':
        return 'Tu sesión venció. Vuelve a iniciar sesión.';
      case 'SIN_CONEXION':
        return 'No hay conexión con la API. Revisa tu internet y que el servidor local siga encendido.';
      case 'TIEMPO_AGOTADO':
        return 'La API tardó demasiado en responder.';
      case 'ERROR':
        return resultado.mensaje;
    }
  }
}
