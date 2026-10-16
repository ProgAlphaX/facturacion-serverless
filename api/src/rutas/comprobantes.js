// Endpoints de comprobantes: emitir (POST) y consultar (GET).

const { Router } = require('express');
const { FORMATO_ID } = require('../almacenamiento/dynamo');

function rutasComprobantes({ servicio, repositorio }) {
  const router = Router();

  router.post('/', async (req, res) => {
    const resultado = await servicio.emitir(req.body);
    res.status(201).json(resultado);
  });

  router.get('/:id', async (req, res) => {
    if (!FORMATO_ID.test(req.params.id)) {
      return res.status(404).json({ error: 'Formato de id esperado: RUC-TIPO-SERIE-NUMERO (ej. 20000000001-01-F001-00000001)' });
    }
    const comprobante = await repositorio.obtener(req.params.id);
    if (!comprobante) {
      return res.status(404).json({ error: `No existe el comprobante ${req.params.id}` });
    }
    return res.json(comprobante);
  });

  return router;
}

module.exports = { rutasComprobantes };
