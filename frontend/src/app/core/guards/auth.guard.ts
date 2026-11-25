import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Deja pasar solo con sesión; si no, manda al login recordando a dónde quería ir. */
export const authGuard: CanActivateFn = (_ruta, estado) => {
  if (inject(AuthService).autenticado()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { volver: estado.url } });
};

/** El login solo se muestra a quien aún no tiene sesión. */
export const guestGuard: CanActivateFn = () => {
  return inject(AuthService).autenticado() ? inject(Router).createUrlTree(['/inicio']) : true;
};
