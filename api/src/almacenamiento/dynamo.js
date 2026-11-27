// Clave: pk = EMISOR#<ruc> · sk = CPE#<tipo>-<serie>-<numero>.
// La escritura condicional impide registrar dos veces el mismo comprobante (regla R12).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Tope de seguridad: una consulta nunca trae más registros que estos aunque la tabla crezca.
const MAXIMO_REGISTROS_POR_CONSULTA = 2000;
const ESTADOS = ['PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR_ENVIO'];
const CAMPOS_RESUMEN = [
  'id', 'tipo', 'serie', 'numero', 'estado', 'cliente', 'nombre', 'moneda', 'totales', 'total',
  'fechaEmision', 'creadoEn', 'actualizadoEn', 'archivos', 'pdf',
];

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
  // Un comprobante en ERROR_ENVIO puede volver a registrarse para reintentar el envío.
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
    // Los campos undefined (p. ej. hash o archivos si el flujo falló antes) se omiten: DynamoDB no los acepta en el SET
    const datos = Object.fromEntries(
      Object.entries({ ...campos, actualizadoEn: new Date().toISOString() }).filter(([, v]) => v !== undefined),
    );
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

  // Lista los comprobantes de un emisor, del más nuevo al más antiguo, solo con los campos del resumen.
  // El orden de la clave (tipo-serie-número) no es cronológico, por eso se ordena aquí por creadoEn.
  // `resumen` cuenta todos los comprobantes del emisor por estado, sin importar el filtro.
  async function listar({ ruc, estado, limite, desde }) {
    const registros = [];
    let siguienteClave;
    do {
      const { Items = [], LastEvaluatedKey } = await cliente.send(new QueryCommand({
        TableName: tabla,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `EMISOR#${ruc}` },
        // Alias para todos los nombres: "total", "tipo" y otros son palabras reservadas de DynamoDB.
        ProjectionExpression: '#id, #tipo, #serie, #numero, #estado, #cliente.#nombre, #moneda, #totales.#total, #fechaEmision, #creadoEn, #actualizadoEn, #archivos.#pdf',
        ExpressionAttributeNames: Object.fromEntries(CAMPOS_RESUMEN.map((campo) => [`#${campo}`, campo])),
        ExclusiveStartKey: siguienteClave,
      }));
      registros.push(...Items);
      siguienteClave = LastEvaluatedKey;
    } while (siguienteClave && registros.length < MAXIMO_REGISTROS_POR_CONSULTA);

    const resumen = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    for (const r of registros) {
      if (r.estado in resumen) resumen[r.estado] += 1;
    }

    const filtrados = registros
      .filter((r) => !estado || r.estado === estado)
      .sort((a, b) => String(b.creadoEn ?? '').localeCompare(String(a.creadoEn ?? '')));
    const comprobantes = filtrados.slice(desde, desde + limite).map((r) => ({
      id: r.id,
      tipo: r.tipo,
      serie: r.serie,
      numero: r.numero,
      estado: r.estado,
      clienteNombre: r.cliente?.nombre ?? '',
      moneda: r.moneda,
      total: r.totales?.total ?? 0,
      fechaEmision: r.fechaEmision,
      creadoEn: r.creadoEn ?? '',
      actualizadoEn: r.actualizadoEn ?? '',
      tienePdf: Boolean(r.archivos?.pdf),
    }));

    return {
      comprobantes,
      total: filtrados.length,
      siguiente: desde + limite < filtrados.length ? desde + limite : null,
      resumen,
    };
  }

  return { reservar, actualizar, obtener, listar };
}

module.exports = { crearRepositorio, crearClienteDynamo, claveDe, FORMATO_ID, ESTADOS };
