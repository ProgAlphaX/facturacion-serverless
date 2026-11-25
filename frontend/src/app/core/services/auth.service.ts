import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';

import { entorno } from '../config/entorno';
import { PayloadToken, RespuestaAutenticacion, Sesion, esSesion } from '../models/auth';
import { ErrorAutenticacion } from './errores-cognito';

const CLAVE_SESION = 'fn.sesion';
/** Si faltan menos de 60 s para vencer, el token se renueva antes de llamar a la API. */
const MARGEN_RENOVACION_MS = 60_000;

type FlujoCognito = 'USER_PASSWORD_AUTH' | 'REFRESH_TOKEN_AUTH';

function leerPayload(token: string): PayloadToken | null {
  const parte = token.split('.')[1];
  if (parte === undefined) {
    return null;
  }
  try {
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const dato: unknown = JSON.parse(atob(base64));
    if (typeof dato === 'object' && dato !== null && typeof (dato as { exp?: unknown }).exp === 'number') {
      return dato as PayloadToken;
    }
  } catch {
    // token mal formado: se trata como si no tuviera datos
  }
  return null;
}

function leerSesionGuardada(): Sesion | null {
  try {
    const texto = sessionStorage.getItem(CLAVE_SESION);
    if (texto === null) {
      return null;
    }
    const dato: unknown = JSON.parse(texto);
    return esSesion(dato) ? dato : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly estado = signal<Sesion | null>(leerSesionGuardada());
  /** Evita que varias llamadas simultáneas renueven el token a la vez. */
  private renovacionEnCurso: Observable<Sesion> | null = null;

  readonly sesion = this.estado.asReadonly();
  readonly autenticado = computed(() => this.estado() !== null);
  readonly usuario = computed(() => this.estado()?.usuario ?? null);

  iniciarSesion(usuario: string, contrasena: string): Observable<Sesion> {
    return this.llamarCognito('USER_PASSWORD_AUTH', { USERNAME: usuario, PASSWORD: contrasena }).pipe(
      map((respuesta) => {
        if (respuesta.ChallengeName !== undefined) {
          throw new ErrorAutenticacion('Tu usuario debe cambiar la contraseña. Pide al administrador que la restablezca.');
        }
        const resultado = respuesta.AuthenticationResult;
        if (resultado?.RefreshToken === undefined) {
          throw new ErrorAutenticacion('La respuesta del servicio de acceso está incompleta.');
        }
        return this.crearSesion(usuario, resultado.IdToken, resultado.RefreshToken, resultado.ExpiresIn);
      }),
      tap((sesion) => this.guardar(sesion)),
    );
  }

  /** Pide un ID token nuevo con el refresh token. Si falla, cierra la sesión. */
  renovar(): Observable<Sesion> {
    const actual = this.estado();
    if (actual === null) {
      return throwError(() => new ErrorAutenticacion('No hay sesión activa.'));
    }
    this.renovacionEnCurso ??= this.llamarCognito('REFRESH_TOKEN_AUTH', { REFRESH_TOKEN: actual.refreshToken }).pipe(
      map((respuesta) => {
        const resultado = respuesta.AuthenticationResult;
        if (resultado === undefined) {
          throw new ErrorAutenticacion('No se pudo renovar la sesión.');
        }
        // Cognito no devuelve un refresh token nuevo al renovar: se conserva el actual.
        return this.crearSesion(actual.usuario, resultado.IdToken, actual.refreshToken, resultado.ExpiresIn);
      }),
      tap((sesion) => this.guardar(sesion)),
      catchError((error: unknown) => {
        this.cerrarSesion();
        return throwError(() => error);
      }),
      finalize(() => {
        this.renovacionEnCurso = null;
      }),
      shareReplay(1),
    );
    return this.renovacionEnCurso;
  }

  cerrarSesion(): void {
    this.estado.set(null);
    sessionStorage.removeItem(CLAVE_SESION);
    void this.router.navigate(['/login']);
  }

  /** ¿Conviene renovar el token antes de usarlo? */
  estaPorVencer(sesion: Sesion): boolean {
    return sesion.expiraEn - Date.now() < MARGEN_RENOVACION_MS;
  }

  private llamarCognito(flujo: FlujoCognito, parametros: Readonly<Record<string, string>>): Observable<RespuestaAutenticacion> {
    const cabeceras = new HttpHeaders({
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    });
    return this.http.post<RespuestaAutenticacion>(
      `https://cognito-idp.${entorno.cognitoRegion}.amazonaws.com/`,
      { AuthFlow: flujo, ClientId: entorno.cognitoClienteId, AuthParameters: parametros },
      { headers: cabeceras },
    );
  }

  private crearSesion(usuario: string, idToken: string, refreshToken: string, expiraEnSegundos: number): Sesion {
    const exp = leerPayload(idToken)?.exp;
    const expiraEn = exp !== undefined ? exp * 1000 : Date.now() + expiraEnSegundos * 1000;
    return { usuario, idToken, refreshToken, expiraEn };
  }

  private guardar(sesion: Sesion): void {
    this.estado.set(sesion);
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  }
}
