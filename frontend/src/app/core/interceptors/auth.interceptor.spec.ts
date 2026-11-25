import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { entorno } from '../config/entorno';
import { Sesion } from '../models/auth';
import { AuthService } from '../services/auth.service';
import { tokenFalso } from '../testing/token-falso';
import { authInterceptor } from './auth.interceptor';

const URL_COGNITO = `https://cognito-idp.${entorno.cognitoRegion}.amazonaws.com/`;
const URL_API = `${entorno.apiBase}/comprobantes/20000000001-01-F001-00000001`;

function sembrarSesion(venceEnSegundos: number, idToken: string): void {
  const sesion: Sesion = {
    usuario: 'tester',
    idToken,
    refreshToken: 'refresco',
    expiraEn: Date.now() + venceEnSegundos * 1000,
  };
  sessionStorage.setItem('fn.sesion', JSON.stringify(sesion));
}

describe('authInterceptor', () => {
  let cliente: HttpClient;
  let http: HttpTestingController;

  const preparar = (): void => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    cliente = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    http.verify();
  });

  it('agrega el ID token a las llamadas a la API', () => {
    sembrarSesion(3600, 'token-vigente');
    preparar();

    cliente.get(URL_API).subscribe();

    expect(http.expectOne(URL_API).request.headers.get('Authorization')).toBe('token-vigente');
  });

  it('no manda el token a otros servicios', () => {
    sembrarSesion(3600, 'token-vigente');
    preparar();

    cliente.get('https://ejemplo.com/otra-cosa').subscribe();

    expect(http.expectOne('https://ejemplo.com/otra-cosa').request.headers.has('Authorization')).toBe(false);
  });

  it('renueva antes de enviar si el token está por vencer', () => {
    sembrarSesion(10, 'token-por-vencer');
    preparar();
    const nuevo = tokenFalso(3600);

    cliente.get(URL_API).subscribe();
    http.expectOne(URL_COGNITO).flush({ AuthenticationResult: { IdToken: nuevo, AccessToken: 'a', ExpiresIn: 3600 } });

    expect(http.expectOne(URL_API).request.headers.get('Authorization')).toBe(nuevo);
  });

  it('ante un 401 renueva una vez y reintenta', () => {
    sembrarSesion(3600, 'token-rechazado');
    preparar();
    const nuevo = tokenFalso(3600);
    let estado = 0;

    cliente.get(URL_API, { observe: 'response' }).subscribe((respuesta) => {
      estado = respuesta.status;
    });
    http.expectOne(URL_API).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(URL_COGNITO).flush({ AuthenticationResult: { IdToken: nuevo, AccessToken: 'a', ExpiresIn: 3600 } });
    const reintento = http.expectOne(URL_API);
    expect(reintento.request.headers.get('Authorization')).toBe(nuevo);
    reintento.flush({ ok: true });

    expect(estado).toBe(200);
  });

  it('si no se puede renovar, cierra la sesión', () => {
    sembrarSesion(3600, 'token-rechazado');
    preparar();
    const auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let falló = false;

    cliente.get(URL_API).subscribe({
      error: () => {
        falló = true;
      },
    });
    http.expectOne(URL_API).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(URL_COGNITO).flush({ __type: 'NotAuthorizedException' }, { status: 400, statusText: 'Bad Request' });

    expect(falló).toBe(true);
    expect(auth.autenticado()).toBe(false);
  });
});
