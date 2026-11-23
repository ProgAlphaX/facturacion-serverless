const { crearRepositorio } = require('../src/almacenamiento/dynamo');

describe('repositorio.actualizar', () => {
  test('omite los campos undefined para no dejar referencias sin valor en el UpdateExpression', async () => {
    const enviados = [];
    const repo = crearRepositorio({ tabla: 'T', cliente: { send: async (c) => enviados.push(c.input) } });

    await repo.actualizar('20000000001-01-F001-00000001', { estado: 'ERROR_ENVIO', error: 'x', hash: undefined, archivos: undefined });

    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = enviados[0];
    expect(Object.values(ExpressionAttributeNames)).toEqual(['estado', 'error', 'actualizadoEn']);
    expect(Object.keys(ExpressionAttributeValues)).toHaveLength(3);
    expect(UpdateExpression.match(/:v\d/g)).toHaveLength(3);
  });
});
