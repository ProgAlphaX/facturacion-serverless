import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ITEMS_NAVEGACION, estaActivo } from '../navegacion';
import { urlActual } from '../url-actual';

/** Menú inferior para pantallas de celular. */
@Component({
  selector: 'fn-bottom-nav',
  imports: [RouterLink, MatIconModule],
  template: `
    <nav aria-label="Navegación">
      @for (item of items; track item.ruta) {
        <a [routerLink]="item.ruta" [class.activo]="activo(item, url())">
          <mat-icon fontSet="material-symbols-rounded">{{ item.icono }}</mat-icon>
          {{ item.etiqueta }}
        </a>
      }
    </nav>
  `,
  styles: `
    nav {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      padding: 6px;
      border-top: 1px solid var(--fn-line);
      background: var(--fn-surface);
    }

    a {
      display: grid;
      justify-items: center;
      gap: 4px;
      color: var(--fn-ink-3);
      font: 700 11.5px/1.1 'Nunito Sans', sans-serif;
      text-decoration: none;
    }

    a.activo {
      color: var(--fn-brand);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  protected readonly items = ITEMS_NAVEGACION;
  protected readonly activo = estaActivo;
  protected readonly url = urlActual();
}
