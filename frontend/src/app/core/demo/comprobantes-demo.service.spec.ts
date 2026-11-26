import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { crearEjemplo, ClaveEjemplo } from '../ejemplos/ejemplos-comprobante';
import { ResultadoEmision } from '../models/emision';
import { hoyEnLima } from '../reglas/reglas-comprobante';
import { ComprobantesDemoService, SEGUNDOS_HASTA_PDF_DEMO } from './comprobantes-demo.service';
import { idDe } from './datos-demo';

/** Versión sin esperas y con reloj propio, para probar el comportamiento sin que pase el tiempo real. */
class DemoDePrueba extends ComprobantesDemoService {
  reloj = Date.now();
  readonly urls: Blob[] = [];

  constructor() {
    super();
    this.latenciaMs = 0;
    this.latenciaConReintentosMs = 0;
  }

  protected override ahora(): number {
    return this.reloj;
  }

  protected override crearUrl(archivo: Blob): string {
    this.urls.push(archivo);
    return 'blob:https://demo.local/archivo';
  }
}

describe('ComprobantesDemoService', () => {
  let demo: DemoDePrueba;
  let numero = 91_000_000;

  const emitir = (clave: ClaveEjemplo, n: number = ++numero): Promise<ResultadoEmision> =>
    firstValueFrom(demo.emitir(crearEjemplo(clave, hoyEnLima(new Date(demo.reloj)), n)));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    demo = TestBed.runInInjectionContext(() => new DemoDePrueba());
  });

  describe('listar', () => {
    it('trae los comprobantes de muestra, del más nuevo al más antiguo, con el conteo por estado', async () => {
      const r = await firstValueFrom(demo.listar());
      if (r.resultado !== 'LISTADO') throw new Error('se esperaba un listado');
      expect(r.pagina.total).toBe(12);
      expect(r.pagina.resumen).toEqual({ PROCESANDO: 0, ACEPTADO: 9, RECHAZADO: 2, ERROR_ENVIO: 1 });
      const fechas = r.pagina.comprobantes.map((c) => c.creadoEn);
      expect([...fechas].sort().reverse()).toEqual(fechas);
    });

    it('filtra por estado y pagina', async () => {
      const rechazados = await firstValueFrom(demo.listar({ estado: 'RECHAZADO' }));
      if (rechazados.resultado !== 'LISTADO') throw new Error('se esperaba un listado');
      expect(rechazados.pagina.comprobantes.every((c) => c.estado === 'RECHAZADO')).toBe(true);
      expect(rechazados.pagina.total).toBe(2);

      const pagina = await firstValueFrom(demo.listar({ limite: 5, desde: 10 }));
      if (pagina.resultado !== 'LISTADO') throw new Error('se esperaba un listado');
      expect(pagina.pagina.comprobantes).toHaveLength(2);
      expect(pagina.pagina.siguiente).toBeNull();
      const primera = await firstValueFrom(demo.listar({ limite: 5 }));
      if (primera.resultado !== 'LISTADO') throw new Error('se esperaba un listado');
      expect(primera.pagina.siguiente).toBe(5);
    });
  });

  describe('emitir', () => {
    it('acepta un comprobante válido y aparece primero en la lista y en la consulta', async () => {
      const r = await emitir('factura-valida');
      expect(r.resultado).toBe('ACEPTADO');
      if (r.resultado !== 'ACEPTADO') return;
      expect(r.cdr.codigo).toBe('0');

      const lista = await firstValueFrom(demo.listar({ limite: 1 }));
      if (lista.resultado !== 'LISTADO') throw new Error('se esperaba un listado');
      expect(lista.pagina.comprobantes[0]?.id).toBe(r.id);

      const consulta = await firstValueFrom(demo.consultar(r.id));
      expect(consulta.resultado).toBe('ENCONTRADO');
    });

    it('el PDF de un aceptado aparece unos segundos después, como el evento de S3', async () => {
      const r = await emitir('factura-valida');
      if (r.resultado !== 'ACEPTADO') throw new Error('se esperaba ACEPTADO');
      const tienePdf = async (): Promise<boolean> => {
        const c = await firstValueFrom(demo.consultar(r.id));
        return c.resultado === 'ENCONTRADO' && c.comprobante.archivos?.pdf !== undefined;
      };

      expect(await tienePdf()).toBe(false);
      demo.reloj += (SEGUNDOS_HASTA_PDF_DEMO + 1) * 1000;
      expect(await tienePdf()).toBe(true);
    });

    it('RUC inactivo: SUNAT rechaza con CDR 2017 y nunca hay PDF', async () => {
      const r = await emitir('ruc-inactivo');
      expect(r).toMatchObject({ resultado: 'RECHAZADO', cdr: { codigo: '2017' } });
      if (r.resultado !== 'RECHAZADO') return;
      demo.reloj += 60_000;
      const c = await firstValueFrom(demo.consultar(r.id));
      expect(c.resultado === 'ENCONTRADO' && c.comprobante.archivos?.pdf).toBeFalsy();
    });

    it('reglas incumplidas: INVALIDO con la lista de reglas, sin guardar nada', async () => {
      const antes = await firstValueFrom(demo.listar());
      const r = await emitir('boleta-sin-dni');
      expect(r.resultado).toBe('INVALIDO');
      if (r.resultado === 'INVALIDO') expect(r.errores.map((e) => e.regla)).toEqual(['R08']);
      const despues = await firstValueFrom(demo.listar());
      expect(despues.resultado === 'LISTADO' && antes.resultado === 'LISTADO' && despues.pagina.total === antes.pagina.total).toBe(true);
    });

    it('repetir el mismo número da DUPLICADO (R12)', async () => {
      const n = ++numero;
      await emitir('factura-valida', n);
      const segunda = await emitir('factura-valida', n);
      expect(segunda).toEqual({ resultado: 'DUPLICADO', id: idDe('01', 'F001', n) });
    });

    it('SUNAT caída: queda en ERROR_ENVIO y se guarda con su número', async () => {
      const r = await emitir('sunat-caida');
      expect(r.resultado).toBe('ERROR_ENVIO');
      if (r.resultado !== 'ERROR_ENVIO') return;
      const c = await firstValueFrom(demo.consultar(r.id));
      expect(c.resultado === 'ENCONTRADO' && c.comprobante.estado).toBe('ERROR_ENVIO');
    });

    it('el caso de límite da 429 y no guarda nada', async () => {
      expect(await emitir('limite-peticiones')).toEqual({ resultado: 'LIMITE_PETICIONES' });
    });
  });

  describe('consultar', () => {
    it('un número inexistente o mal formado da NO_EXISTE con el mismo mensaje del backend', async () => {
      const inexistente = await firstValueFrom(demo.consultar('20000000001-01-F001-00000999'));
      expect(inexistente).toMatchObject({ resultado: 'NO_EXISTE', mensaje: expect.stringContaining('No existe el comprobante') as string });
      const malFormado = await firstValueFrom(demo.consultar('abc'));
      expect(malFormado).toMatchObject({ resultado: 'NO_EXISTE', mensaje: expect.stringContaining('RUC-TIPO-SERIE-NUMERO') as string });
    });
  });

  describe('urlDescarga', () => {
    const idAceptado = idDe('01', 'F001', 1);
    const idRechazado = idDe('01', 'F001', 3);
    const idConError = idDe('01', 'F001', 5);

    it('entrega un enlace para el XML, el CDR y el PDF de un aceptado', async () => {
      for (const [tipo, nombre] of [['xml', `${idAceptado}.xml`], ['cdr', `${idAceptado}-cdr.txt`], ['pdf', `${idAceptado}.pdf`]] as const) {
        const r = await firstValueFrom(demo.urlDescarga(idAceptado, tipo));
        expect(r).toMatchObject({ resultado: 'LISTA', nombre, expiraEnSegundos: 300 });
      }
      expect(demo.urls).toHaveLength(3);
    });

    it('un rechazado no tiene PDF y un error de envío no tiene archivos', async () => {
      expect((await firstValueFrom(demo.urlDescarga(idRechazado, 'pdf'))).resultado).toBe('NO_DISPONIBLE');
      expect((await firstValueFrom(demo.urlDescarga(idRechazado, 'xml'))).resultado).toBe('LISTA');
      expect((await firstValueFrom(demo.urlDescarga(idConError, 'xml'))).resultado).toBe('NO_DISPONIBLE');
      expect((await firstValueFrom(demo.urlDescarga('20000000001-01-F001-00000999', 'xml'))).resultado).toBe('NO_DISPONIBLE');
    });
  });
});
