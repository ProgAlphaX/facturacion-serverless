import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import { ComprobanteEntrada, EstadoComprobante } from '../models/comprobante';
import { ComprobanteGuardado, FORMATO_ID, ResultadoConsulta } from '../models/consulta';
import { ResultadoDescarga, TipoArchivo } from '../models/descarga';
import { ResultadoEmision } from '../models/emision';
import { ConsultaListado, ResultadoListado, ResumenComprobante } from '../models/listado';
import { calcularTotales, hoyEnLima, validarBorrador } from '../reglas/reglas-comprobante';
import { ComprobantesService } from '../services/comprobantes.service';
import { archivoDemo } from './archivos-demo';
import { CDR_ACEPTADO, huellaDemo, idDe, semilla } from './datos-demo';

/** El PDF real tarda unos 9 s en aparecer; en la demostración, 4 s para que se vea la espera sin aburrir. */
export const SEGUNDOS_HASTA_PDF_DEMO = 4;
const RUC_INACTIVO = '20123456786';
const LIMITE_POR_DEFECTO = 50;

/**
 * Reemplaza a `ComprobantesService` en el modo demo: responde como el backend real (mismas reglas, mismos
 * estados y mismas formas de respuesta) pero con datos en memoria. Así la web se muestra sin AWS encendido.
 *
 * Casos que se pueden provocar escribiendo en el nombre del cliente:
 *  - «SUNAT CAIDA»  → error de envío (502) tras una espera larga, como con los reintentos reales.
 *  - «LIMITE»       → 429 (demasiadas peticiones).
 */
@Injectable()
export class ComprobantesDemoService extends ComprobantesService {
  /** Espera simulada de la red; las pruebas la ponen en 0. */
  protected latenciaMs = 700;
  protected latenciaConReintentosMs = 3000;

  private readonly registros = new Map<string, ComprobanteGuardado>(semilla(Date.now()).map((c) => [c.id, c]));

  override emitir(comprobante: ComprobanteEntrada): Observable<ResultadoEmision> {
    const avisos = validarBorrador(comprobante, hoyEnLima(new Date(this.ahora())));
    if (avisos.length > 0) {
      return this.responder({ resultado: 'INVALIDO', errores: avisos }, this.latenciaMs / 2);
    }

    const id = idDe(comprobante.tipo, comprobante.serie, comprobante.numero);
    const previo = this.registros.get(id);
    if (previo !== undefined && previo.estado !== 'ERROR_ENVIO') {
      return this.responder({ resultado: 'DUPLICADO', id }, this.latenciaMs / 2);
    }

    const nombre = comprobante.cliente.nombre.toUpperCase();
    if (nombre.includes('LIMITE')) {
      return this.responder({ resultado: 'LIMITE_PETICIONES' }, this.latenciaMs / 3);
    }

    const ahoraIso = new Date(this.ahora()).toISOString();
    const base = {
      ...comprobante,
      totales: calcularTotales(comprobante.items),
      id,
      creadoEn: previo?.creadoEn ?? ahoraIso,
      actualizadoEn: ahoraIso,
    };

    if (nombre.includes('SUNAT CAIDA')) {
      this.registros.set(id, { ...base, estado: 'ERROR_ENVIO', error: 'States.TaskFailed' });
      return this.responder({ resultado: 'ERROR_ENVIO', id }, this.latenciaConReintentosMs);
    }

    const rechazado = comprobante.cliente.numDoc === RUC_INACTIVO;
    const hash = huellaDemo();
    const cdr = rechazado
      ? { codigo: '2017', descripcion: 'El numero de RUC del receptor no esta activo', observaciones: [] }
      : { codigo: '0', descripcion: CDR_ACEPTADO(comprobante.tipo, comprobante.serie, comprobante.numero), observaciones: [] };
    const estado: EstadoComprobante = rechazado ? 'RECHAZADO' : 'ACEPTADO';
    this.registros.set(id, { ...base, estado, hash, cdr, archivos: { xml: `firmados/${id}.xml`, cdr: `cdr/R-${id}.zip` } });
    return this.responder({ resultado: estado, id, hash, cdr }, this.latenciaMs);
  }

  override consultar(id: string): Observable<ResultadoConsulta> {
    if (!FORMATO_ID.test(id)) {
      return this.responder(
        { resultado: 'NO_EXISTE', mensaje: 'Formato de id esperado: RUC-TIPO-SERIE-NUMERO (ej. 20000000001-01-F001-00000001)' },
        this.latenciaMs / 3,
      );
    }
    const registro = this.registros.get(id);
    if (registro === undefined) {
      return this.responder({ resultado: 'NO_EXISTE', mensaje: `No existe el comprobante ${id}` }, this.latenciaMs / 3);
    }
    return this.responder({ resultado: 'ENCONTRADO', comprobante: this.conPdfSiYaEsta(registro) }, this.latenciaMs / 3);
  }

  override listar(consulta: ConsultaListado = {}): Observable<ResultadoListado> {
    const todos = [...this.registros.values()];
    const resumen = {
      PROCESANDO: todos.filter((c) => c.estado === 'PROCESANDO').length,
      ACEPTADO: todos.filter((c) => c.estado === 'ACEPTADO').length,
      RECHAZADO: todos.filter((c) => c.estado === 'RECHAZADO').length,
      ERROR_ENVIO: todos.filter((c) => c.estado === 'ERROR_ENVIO').length,
    };
    const filtrados = todos
      .filter((c) => consulta.estado === undefined || c.estado === consulta.estado)
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    const limite = consulta.limite ?? LIMITE_POR_DEFECTO;
    const desde = consulta.desde ?? 0;
    const comprobantes = filtrados.slice(desde, desde + limite).map((c) => this.aResumen(this.conPdfSiYaEsta(c)));
    const siguiente = desde + limite < filtrados.length ? desde + limite : null;
    return this.responder({ resultado: 'LISTADO', pagina: { comprobantes, total: filtrados.length, siguiente, resumen } }, this.latenciaMs / 3);
  }

  override urlDescarga(id: string, tipo: TipoArchivo): Observable<ResultadoDescarga> {
    const registro = this.registros.get(id);
    if (registro === undefined) {
      return this.responder({ resultado: 'NO_DISPONIBLE', mensaje: `No existe el comprobante ${id}` }, this.latenciaMs / 3);
    }
    const completo = this.conPdfSiYaEsta(registro);
    if (completo.archivos?.[tipo] === undefined) {
      const aviso = tipo === 'pdf' ? ' (se genera unos segundos después de aceptarlo y solo si fue aceptado)' : '';
      return this.responder(
        { resultado: 'NO_DISPONIBLE', mensaje: `El comprobante ${id} no tiene archivo ${tipo}${aviso}` },
        this.latenciaMs / 3,
      );
    }
    const archivo = archivoDemo(completo, tipo);
    const url = this.crearUrl(new Blob([archivo.contenido as BlobPart], { type: archivo.tipoMime }));
    return this.responder({ resultado: 'LISTA', url, nombre: archivo.nombre, expiraEnSegundos: 300 }, this.latenciaMs / 3);
  }

  /** Reloj de la demostración; las pruebas lo adelantan para ver aparecer el PDF. */
  protected ahora(): number {
    return Date.now();
  }

  /** Enlace temporal a un archivo en memoria (en la web real es una URL firmada de S3). */
  protected crearUrl(archivo: Blob): string {
    return URL.createObjectURL(archivo);
  }

  /** Un aceptado muestra su PDF unos segundos después de emitido, como el evento de S3 real. */
  private conPdfSiYaEsta(c: ComprobanteGuardado): ComprobanteGuardado {
    const transcurridoMs = this.ahora() - Date.parse(c.creadoEn);
    if (c.estado !== 'ACEPTADO' || c.archivos?.pdf !== undefined || transcurridoMs < SEGUNDOS_HASTA_PDF_DEMO * 1000) {
      return c;
    }
    return { ...c, archivos: { ...c.archivos, pdf: `pdf/${c.id}.pdf` } };
  }

  private aResumen(c: ComprobanteGuardado): ResumenComprobante {
    return {
      id: c.id,
      tipo: c.tipo,
      serie: c.serie,
      numero: c.numero,
      estado: c.estado,
      clienteNombre: c.cliente.nombre,
      moneda: c.moneda,
      total: c.totales.total,
      fechaEmision: c.fechaEmision,
      creadoEn: c.creadoEn,
      actualizadoEn: c.actualizadoEn,
      tienePdf: c.archivos?.pdf !== undefined,
    };
  }

  private responder<T>(valor: T, milisegundos: number): Observable<T> {
    return of(valor).pipe(delay(milisegundos));
  }
}
