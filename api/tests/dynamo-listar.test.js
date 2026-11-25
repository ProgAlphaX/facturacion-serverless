const { crearRepositorio } = require('../src/almacenamiento/dynamo');

const registro = (n, estado, creadoEn, extra = {}) => ({
  id: `20000000001-01-F001-${String(n).padStart(8, '0')}`,
  tipo: '01',
  serie: 'F001',
  numero: n,
  estado,
  cliente: { nombre: `CLIENTE ${n}` },
  moneda: 'PEN',
  totales: { total: 100 + n },
  fechaEmision: '2026-11-24',
  creadoEn,
  actualizadoEn: creadoEn,
  ...extra,
});

// Simula DynamoDB: devuelve las páginas indicadas, una por llamada a Query.
function clienteConPaginas(...paginas) {
  const enviados = [];
  let i = 0;
  return {
    enviados,
    send: async (comando) => {
      enviados.push(comando.input);
      const items = paginas[i] ?? [];
      i += 1;
      return { Items: items, LastEvaluatedKey: i < paginas.length ? { pk: 'x', sk: String(i) } : undefined };
    },
  };
}

describe('repositorio.listar', () => {
  test('consulta por emisor, proyecta solo el resumen y ordena del más nuevo al más antiguo', async () => {
    const cliente = clienteConPaginas([
      registro(1, 'ACEPTADO', '2026-11-24T10:00:00Z'),
      registro(3, 'RECHAZADO', '2026-11-24T12:00:00Z'),
      registro(2, 'ACEPTADO', '2026-11-24T11:00:00Z', { archivos: { pdf: 'pdf/x.pdf' } }),
    ]);
    const repo = crearRepositorio({ tabla: 'T', cliente });

    const r = await repo.listar({ ruc: '20000000001', limite: 50, desde: 0 });

    expect(cliente.enviados[0].ExpressionAttributeValues).toEqual({ ':pk': 'EMISOR#20000000001' });
    expect(cliente.enviados[0].ProjectionExpression).not.toMatch(/hash|items|xml/);
    expect(r.comprobantes.map((c) => c.numero)).toEqual([3, 2, 1]);
    expect(r.comprobantes[0]).toEqual({
      id: '20000000001-01-F001-00000003',
      tipo: '01',
      serie: 'F001',
      numero: 3,
      estado: 'RECHAZADO',
      clienteNombre: 'CLIENTE 3',
      moneda: 'PEN',
      total: 103,
      fechaEmision: '2026-11-24',
      creadoEn: '2026-11-24T12:00:00Z',
      actualizadoEn: '2026-11-24T12:00:00Z',
      tienePdf: false,
    });
    expect(r.comprobantes[1].tienePdf).toBe(true);
    expect(r.total).toBe(3);
    expect(r.siguiente).toBeNull();
  });

  test('sigue leyendo mientras DynamoDB devuelva LastEvaluatedKey', async () => {
    const cliente = clienteConPaginas([registro(1, 'ACEPTADO', '2026-11-24T10:00:00Z')], [registro(2, 'ACEPTADO', '2026-11-24T11:00:00Z')]);
    const repo = crearRepositorio({ tabla: 'T', cliente });

    const r = await repo.listar({ ruc: '20000000001', limite: 50, desde: 0 });

    expect(cliente.enviados).toHaveLength(2);
    expect(cliente.enviados[1].ExclusiveStartKey).toEqual({ pk: 'x', sk: '1' });
    expect(r.total).toBe(2);
  });

  test('filtra por estado pero el resumen cuenta todos los estados', async () => {
    const cliente = clienteConPaginas([
      registro(1, 'ACEPTADO', '2026-11-24T10:00:00Z'),
      registro(2, 'RECHAZADO', '2026-11-24T11:00:00Z'),
      registro(3, 'ERROR_ENVIO', '2026-11-24T12:00:00Z'),
      registro(4, 'ACEPTADO', '2026-11-24T13:00:00Z'),
    ]);
    const repo = crearRepositorio({ tabla: 'T', cliente });

    const r = await repo.listar({ ruc: '20000000001', estado: 'ACEPTADO', limite: 50, desde: 0 });

    expect(r.comprobantes.map((c) => c.numero)).toEqual([4, 1]);
    expect(r.total).toBe(2);
    expect(r.resumen).toEqual({ PROCESANDO: 0, ACEPTADO: 2, RECHAZADO: 1, ERROR_ENVIO: 1 });
  });

  test('pagina con limite y desde, e indica dónde sigue', async () => {
    const filas = [1, 2, 3, 4, 5].map((n) => registro(n, 'ACEPTADO', `2026-11-24T1${n}:00:00Z`));
    const repo = crearRepositorio({ tabla: 'T', cliente: clienteConPaginas(filas) });

    const primera = await repo.listar({ ruc: '20000000001', limite: 2, desde: 0 });
    expect(primera.comprobantes.map((c) => c.numero)).toEqual([5, 4]);
    expect(primera.siguiente).toBe(2);

    const ultima = await crearRepositorio({ tabla: 'T', cliente: clienteConPaginas(filas) }).listar({ ruc: '20000000001', limite: 2, desde: 4 });
    expect(ultima.comprobantes.map((c) => c.numero)).toEqual([1]);
    expect(ultima.siguiente).toBeNull();
  });

  test('una tabla vacía devuelve una lista vacía', async () => {
    const repo = crearRepositorio({ tabla: 'T', cliente: clienteConPaginas([]) });
    const r = await repo.listar({ ruc: '20000000001', limite: 50, desde: 0 });
    expect(r).toEqual({ comprobantes: [], total: 0, siguiente: null, resumen: { PROCESANDO: 0, ACEPTADO: 0, RECHAZADO: 0, ERROR_ENVIO: 0 } });
  });
});
