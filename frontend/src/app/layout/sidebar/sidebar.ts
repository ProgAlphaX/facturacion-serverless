import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ITEMS_NAVEGACION, estaActivo } from '../navegacion';
import { urlActual } from '../url-actual';

@Component({
  selector: 'fn-sidebar',
  imports: [RouterLink, MatIconModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly items = ITEMS_NAVEGACION;
  protected readonly activo = estaActivo;
  protected readonly url = urlActual();
}
