import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { Logo } from '../../shared/ui/logo/logo';
import { ITEMS_NAVEGACION, estaActivo } from '../navegacion';
import { urlActual } from '../url-actual';

@Component({
  selector: 'fn-sidebar',
  imports: [RouterLink, MatIconModule, Logo],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.compacto]': 'compacto()' },
})
export class Sidebar {
  readonly compacto = input(false);

  protected readonly auth = inject(AuthService);
  protected readonly items = ITEMS_NAVEGACION;
  protected readonly activo = estaActivo;
  protected readonly url = urlActual();
}
