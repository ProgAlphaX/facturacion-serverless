import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { Sesion } from '../models/auth';
import { AuthService } from '../services/auth.service';
import { ErrorAutenticacion } from '../services/errores-cognito';

const UNA_HORA_MS = 3_600_000;

/** Reemplaza a `AuthService` en el modo demo: acepta cualquier usuario y contraseña, sin llamar a Cognito. */
@Injectable()
export class AuthDemoService extends AuthService {
  override iniciarSesion(usuario: string, contrasena: string): Observable<Sesion> {
    if (usuario.trim() === '' || contrasena === '') {
      return throwError(() => new ErrorAutenticacion('Escribe un usuario y una contraseña (en la demo vale cualquiera).'));
    }
    const sesion = this.crearSesion(usuario.trim(), 'token-de-demostracion', 'refresco-de-demostracion', UNA_HORA_MS / 1000);
    this.guardar(sesion);
    return of(sesion).pipe(delay(300));
  }

  override renovar(): Observable<Sesion> {
    const actual = this.estado();
    return actual === null ? throwError(() => new ErrorAutenticacion('No hay sesión activa.')) : of(actual);
  }
}
