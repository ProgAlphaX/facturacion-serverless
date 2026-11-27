import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, GuardResult, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Sesion } from '../models/auth';
import { authGuard, guestGuard } from './auth.guard';

const texto = (resultado: GuardResult): string => (resultado instanceof UrlTree ? resultado.toString() : String(resultado));
const ruta = {} as ActivatedRouteSnapshot;
const destino = { url: '/comprobantes' } as RouterStateSnapshot;

// Nuestros guards son síncronos: el resultado nunca es una promesa ni un observable.
const ejecutar = (guard: CanActivateFn): GuardResult => TestBed.runInInjectionContext(() => guard(ruta, destino)) as GuardResult;

function prepararConSesion(conSesion: boolean): void {
  sessionStorage.clear();
  if (conSesion) {
    const sesion: Sesion = { usuario: 'tester', idToken: 't', refreshToken: 'r', expiraEn: Date.now() + 3_600_000 };
    sessionStorage.setItem('fn.sesion', JSON.stringify(sesion));
  }
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
}

describe('guards de sesión', () => {
  it('authGuard deja pasar con sesión', () => {
    prepararConSesion(true);
    expect(ejecutar(authGuard)).toBe(true);
  });

  it('authGuard manda al login recordando la ruta pedida', () => {
    prepararConSesion(false);
    const resultado = ejecutar(authGuard);
    expect(resultado instanceof UrlTree).toBe(true);
    expect(texto(resultado)).toBe('/login?volver=%2Fcomprobantes');
  });

  it('guestGuard manda al inicio si ya hay sesión', () => {
    prepararConSesion(true);
    const resultado = ejecutar(guestGuard);
    expect(texto(resultado)).toBe('/inicio');
  });

  it('guestGuard deja ver el login sin sesión', () => {
    prepararConSesion(false);
    expect(ejecutar(guestGuard)).toBe(true);
  });
});
