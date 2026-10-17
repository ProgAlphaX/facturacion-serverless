const express = require('express');
const helmet = require('helmet');
const { leerSobre, respuestaFalla, FallaSoap } = require('./soap');

function crearApp(config) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'], limit: '5mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/billService', async (req, res) => {
    res.type('text/xml; charset=utf-8');
    try {
      const sobre = leerSobre(req.body);
      if (sobre.operacion !== 'sendBill') {
        throw new FallaSoap('0200', `Operación no soportada por el servicio simulado: ${sobre.operacion}`);
      }
      const ruc = (sobre.usuario || '').slice(0, 11);
      if (!/^\d{11}$/.test(ruc) || sobre.usuario.slice(11) !== config.usuario || sobre.clave !== config.clave) {
        throw new FallaSoap('0102', 'Usuario o contraseña incorrectos');
      }
      throw new FallaSoap('0200', 'Procesamiento de comprobantes aún no implementado');
    } catch (err) {
      if (err instanceof FallaSoap) {
        console.log(`[sendBill] falla ${err.codigo}: ${err.message}`);
        return res.status(500).send(respuestaFalla({ codigo: err.codigo, mensaje: err.message }));
      }
      console.error(err);
      return res.status(500).send(respuestaFalla({ codigo: '0200', mensaje: 'Error interno del servicio' }));
    }
  });

  return app;
}

module.exports = { crearApp };
