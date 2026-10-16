// Guarda y consulta el estado de los comprobantes en DynamoDB.
// Clave: pk = EMISOR#<ruc> · sk = CPE#<tipo>-<serie>-<numero>
// La escritura condicional impide registrar dos veces el mismo comprobante (regla R12).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const FORMATO_ID = /^(\d{11})-(01|03)-([A-Z0-9]{4})-(\d{8})$/;

function claveDe(id) {
  const partes = FORMATO_ID.exec(id);
  if (!partes) return null;
  const [, ruc, tipo, serie, numero] = partes;
  return { pk: `EMISOR#${ruc}`, sk: `CPE#${tipo}-${serie}-${numero}` };
}

function crearClienteDynamo({ region, endpoint }) {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region, endpoint }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

function crearRepositorio({ tabla, cliente }) {
  // Registra el comprobante. Devuelve false si ya existe (salvo que haya quedado en ERROR_ENVIO,
  // en cuyo caso se permite reintentar).
  async function reservar(registro) {
    try {
      await cliente.send(new PutCommand({
        TableName: tabla,
        Item: { ...claveDe(registro.id), ...registro },
        ConditionExpression: 'attribute_not_exists(pk) OR estado = :errorEnvio',
        ExpressionAttributeValues: { ':errorEnvio': 'ERROR_ENVIO' },
      }));
      return true;
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') return false;
      throw err;
    }
  }

  async function actualizar(id, campos) {
    const datos = { ...campos, actualizadoEn: new Date().toISOString() };
    const nombres = Object.keys(datos);
    await cliente.send(new UpdateCommand({
      TableName: tabla,
      Key: claveDe(id),
      UpdateExpression: `SET ${nombres.map((_, i) => `#c${i} = :v${i}`).join(', ')}`,
      ExpressionAttributeNames: Object.fromEntries(nombres.map((n, i) => [`#c${i}`, n])),
      ExpressionAttributeValues: Object.fromEntries(nombres.map((n, i) => [`:v${i}`, datos[n]])),
    }));
  }

  async function obtener(id) {
    const clave = claveDe(id);
    if (!clave) return null;
    const { Item } = await cliente.send(new GetCommand({ TableName: tabla, Key: clave }));
    if (!Item) return null;
    const { pk, sk, ...comprobante } = Item;
    return comprobante;
  }

  return { reservar, actualizar, obtener };
}

module.exports = { crearRepositorio, crearClienteDynamo, claveDe, FORMATO_ID };
