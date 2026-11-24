const { crearClienteSunat, ErrorSunat } = require('../src/sunat/cliente-soap');
const { crearHandler } = require('../src/lambdas/enviar-sunat');
const { crearAlmacenEnMemoria } = require('./ayudas/memoria');
const { crearCdrZip, respuestaSoapCdr, respuestaSoapFalla } = require('./ayudas/cdr-falso');

const ID = '20000000001-01-F001-00000001';

const armar = (cuerpo, status = 200) => {
  const fetch = async () => ({ ok: status < 400, status, text: async () => cuerpo });
  const cliente = crearClienteSunat({ url: 'http://sunat/billService', ruc: '20000000001', usuario: 'MODDATOS', clave: 'moddatos', fetch });
  const almacen = crearAlmacenEnMemoria();
  return { almacen, handler: crearHandler({ clienteSunat: () => cliente, almacen: () => almacen }) };
};

describe('Lambda enviar-sunat', () => {
  test('SUNAT acepta: guarda el CDR y devuelve ACEPTADO', async () => {
    const cdrZip = await crearCdrZip({ id: ID });
    const { handler, almacen } = armar(respuestaSoapCdr(cdrZip));

    const r = await handler({ id: ID, xmlFirmado: '<Invoice/>' });

    expect(r.cdr).toMatchObject({ codigo: '0', estado: 'ACEPTADO' });
    expect(r.cdrKey).toBe(`cdr/R-${ID}.zip`);
    expect(almacen.archivos.has(`cdr/R-${ID}.zip`)).toBe(true);
  });

  test('SUNAT rechaza con un CDR: devuelve RECHAZADO', async () => {
    const cdrZip = await crearCdrZip({ id: ID, codigo: '2017', descripcion: 'RUC inactivo' });
    const { handler } = armar(respuestaSoapCdr(cdrZip));
    const r = await handler({ id: ID, xmlFirmado: '<Invoice/>' });
    expect(r.cdr).toMatchObject({ codigo: '2017', estado: 'RECHAZADO' });
  });

  test('SUNAT rechaza con una falla SOAP 2000–3999: devuelve RECHAZADO sin lanzar error', async () => {
    const { handler } = armar(respuestaSoapFalla('2335', 'El documento fue alterado'), 500);
    const r = await handler({ id: ID, xmlFirmado: '<Invoice/>' });
    expect(r.cdr).toMatchObject({ codigo: '2335', estado: 'RECHAZADO' });
    expect(r.cdrKey).toBeNull();
  });

  test('una falla de acceso lanza ErrorSunat para que Step Functions la reintente', async () => {
    const { handler } = armar(respuestaSoapFalla('0102', 'Usuario o contraseña incorrectos'), 500);
    await expect(handler({ id: ID, xmlFirmado: '<Invoice/>' })).rejects.toBeInstanceOf(ErrorSunat);
  });
});
