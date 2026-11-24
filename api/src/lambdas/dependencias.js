// Crea los clientes de AWS solo cuando una Lambda los necesita (y los reutiliza mientras la Lambda siga "caliente").
// Los handlers reciben estas dependencias por parámetro para poder probarse sin AWS.

const { crearAlmacen, crearClienteS3 } = require('../almacenamiento/s3');
const { crearRepositorio, crearClienteDynamo } = require('../almacenamiento/dynamo');
const { crearClienteSunat } = require('../sunat/cliente-soap');
const { crearFirmador } = require('../sunat/firma');

const guardado = {};
const unaVez = (nombre, crear) => {
  guardado[nombre] ??= crear();
  return guardado[nombre];
};

const region = () => process.env.AWS_REGION || 'us-east-1';

const almacen = () =>
  unaVez('almacen', () =>
    crearAlmacen({ bucket: process.env.S3_BUCKET, cliente: crearClienteS3({ region: region() }) }),
  );

const repositorio = () =>
  unaVez('repositorio', () =>
    crearRepositorio({ tabla: process.env.DYNAMODB_TABLE, cliente: crearClienteDynamo({ region: region() }) }),
  );

const clienteSunat = () =>
  unaVez('clienteSunat', () =>
    crearClienteSunat({
      url: process.env.SUNAT_URL,
      ruc: process.env.EMISOR_RUC,
      usuario: process.env.SUNAT_USUARIO,
      clave: process.env.SUNAT_CLAVE,
    }),
  );

// El certificado y la llave viven en SSM Parameter Store (los creó Terraform), nunca en el código.
const firmador = () =>
  unaVez('firmador', async () => {
    const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
    const ssm = new SSMClient({ region: region() });
    const leer = async (Name) => (await ssm.send(new GetParameterCommand({ Name, WithDecryption: true }))).Parameter.Value;
    const [certPem, keyPem] = await Promise.all([leer(process.env.SSM_CERTIFICADO), leer(process.env.SSM_LLAVE_PRIVADA)]);
    return crearFirmador({ certPem, keyPem });
  });

module.exports = { almacen, repositorio, clienteSunat, firmador };
