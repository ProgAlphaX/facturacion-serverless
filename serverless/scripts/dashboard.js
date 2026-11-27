// Arma el JSON del panel de CloudWatch con los nombres reales de este despliegue (etapa, región, cuenta).
// Serverless lo llama al leer serverless.yml: ${file(./scripts/dashboard.js)}
module.exports = async ({ resolveVariable }) => {
  const region = await resolveVariable('aws:region');
  const cuenta = await resolveVariable('aws:accountId');
  const etapa = await resolveVariable('sls:stage');

  const funciones = ['validar', 'generar-xml', 'firmar', 'enviar-sunat', 'guardar-resultado', 'generar-pdf', 'pdf-automatico', 'consultar-comprobante', 'listar-comprobantes', 'descargar-archivo']
    .map((nombre) => `fe-serverless-${etapa}-${nombre}`);
  const maquina = `arn:aws:states:${region}:${cuenta}:stateMachine:fe-${etapa}-emitir-comprobante`;
  const negocio = (metrica, dimension, valor, extra) => ['FacturacionElectronica', metrica, 'Etapa', etapa, dimension, valor, extra];
  const insights = (metrica, stat) => funciones.map((f) => ['LambdaInsights', metrica, 'function_name', f, { stat, label: f.replace(`fe-serverless-${etapa}-`, '') }]);
  const alarma = (nombre) => `arn:aws:cloudwatch:${region}:${cuenta}:alarm:fe-${etapa}-${nombre}`;
  const api = [['ApiName', `fe-${etapa}-facturacion`, 'Stage', etapa]].flat();

  const porFuncion = (metrica, stat) => funciones.map((f) => ['AWS/Lambda', metrica, 'FunctionName', f, { stat, label: f.replace(`fe-serverless-${etapa}-`, '') }]);
  const grafica = (x, y, w, h, titulo, metricas, extra = {}) => ({
    type: 'metric', x, y, width: w, height: h,
    properties: { title: titulo, region, view: 'timeSeries', period: 60, stat: 'Sum', metrics: metricas, ...extra },
  });

  const widgets = [
    { type: 'text', x: 0, y: 0, width: 24, height: 2, properties: { markdown: `# Facturación electrónica serverless (${etapa})\nFlujo: API Gateway → Step Functions → Lambdas → S3 / DynamoDB. Ventana de tiempo: arriba a la derecha.` } },

    grafica(0, 2, 8, 6, 'Flujo de emisión: ejecuciones', [
      ['AWS/States', 'ExecutionsStarted', 'StateMachineArn', maquina, { label: 'Iniciadas' }],
      ['AWS/States', 'ExecutionsSucceeded', 'StateMachineArn', maquina, { label: 'Exitosas' }],
      ['AWS/States', 'ExecutionsFailed', 'StateMachineArn', maquina, { label: 'Fallidas' }],
    ]),
    grafica(8, 2, 8, 6, 'Flujo de emisión: duración (ms)', [
      ['AWS/States', 'ExecutionTime', 'StateMachineArn', maquina, { stat: 'Average', label: 'Promedio' }],
      ['AWS/States', 'ExecutionTime', 'StateMachineArn', maquina, { stat: 'Maximum', label: 'Máximo' }],
    ]),
    grafica(16, 2, 8, 6, 'API: peticiones y errores', [
      ['AWS/ApiGateway', 'Count', ...api, { label: 'Peticiones' }],
      ['AWS/ApiGateway', '4XXError', ...api, { label: 'Errores 4XX (incluye 401, 403 y 429)' }],
      ['AWS/ApiGateway', '5XXError', ...api, { label: 'Errores 5XX' }],
    ]),

    grafica(0, 8, 12, 6, 'Lambdas: invocaciones', porFuncion('Invocations', 'Sum')),
    grafica(12, 8, 12, 6, 'Lambdas: errores', porFuncion('Errors', 'Sum')),

    grafica(0, 14, 12, 6, 'Lambdas: duración promedio (ms)', porFuncion('Duration', 'Average')),
    grafica(12, 14, 12, 6, 'Lambdas: ejecuciones simultáneas y rechazos (límite de la cuenta: 10)', [
      ['AWS/Lambda', 'ConcurrentExecutions', { stat: 'Maximum', label: 'Simultáneas (máximo)' }],
      ['AWS/Lambda', 'Throttles', { stat: 'Sum', label: 'Rechazadas por límite' }],
    ], { annotations: { horizontal: [{ label: 'Límite de la cuenta', value: 10 }] } }),

    grafica(0, 20, 12, 6, 'API: latencia (ms)', [
      ['AWS/ApiGateway', 'Latency', ...api, { stat: 'Average', label: 'Promedio' }],
      ['AWS/ApiGateway', 'Latency', ...api, { stat: 'p95', label: 'p95' }],
    ]),
    grafica(12, 20, 12, 6, 'DynamoDB: lecturas y escrituras', [
      ['AWS/DynamoDB', 'ConsumedReadCapacityUnits', 'TableName', `fe-${etapa}-comprobantes`, { label: 'Lecturas' }],
      ['AWS/DynamoDB', 'ConsumedWriteCapacityUnits', 'TableName', `fe-${etapa}-comprobantes`, { label: 'Escrituras' }],
    ]),

    grafica(0, 26, 12, 6, 'Negocio: comprobantes por estado', [
      negocio('Comprobantes', 'Estado', 'ACEPTADO', { label: 'Aceptados', color: '#2ca02c' }),
      negocio('Comprobantes', 'Estado', 'RECHAZADO', { label: 'Rechazados', color: '#d62728' }),
      negocio('Comprobantes', 'Estado', 'ERROR_ENVIO', { label: 'Error de envío', color: '#9467bd' }),
    ]),
    grafica(12, 26, 12, 6, 'Negocio: monto facturado (aceptados)', [
      negocio('MontoFacturado', 'Moneda', 'PEN', { label: 'Soles' }),
      negocio('MontoFacturado', 'Moneda', 'USD', { label: 'Dólares' }),
    ]),

    grafica(0, 32, 8, 6, 'Lambdas: memoria usada (%)', insights('memory_utilization', 'Maximum')),
    grafica(8, 32, 8, 6, 'Lambdas: tiempo de CPU (ms)', insights('cpu_total_time', 'Average')),
    grafica(16, 32, 8, 6, 'Lambdas: red (bytes)', insights('total_network', 'Sum')),

    { type: 'alarm', x: 0, y: 38, width: 24, height: 3, properties: { title: 'Alarmas', alarms: [alarma('error-envio-sunat'), alarma('errores-lambda')] } },
  ];

  return JSON.stringify({ widgets });
};
