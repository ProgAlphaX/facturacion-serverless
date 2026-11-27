import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';

import { entorno } from '../config/entorno';
import { AuthService } from '../services/auth.service';

function conToken(req: HttpRequest<unknown>, idToken: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: idToken } });
}

/**
 * Agrega el ID token a las llamadas a la API. Si el token está por vencer lo renueva antes de enviar;
 * si la API responde 401, renueva una vez y reintenta. Si la renovación falla, AuthService cierra la sesión.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (!req.url.startsWith(entorno.apiBase)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const sesion = auth.sesion();
  if (sesion === null) {
    return next(req);
  }

  const token$ = auth.estaPorVencer(sesion) ? auth.renovar().pipe(map((nueva) => nueva.idToken)) : of(sesion.idToken);

  return token$.pipe(
    switchMap((idToken) => next(conToken(req, idToken))),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return auth.renovar().pipe(switchMap((nueva) => next(conToken(req, nueva.idToken))));
      }
      return throwError(() => error);
    }),
  );
};
