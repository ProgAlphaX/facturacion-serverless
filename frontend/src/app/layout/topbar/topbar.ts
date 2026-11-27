import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { entorno } from '../../core/config/entorno';
import { AuthService } from '../../core/services/auth.service';

interface DatosRuta {
  readonly titulo: string;
  readonly volver: string | null;
}

/** Lee título y botón de regreso de la ruta hija activa. */
function datosDe(raiz: ActivatedRouteSnapshot): DatosRuta {
  let ruta = raiz;
  while (ruta.firstChild !== null) {
    ruta = ruta.firstChild;
  }
  const titulo: unknown = ruta.data['titulo'];
  const volver: unknown = ruta.data['volver'];
  return { titulo: typeof titulo === 'string' ? titulo : '', volver: typeof volver === 'string' ? volver : null };
}

@Component({
  selector: 'fn-topbar',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  private readonly router = inject(Router);

  readonly esMovil = input(false);

  protected readonly auth = inject(AuthService);
  protected readonly modoDemo = entorno.modoDemo;
  protected readonly datos = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      startWith(null),
      map(() => datosDe(this.router.routerState.snapshot.root)),
    ),
    { requireSync: true },
  );
  protected readonly inicial = computed(() => (this.auth.usuario() ?? '?').charAt(0).toUpperCase());
}
