import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { entorno } from '../../core/config/entorno';
import { ConteoPorEstado } from '../../core/models/listado';
import { ComprobantesService } from '../../core/services/comprobantes.service';

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
  private readonly comprobantes = inject(ComprobantesService);

  protected readonly modoDemo = entorno.modoDemo;
  protected readonly resumen = signal<ConteoPorEstado | null>(null);
  protected readonly cargando = signal(true);
  protected readonly aviso = signal<string | null>(null);

  protected readonly tarjetas = computed<readonly Tarjeta[]>(() => {
    const r = this.resumen();
    if (r === null) {
      return [];
    }
    return [
      { etiqueta: 'Emitidos', valor: r.PROCESANDO + r.ACEPTADO + r.RECHAZADO + r.ERROR_ENVIO, color: 'var(--fn-ink)' },
      { etiqueta: 'Aceptados', valor: r.ACEPTADO, color: 'var(--fn-aceptado)' },
      { etiqueta: 'Rechazados', valor: r.RECHAZADO, color: 'var(--fn-rechazado)' },
      { etiqueta: 'Con error de envío', valor: r.ERROR_ENVIO, color: 'var(--fn-error-envio)' },
    ];
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.aviso.set(null);
    // Se pide una sola fila: solo interesa el conteo por estado que acompaña a cualquier página.
    this.comprobantes.listar({ limite: 1 }).subscribe((resultado) => {
      this.cargando.set(false);
      if (resultado.resultado === 'LISTADO') {
        this.resumen.set(resultado.pagina.resumen);
      } else {
        this.aviso.set('No se pudo traer el resumen de comprobantes. Revisa que la API esté encendida y vuelve a intentar.');
      }
    });
  }
}
