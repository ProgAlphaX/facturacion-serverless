import { BreakpointObserver } from '@angular/cdk/layout';
import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export function coincidePantalla(consulta: string): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe(consulta)
      .pipe(map((estado) => estado.matches)),
    { initialValue: false },
  );
}
