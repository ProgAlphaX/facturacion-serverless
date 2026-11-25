import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';

import { entorno } from '../config/entorno';
import { ComprobanteEntrada } from '../models/comprobante';
import { ResultadoConsulta, interpretarConsulta, interpretarFalloConsulta } from '../models/consulta';
import { ResultadoDescarga, TipoArchivo, interpretarDescarga, interpretarFalloDescarga } from '../models/descarga';
import { ResultadoEmision, interpretarFallo, interpretarRespuesta } from '../models/emision';
import { ConsultaListado, ResultadoListado, interpretarFalloListado, interpretarListado } from '../models/listado';

/**
 * El caso más lento medido en el APF3 fue de 21 s (SUNAT caída con 3 reintentos) y API Gateway corta a los 29 s;
 * se espera un poco más por si la red se demora.
 */
export const TIEMPO_MAXIMO_EMISION_MS = 35_000;
export const TIEMPO_MAXIMO_CONSULTA_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class ComprobantesService {
  private readonly http = inject(HttpClient);

  private readonly base = `${entorno.apiBase}/comprobantes`;

  /** Nunca falla: cualquier problema llega como un `ResultadoEmision` que la pantalla sabe mostrar. */
  emitir(comprobante: ComprobanteEntrada): Observable<ResultadoEmision> {
    return this.http.post<unknown>(this.base, comprobante, { observe: 'response' }).pipe(
      timeout(TIEMPO_MAXIMO_EMISION_MS),
      map((respuesta) => interpretarRespuesta(respuesta.status, respuesta.body)),
      catchError((error: unknown) => of(interpretarFallo(error))),
    );
  }

  /** Consulta un comprobante por su número (RUC-TIPO-SERIE-NUMERO). Nunca falla: todo llega como `ResultadoConsulta`. */
  consultar(id: string): Observable<ResultadoConsulta> {
    return this.http.get<unknown>(`${this.base}/${encodeURIComponent(id)}`, { observe: 'response' }).pipe(
      timeout(TIEMPO_MAXIMO_CONSULTA_MS),
      map((respuesta) => interpretarConsulta(respuesta.status, respuesta.body)),
      catchError((error: unknown) => of(interpretarFalloConsulta(error))),
    );
  }

  /** Lista los comprobantes, del más nuevo al más antiguo, con filtro por estado y paginación. */
  listar(consulta: ConsultaListado = {}): Observable<ResultadoListado> {
    let params = new HttpParams();
    if (consulta.estado !== undefined) {
      params = params.set('estado', consulta.estado);
    }
    if (consulta.limite !== undefined) {
      params = params.set('limite', consulta.limite);
    }
    if (consulta.desde !== undefined) {
      params = params.set('desde', consulta.desde);
    }
    return this.http.get<unknown>(this.base, { params, observe: 'response' }).pipe(
      timeout(TIEMPO_MAXIMO_CONSULTA_MS),
      map((respuesta) => interpretarListado(respuesta.status, respuesta.body)),
      catchError((error: unknown) => of(interpretarFalloListado(error))),
    );
  }

  /** Pide una URL temporal de S3 para descargar el XML, el CDR o el PDF de un comprobante. */
  urlDescarga(id: string, tipo: TipoArchivo): Observable<ResultadoDescarga> {
    return this.http.get<unknown>(`${this.base}/${encodeURIComponent(id)}/archivos/${tipo}`, { observe: 'response' }).pipe(
      timeout(TIEMPO_MAXIMO_CONSULTA_MS),
      map((respuesta) => interpretarDescarga(respuesta.status, respuesta.body)),
      catchError((error: unknown) => of(interpretarFalloDescarga(error))),
    );
  }
}
