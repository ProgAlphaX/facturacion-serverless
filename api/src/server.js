const fs = require('node:fs');
const { cargarConfig } = require('./config');
const { crearApp } = require('./app');
const { crearClienteDynamo, crearRepositorio } = require('./almacenamiento/dynamo');
const { crearClienteS3, crearAlmacen } = require('./almacenamiento/s3');
const { crearClienteSunat } = require('./sunat/cliente-soap');
const { crearFirmador } = require('./sunat/firma');
const { crearServicioEmision } = require('./servicios/emitir-comprobante');

const config = cargarConfig();

const repositorio = crearRepositorio({
  tabla: config.tabla,
  cliente: crearClienteDynamo({ region: config.aws.region, endpoint: config.aws.dynamodbEndpoint }),
});
const almacen = crearAlmacen({
  bucket: config.bucket,
  cliente: crearClienteS3({
    region: config.aws.region,
    endpoint: config.aws.s3Endpoint,
    forcePathStyle: config.aws.s3ForcePathStyle,
  }),
});
const clienteSunat = crearClienteSunat({ ...config.sunat, ruc: config.emisor.ruc });
const firmador = crearFirmador({
  certPem: fs.readFileSync(config.certificado.certPath, 'utf8'),
  keyPem: fs.readFileSync(config.certificado.keyPath, 'utf8'),
});

const servicio = crearServicioEmision({ emisor: config.emisor, repositorio, almacen, clienteSunat, firmador });
const app = crearApp({ servicio, repositorio });

const servidor = app.listen(config.puerto, () => {
  console.log(`API de facturación escuchando en el puerto ${config.puerto}`);
});

// Docker envía SIGTERM al detener el contenedor.
process.on('SIGTERM', () => {
  servidor.close(() => process.exit(0));
});
