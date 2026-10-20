const express = require('express');
const helmet = require('helmet');
const { leerSobre, respuestaSendBill, respuestaFalla, FallaSoap } = require('./soap');
const { evaluarComprobante } = require('./validaciones');
const { construirCdr } = require('./cdr');

function crearApp(config) {
  const app = express();
  // Un reenvío de un comprobante ya aceptado recibe el mismo CDR (no queda trabado tras un ERROR_ENVIO)
  const aceptados = new Map();

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
      const rucUsuario = (sobre.usuario || '').slice(0, 11);
      if (!/^\d{11}$/.test(rucUsuario) || sobre.usuario.slice(11) !== config.usuario || sobre.clave !== config.clave) {
        throw new FallaSoap('0102', 'Usuario o contraseña incorrectos');
      }

      const resultado = await evaluarComprobante(
        { rucUsuario, nombreArchivo: sobre.nombreArchivo, contenido: sobre.contenido },
        config,
      );

      let cdrZip = aceptados.get(resultado.id);
      if (!cdrZip) {
        cdrZip = await construirCdr({ ...resultado, rucEmisor: resultado.ruc });
        if (resultado.codigo === '0') aceptados.set(resultado.id, cdrZip);
      }

      console.log(`[sendBill] ${resultado.id} → CDR ${resultado.codigo}: ${resultado.descripcion}`);
      return res.send(respuestaSendBill(cdrZip));
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
