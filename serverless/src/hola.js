// Solo confirma que el despliegue y las variables de entorno funcionan.
exports.handler = async () => ({
  mensaje: 'Base serverless lista',
  tabla: process.env.DYNAMODB_TABLE,
  bucket: process.env.S3_BUCKET,
  emisorRuc: process.env.EMISOR_RUC,
});
