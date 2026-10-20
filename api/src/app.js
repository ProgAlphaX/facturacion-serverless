// Separada de server.js para probarla sin abrir un puerto y reutilizarla en Lambda (APF3).

const express = require('express');
const helmet = require('helmet');
const { rutasComprobantes } = require('./rutas/comprobantes');
const { ErrorNegocio } = require('./servicios/emitir-comprobante');

function crearApp({ servicio, repositorio }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/comprobantes', rutasComprobantes({ servicio, repositorio }));

  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use((err, req, res, next) => {
    if (err instanceof ErrorNegocio) {
      return res.status(err.status).json(err.cuerpo);
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El cuerpo no es un JSON válido' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo supera el tamaño permitido (100 KB)' });
    }
    // El detalle técnico solo va al log, nunca al usuario
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { crearApp };
