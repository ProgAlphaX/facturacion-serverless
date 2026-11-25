import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { entorno } from '../config/entorno';
import { tokenFalso } from '../testing/token-falso';
import { AuthService } from './auth.service';
import { mensajeDeError } from './errores-cognito';

const URL_COGNITO = `https://cognito-idp.${entorno.cognitoRegion}.amazonaws.com/`;

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('inicia sesión con USER_PASSWORD_AUTH y guarda la sesión', () => {
    let usuario = '';
    auth.iniciarSesion('tester', 'Clave-Segura-123').subscribe((sesion) => {
      usuario = sesion.usuario;
    });

    const peticion = http.expectOne(URL_COGNITO);
    expect(peticion.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.InitiateAuth');
    expect(peticion.request.body).toEqual({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: entorno.cognitoClienteId,
      AuthParameters: { USERNAME: 'tester', PASSWORD: 'Clave-Segura-123' },
    });
    peticion.flush({
      AuthenticationResult: { IdToken: tokenFalso(3600), AccessToken: 'acceso', RefreshToken: 'refresco', ExpiresIn: 3600 },
    });

    expect(usuario).toBe('tester');
    expect(auth.autenticado()).toBe(true);
    expect(sessionStorage.getItem('fn.sesion')).not.toBeNull();
  });

  it('no guarda la contraseña en ningún lado', () => {
    auth.iniciarSesion('tester', 'Clave-Segura-123').subscribe();
    http.expectOne(URL_COGNITO).flush({
      AuthenticationResult: { IdToken: tokenFalso(3600), AccessToken: 'acceso', RefreshToken: 'refresco', ExpiresIn: 3600 },
    });
    expect(sessionStorage.getItem('fn.sesion')).not.toContain('Clave-Segura-123');
  });

  it('traduce una contraseña incorrecta a un mensaje claro', () => {
    let mensaje = '';
    auth.iniciarSesion('tester', 'mala').subscribe({
      error: (error: unknown) => {
        mensaje = mensajeDeError(error);
      },
    });
    http
      .expectOne(URL_COGNITO)
      .flush({ __type: 'NotAuthorizedException', message: 'Incorrect username or password.' }, { status: 400, statusText: 'Bad Request' });

    expect(mensaje).toBe('Usuario o contraseña incorrectos.');
    expect(auth.autenticado()).toBe(false);
  });

  it('avisa cuando el usuario debe cambiar la contraseña', () => {
    let mensaje = '';
    auth.iniciarSesion('tester', 'temporal').subscribe({
      error: (error: unknown) => {
        mensaje = mensajeDeError(error);
      },
    });
    http.expectOne(URL_COGNITO).flush({ ChallengeName: 'NEW_PASSWORD_REQUIRED' });

    expect(mensaje).toContain('cambiar la contraseña');
  });

  it('avisa cuando no hay conexión', () => {
    let mensaje = '';
    auth.iniciarSesion('tester', 'x').subscribe({
      error: (error: unknown) => {
        mensaje = mensajeDeError(error);
      },
    });
    http.expectOne(URL_COGNITO).error(new ProgressEvent('error'));

    expect(mensaje).toContain('No hay conexión');
  });

  it('renueva el ID token y conserva el refresh token', () => {
    auth.iniciarSesion('tester', 'ok').subscribe();
    http.expectOne(URL_COGNITO).flush({
      AuthenticationResult: { IdToken: tokenFalso(30), AccessToken: 'a', RefreshToken: 'refresco', ExpiresIn: 30 },
    });
    expect(auth.estaPorVencer(auth.sesion()!)).toBe(true);

    const nuevoToken = tokenFalso(3600);
    auth.renovar().subscribe();
    const peticion = http.expectOne(URL_COGNITO);
    expect((peticion.request.body as { AuthFlow: string }).AuthFlow).toBe('REFRESH_TOKEN_AUTH');
    peticion.flush({ AuthenticationResult: { IdToken: nuevoToken, AccessToken: 'a2', ExpiresIn: 3600 } });

    expect(auth.sesion()?.idToken).toBe(nuevoToken);
    expect(auth.sesion()?.refreshToken).toBe('refresco');
  });

  it('cierra la sesión y manda al login', () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.iniciarSesion('tester', 'ok').subscribe();
    http.expectOne(URL_COGNITO).flush({
      AuthenticationResult: { IdToken: tokenFalso(3600), AccessToken: 'a', RefreshToken: 'r', ExpiresIn: 3600 },
    });

    auth.cerrarSesion();

    expect(auth.autenticado()).toBe(false);
    expect(sessionStorage.getItem('fn.sesion')).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });
});
