// Métricas de negocio en formato EMF: CloudWatch las extrae del log, sin permisos ni llamadas extra.
const ESPACIO = 'FacturacionElectronica';

/**
 * @param {{ etapa: string, estado: string, moneda?: string, total?: number }} dato
 * @returns {string} línea JSON en formato EMF
 */
function lineaDeMetricas({ etapa, estado, moneda, total }, ahora = Date.now()) {
  const conMonto = estado === 'ACEPTADO' && typeof total === 'number' && typeof moneda === 'string';
  const metricas = [{ Namespace: ESPACIO, Dimensions: [['Etapa', 'Estado']], Metrics: [{ Name: 'Comprobantes', Unit: 'Count' }] }];
  if (conMonto) {
    metricas.push({ Namespace: ESPACIO, Dimensions: [['Etapa', 'Moneda']], Metrics: [{ Name: 'MontoFacturado', Unit: 'None' }] });
  }
  return JSON.stringify({
    _aws: { Timestamp: ahora, CloudWatchMetrics: metricas },
    Etapa: etapa,
    Estado: estado,
    Comprobantes: 1,
    ...(conMonto ? { Moneda: moneda, MontoFacturado: total } : {}),
  });
}

// Se escribe directo a stdout: console.log antepone fecha y requestId y CloudWatch ya no reconoce el JSON.
function publicarMetricas(dato) {
  process.stdout.write(`${lineaDeMetricas(dato)}\n`);
}

module.exports = { ESPACIO, lineaDeMetricas, publicarMetricas };
