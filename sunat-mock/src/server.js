const { cargarConfig } = require('./config');
const { crearApp } = require('./app');

const config = cargarConfig();
const app = crearApp(config);

const servidor = app.listen(config.puerto, () => {
  console.log(`SUNAT simulada escuchando en el puerto ${config.puerto}`);
});

// Docker envía SIGTERM al detener el contenedor.
process.on('SIGTERM', () => {
  servidor.close(() => process.exit(0));
});
