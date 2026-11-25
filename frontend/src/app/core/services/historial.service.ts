import { Injectable, computed, signal } from '@angular/core';

import { ComprobanteEntrada, EstadoComprobante } from '../models/comprobante';
import { ComprobanteGuardado } from '../models/consulta';
import { ResultadoEmision } from '../models/emision';
import { EntradaHistorial, ResumenHistorial, esEntradaHistorial } from '../models/historial';

const CLAVE = 'fn.historial';
/** Tope para que el almacenamiento del navegador no crezca sin límite. */
export const MAXIMO_ENTRADAS = 200;

function leerGuardado(): readonly EntradaHistorial[] {
  try {
    const texto = localStorage.getItem(CLAVE);
    if (texto === null) {
      return [];
    }
    const dato: unknown = JSON.parse(texto);
    return Array.isArray(dato) ? (dato as readonly unknown[]).filter(esEntradaHistorial) : [];
  } catch {
    return [];
  }
}

/** Historial de comprobantes de esta web: vive en `localStorage`, del más nuevo al más antiguo. */
@Injectable({ providedIn: 'root' })
export class HistorialService {
  private readonly estado = signal<readonly EntradaHistorial[]>(leerGuardado());

  readonly entradas = this.estado.asReadonly();

  readonly resumen = computed<ResumenHistorial>(() => {
    const lista = this.estado();
    const cuenta = (estado: EstadoComprobante): number => lista.filter((e) => e.estado === estado).length;
    return {
      total: lista.length,
      aceptados: cuenta('ACEPTADO'),
      rechazados: cuenta('RECHAZADO'),
      enProceso: cuenta('PROCESANDO'),
      conError: cuenta('ERROR_ENVIO'),
    };
  });

  /** Guarda lo emitido desde la pantalla Facturar; los resultados sin número propio (inválido, 429...) no se guardan. */
  registrarEmision(comprobante: ComprobanteEntrada, resultado: ResultadoEmision): void {
    if (resultado.resultado !== 'ACEPTADO' && resultado.resultado !== 'RECHAZADO' && resultado.resultado !== 'ERROR_ENVIO') {
      return;
    }
    this.guardar({
      id: resultado.id,
      tipo: comprobante.tipo,
      serie: comprobante.serie,
      numero: comprobante.numero,
      clienteNombre: comprobante.cliente.nombre,
      moneda: comprobante.moneda,
      total: comprobante.totales.total,
      fechaEmision: comprobante.fechaEmision,
      registradoEn: new Date().toISOString(),
      estado: resultado.resultado,
    });
  }

  /** Guarda o actualiza una fila con lo que devolvió una consulta; conserva la fecha en que se registró por primera vez. */
  registrarConsulta(comprobante: ComprobanteGuardado): void {
    const previo = this.estado().find((e) => e.id === comprobante.id);
    this.guardar({
      id: comprobante.id,
      tipo: comprobante.tipo,
      serie: comprobante.serie,
      numero: comprobante.numero,
      clienteNombre: comprobante.cliente.nombre,
      moneda: comprobante.moneda,
      total: comprobante.totales.total,
      fechaEmision: comprobante.fechaEmision,
      registradoEn: previo?.registradoEn ?? new Date().toISOString(),
      estado: comprobante.estado,
    });
  }

  quitar(id: string): void {
    this.persistir(this.estado().filter((e) => e.id !== id));
  }

  vaciar(): void {
    this.persistir([]);
  }

  private guardar(entrada: EntradaHistorial): void {
    const sinPrevio = this.estado().filter((e) => e.id !== entrada.id);
    const existente = this.estado().some((e) => e.id === entrada.id);
    // Si ya estaba, se actualiza en su sitio para no reordenar la tabla al consultar.
    const lista = existente
      ? this.estado().map((e) => (e.id === entrada.id ? entrada : e))
      : [entrada, ...sinPrevio].slice(0, MAXIMO_ENTRADAS);
    this.persistir(lista);
  }

  private persistir(lista: readonly EntradaHistorial[]): void {
    this.estado.set(lista);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
      // Sin espacio o almacenamiento bloqueado: el historial sigue en memoria durante esta sesión.
    }
  }
}
