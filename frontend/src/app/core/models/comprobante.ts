/** Estados que el backend guarda en DynamoDB para un comprobante (api/src/sunat/cdr.js y guardar-resultado). */
export const ESTADOS_COMPROBANTE = ['PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR_ENVIO'] as const;
export type EstadoComprobante = (typeof ESTADOS_COMPROBANTE)[number];

export const ETIQUETA_ESTADO: Readonly<Record<EstadoComprobante, string>> = {
  PROCESANDO: 'En proceso',
  ACEPTADO: 'Aceptado',
  RECHAZADO: 'Rechazado',
  ERROR_ENVIO: 'Error de envío',
};
