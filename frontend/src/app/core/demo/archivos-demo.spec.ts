import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ErrorAutenticacion } from '../services/errores-cognito';
import { archivoDemo, pdfSimple } from './archivos-demo';
import { AuthDemoService } from './auth-demo.service';
import { semilla } from './datos-demo';

describe('pdfSimple', () => {
  const texto = (lineas: string[]): string => new TextDecoder().decode(pdfSimple(lineas));

  it('es un PDF bien formado: cabecera, fin y tabla de referencias con las posiciones reales', () => {
    const pdf = texto(['Hola', 'Línea con (paréntesis) y tildes: áéíóú']);
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);

    const posiciones = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(posiciones).toHaveLength(5);
    posiciones.forEach((posicion, i) => {
      expect(pdf.slice(posicion, posicion + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    expect(Number(/startxref\n(\d+)/.exec(pdf)?.[1])).toBe(pdf.indexOf('xref\n0 6'));
  });

  it('escapa los paréntesis y quita las tildes para no romper el texto', () => {
    const pdf = texto(['Año (2026)']);
    expect(pdf).toContain('(Ano \\(2026\\)) Tj');
  });
});

describe('archivoDemo', () => {
  const [aceptado] = semilla(Date.now());

  it('arma el PDF, el XML y el CDR con el nombre y el tipo correctos', () => {
    if (aceptado === undefined) throw new Error('sin datos de muestra');
    expect(archivoDemo(aceptado, 'pdf')).toMatchObject({ nombre: `${aceptado.id}.pdf`, tipoMime: 'application/pdf' });
    expect(archivoDemo(aceptado, 'xml')).toMatchObject({ nombre: `${aceptado.id}.xml`, tipoMime: 'application/xml' });
    expect(archivoDemo(aceptado, 'cdr')).toMatchObject({ nombre: `${aceptado.id}-cdr.txt`, tipoMime: 'text/plain' });
    expect(String(archivoDemo(aceptado, 'xml').contenido)).toContain(aceptado.cliente.nombre);
  });
});

describe('AuthDemoService', () => {
  let auth: AuthDemoService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), AuthDemoService] });
    auth = TestBed.inject(AuthDemoService);
  });

  it('acepta cualquier usuario y contraseña sin llamar a Cognito', async () => {
    const sesion = await firstValueFrom(auth.iniciarSesion('  cualquiera ', 'x'));
    expect(sesion.usuario).toBe('cualquiera');
    expect(auth.autenticado()).toBe(true);
    expect(auth.estaPorVencer(sesion)).toBe(false);
  });

  it('pide usuario y contraseña', async () => {
    await expect(firstValueFrom(auth.iniciarSesion('', 'x'))).rejects.toBeInstanceOf(ErrorAutenticacion);
    await expect(firstValueFrom(auth.iniciarSesion('a', ''))).rejects.toBeInstanceOf(ErrorAutenticacion);
    expect(auth.autenticado()).toBe(false);
  });

  it('renovar devuelve la misma sesión', async () => {
    await firstValueFrom(auth.iniciarSesion('demo', 'demo'));
    expect((await firstValueFrom(auth.renovar())).usuario).toBe('demo');
  });
});
