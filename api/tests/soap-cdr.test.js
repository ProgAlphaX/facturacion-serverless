const JSZip = require('jszip');
const { crearClienteSunat, comprimir, ErrorSunat } = require('../src/sunat/cliente-soap');
const { leerCdr, estadoSegunCodigo } = require('../src/sunat/cdr');
const { crearCdrZip, respuestaSoapCdr, respuestaSoapFalla } = require('./ayudas/cdr-falso');

const ID = '20000000001-01-F001-00000001';

const fetchQueResponde = (cuerpo, status = 200) => {
  const llamadas = [];
  const fetch = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return { ok: status < 400, status, text: async () => cuerpo };
  };
  return { fetch, llamadas };
};

const crearCliente = (fetch) =>
  crearClienteSunat({ url: 'http://sunat/billService', ruc: '20000000001', usuario: 'MODDATOS', clave: 'moddatos', fetch });

describe('Cliente SOAP sendBill', () => {
  test('envía el ZIP en Base64 con usuario RUC+SOL y devuelve el CDR', async () => {
    const cdr = await crearCdrZip({ id: ID });
    const { fetch, llamadas } = fetchQueResponde(respuestaSoapCdr(cdr));
    const zip = await comprimir(`${ID}.xml`, '<Invoice/>');

    const resultado = await crearCliente(fetch).enviar(`${ID}.zip`, zip);

    expect(resultado.equals(cdr)).toBe(true);
    const cuerpo = llamadas[0].opciones.body;
    expect(cuerpo).toContain('<ser:sendBill>');
    expect(cuerpo).toContain('<wsse:Username>20000000001MODDATOS</wsse:Username>');
    expect(cuerpo).toContain(`<fileName>${ID}.zip</fileName>`);
    expect(cuerpo).toContain(`<contentFile>${zip.toString('base64')}</contentFile>`);
  });

  test('una falla SOAP se convierte en ErrorSunat con su código', async () => {
    const { fetch } = fetchQueResponde(respuestaSoapFalla('0102', 'Usuario o contraseña incorrectos'), 500);
    await expect(crearCliente(fetch).enviar('x.zip', Buffer.from('x'))).rejects.toMatchObject({
      name: 'ErrorSunat',
      codigo: '0102',
    });
  });

  test('si SUNAT no responde, lanza ErrorSunat sin código', async () => {
    const fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const error = await crearCliente(fetch).enviar('x.zip', Buffer.from('x')).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorSunat);
    expect(error.codigo).toBeNull();
  });

  test('comprimir genera un ZIP con el archivo indicado', async () => {
    const zip = await JSZip.loadAsync(await comprimir('a.xml', '<a/>'));
    expect(await zip.file('a.xml').async('string')).toBe('<a/>');
  });
});

describe('Lectura del CDR', () => {
  test('código 0 → ACEPTADO', async () => {
    const cdr = await leerCdr(await crearCdrZip({ id: ID }));
    expect(cdr).toMatchObject({ codigo: '0', estado: 'ACEPTADO' });
    expect(cdr.descripcion).toContain('aceptado');
  });

  test('código 2xxx → RECHAZADO', async () => {
    const cdr = await leerCdr(await crearCdrZip({ id: ID, codigo: '2017', descripcion: 'RUC no válido' }));
    expect(cdr).toMatchObject({ codigo: '2017', estado: 'RECHAZADO' });
  });

  test('código 4xxx → ACEPTADO con observaciones', async () => {
    const cdr = await leerCdr(await crearCdrZip({ id: ID, codigo: '4252', notas: ['4252 - Observación de prueba'] }));
    expect(cdr.estado).toBe('ACEPTADO');
    expect(cdr.observaciones).toEqual(['4252 - Observación de prueba']);
  });

  test('estadoSegunCodigo para excepciones (0100–1999)', () => {
    expect(estadoSegunCodigo('0102')).toBe('ERROR_ENVIO');
  });
});
