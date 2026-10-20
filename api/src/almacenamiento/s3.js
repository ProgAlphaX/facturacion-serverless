// Sin cabecera de cifrado: el bucket de AWS cifra por defecto y MinIO (local) no la soporta.

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

function crearClienteS3({ region, endpoint, forcePathStyle }) {
  return new S3Client({ region, endpoint, forcePathStyle });
}

function crearAlmacen({ bucket, cliente }) {
  async function guardar(clave, contenido, tipoContenido) {
    await cliente.send(new PutObjectCommand({
      Bucket: bucket,
      Key: clave,
      Body: contenido,
      ContentType: tipoContenido,
    }));
    return clave;
  }

  return { guardar };
}

module.exports = { crearAlmacen, crearClienteS3 };
