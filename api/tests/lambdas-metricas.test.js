const { crearHandler } = require('../src/lambdas/guardar-resultado');
const { lineaDeMetricas } = require('../src/lambdas/metricas');
const { crearRepositorioEnMemoria } = require('./ayudas/memoria');

const FACTURA = { tipo: '01', serie: 'F001', numero: 7, moneda: 'PEN', totales: { total: 236 } };

const armar = async () => {
  const publicadas = [];
  const repositorio = crearRepositorioEnMemoria();
  const handler = crearHandler({ repositorio: () => repositorio, emisorRuc: '20000000001', publicar: (d) => publicadas.push(d), etapa: 'dev' });
  const { id } = await handler({ accion: 'RESERVAR', datos: FACTURA });
  return { handler, id, publicadas };
};

describe('Métricas de negocio', () => {
  test('al finalizar publica el estado, la moneda y el monto', async () => {
    const { handler, id, publicadas } = await armar();
    const cdr = { codigo: '0', descripcion: 'Aceptada', observaciones: [], estado: 'ACEPTADO' };
    await handler({ accion: 'FINALIZAR', id, cdr, hash: 'abc', archivos: {}, moneda: 'PEN', total: 236 });
    expect(publicadas).toEqual([{ etapa: 'dev', estado: 'ACEPTADO', moneda: 'PEN', total: 236 }]);
  });

  test('un error de envío también se cuenta', async () => {
    const { handler, id, publicadas } = await armar();
    await handler({ accion: 'ERROR', id, error: 'ErrorSunat' });
    expect(publicadas).toEqual([{ etapa: 'dev', estado: 'ERROR_ENVIO' }]);
  });

  test('el monto solo se suma cuando SUNAT acepta', () => {
    const aceptado = JSON.parse(lineaDeMetricas({ etapa: 'dev', estado: 'ACEPTADO', moneda: 'PEN', total: 236 }, 1));
    expect(aceptado.MontoFacturado).toBe(236);
    expect(aceptado._aws.CloudWatchMetrics).toHaveLength(2);
    const rechazado = JSON.parse(lineaDeMetricas({ etapa: 'dev', estado: 'RECHAZADO', moneda: 'PEN', total: 236 }, 1));
    expect(rechazado.MontoFacturado).toBeUndefined();
    expect(rechazado._aws.CloudWatchMetrics).toHaveLength(1);
  });
});
