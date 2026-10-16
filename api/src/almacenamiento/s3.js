// Guarda los archivos del comprobante en S3: XML firmado, CDR y PDF.
// En local apunta a MinIO (compatible con S3); en AWS al bucket real (cifrado por defecto en el bucket).

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
