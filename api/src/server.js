// Punto de entrada: carga la configuración y enciende la API.

const { cargarConfig } = require('./config');
const { crearApp } = require('./app');

const config = cargarConfig();
const app = crearApp();

const servidor = app.listen(config.puerto, () => {
  console.log(`API de facturación escuchando en el puerto ${config.puerto}`);
});

// Docker envía SIGTERM al detener el contenedor: cerramos ordenadamente.
process.on('SIGTERM', () => {
  servidor.close(() => process.exit(0));
});
