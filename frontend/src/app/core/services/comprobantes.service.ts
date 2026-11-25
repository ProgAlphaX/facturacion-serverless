import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';

import { entorno } from '../config/entorno';
import { ComprobanteEntrada } from '../models/comprobante';
import { ResultadoConsulta, interpretarConsulta, interpretarFalloConsulta } from '../models/consulta';
import { ResultadoEmision, interpretarFallo, interpretarRespuesta } from '../models/emision';

/**
 * El caso más lento medido en el APF3 fue de 21 s (SUNAT caída con 3 reintentos) y API Gateway corta a los 29 s;
 * se espera un poco más por si la red se demora.
 */
export const TIEMPO_MAXIMO_EMISION_MS = 35_000;
export const TIEMPO_MAXIMO_CONSULTA_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class ComprobantesService {
  private readonly http = inject(HttpClient);

  /** Nunca falla: cualquier problema llega como un `ResultadoEmision` que la pantalla sabe mostrar. */
  emitir(comprobante: ComprobanteEntrada): Observable<ResultadoEmision> {
    return this.http.post<unknown>(`${entorno.apiBase}/comprobantes`, comprobante, { observe: 'response' }).pipe(
      timeout(TIEMPO_MAXIMO_EMISION_MS),
      map((respuesta) => interpretarRespuesta(respuesta.status, respuesta.body)),
      catchError((error: unknown) => of(interpretarFallo(error))),
    );
  }

  /** Consulta un comprobante por su número (RUC-TIPO-SERIE-NUMERO). Nunca falla: todo llega como `ResultadoConsulta`. */
  consultar(id: string): Observable<ResultadoConsulta> {
    return this.http.get<unknown>(`${entorno.apiBase}/comprobantes/${encodeURIComponent(id)}`, { observe: 'response' }).pipe(
      timeout(TIEMPO_MAXIMO_CONSULTA_MS),
      map((respuesta) => interpretarConsulta(respuesta.status, respuesta.body)),
      catchError((error: unknown) => of(interpretarFalloConsulta(error))),
    );
  }
}
