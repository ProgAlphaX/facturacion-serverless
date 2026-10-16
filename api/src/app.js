// Arma la aplicación Express (rutas + seguridad).
// Está separada de server.js para poder probarla sin abrir un puerto
// y para reutilizarla dentro de una Lambda en el APF3.

const express = require('express');
const helmet = require('helmet');

function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El cuerpo no es un JSON válido' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo supera el tamaño permitido (100 KB)' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { crearApp };
