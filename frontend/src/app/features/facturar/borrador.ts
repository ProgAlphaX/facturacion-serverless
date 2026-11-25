import {
  ComprobanteEntrada,
  Moneda,
  TipoComprobante,
  TipoDocumento,
  UnidadMedida,
} from '../../core/models/comprobante';
import { calcularTotales } from '../../core/reglas/reglas-comprobante';

/** Lo que hay escrito en el formulario: los números pueden estar vacíos (`null`). */
export interface ValorFormulario {
  readonly tipo: TipoComprobante;
  readonly serie: string;
  readonly numero: number | null;
  readonly fechaEmision: string;
  readonly moneda: Moneda;
  readonly cliente: {
    readonly tipoDoc: TipoDocumento;
    readonly numDoc: string;
    readonly nombre: string;
  };
  readonly items: readonly {
    readonly descripcion: string;
    readonly unidad: UnidadMedida;
    readonly cantidad: number | null;
    readonly valorUnitario: number | null;
  }[];
}

/**
 * Convierte lo escrito en el comprobante que se envía. Los totales no se escriben: se calculan de los ítems.
 * Un número vacío pasa como 0, que las reglas R03 y R09 señalan como error.
 */
export function aComprobante(valor: ValorFormulario): ComprobanteEntrada {
  const items = valor.items.map((item) => ({
    descripcion: item.descripcion.trim(),
    unidad: item.unidad,
    cantidad: item.cantidad ?? 0,
    valorUnitario: item.valorUnitario ?? 0,
  }));
  return {
    tipo: valor.tipo,
    serie: valor.serie.trim().toUpperCase(),
    numero: valor.numero ?? 0,
    fechaEmision: valor.fechaEmision,
    moneda: valor.moneda,
    cliente: {
      tipoDoc: valor.cliente.tipoDoc,
      numDoc: valor.cliente.numDoc.trim(),
      nombre: valor.cliente.nombre.trim(),
    },
    items,
    totales: calcularTotales(items),
  };
}
