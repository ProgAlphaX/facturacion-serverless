import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/** URL vigente como señal, para marcar el ítem activo del menú. */
export function urlActual(): Signal<string> {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: router.url },
  );
}
