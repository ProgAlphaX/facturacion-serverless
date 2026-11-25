// Sin cabecera de cifrado: el bucket de AWS cifra por defecto y MinIO (local) no la soporta.

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

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

  // URL temporal de descarga: el bucket es privado y quien usa la web no tiene credenciales de AWS.
  // `nombre` solo se usa como nombre del archivo descargado (el llamador garantiza que no trae comillas).
  async function urlDescarga(clave, { nombre, segundos }) {
    return getSignedUrl(
      cliente,
      new GetObjectCommand({
        Bucket: bucket,
        Key: clave,
        ResponseContentDisposition: `attachment; filename="${nombre}"`,
      }),
      { expiresIn: segundos },
    );
  }

  return { guardar, urlDescarga };
}

module.exports = { crearAlmacen, crearClienteS3 };
