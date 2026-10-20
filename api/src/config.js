const OBLIGATORIAS = [
  'EMISOR_RUC',
  'EMISOR_RAZON_SOCIAL',
  'DYNAMODB_TABLE',
  'S3_BUCKET',
  'SUNAT_URL',
  'SUNAT_USUARIO',
  'SUNAT_CLAVE',
  'CERT_PATH',
  'CERT_KEY_PATH',
];

function cargarConfig(env = process.env) {
  const faltantes = OBLIGATORIAS.filter((nombre) => !env[nombre]);
  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  }

  return {
    puerto: Number(env.PORT) || 3000,
    aws: {
      region: env.AWS_REGION || 'us-east-1',
      dynamodbEndpoint: env.DYNAMODB_ENDPOINT || undefined,
      s3Endpoint: env.S3_ENDPOINT || undefined,
      s3ForcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    },
    tabla: env.DYNAMODB_TABLE,
    bucket: env.S3_BUCKET,
    sunat: {
      url: env.SUNAT_URL,
      usuario: env.SUNAT_USUARIO,
      clave: env.SUNAT_CLAVE,
    },
    emisor: {
      ruc: env.EMISOR_RUC,
      razonSocial: env.EMISOR_RAZON_SOCIAL,
    },
    certificado: {
      certPath: env.CERT_PATH,
      keyPath: env.CERT_KEY_PATH,
    },
  };
}

module.exports = { cargarConfig };
