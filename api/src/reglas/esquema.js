// Solo valida la forma del JSON; las reglas SUNAT están en reglas-negocio.js.

const { z } = require('zod');

z.config(z.locales.es());

const texto = z.string().trim().min(1);

const esquemaComprobante = z.object({
  tipo: texto,
  serie: texto,
  numero: z.number().int(),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: AAAA-MM-DD'),
  moneda: texto,
  cliente: z.object({
    tipoDoc: texto,
    numDoc: texto,
    nombre: texto.max(200),
  }),
  items: z.array(
    z.object({
      descripcion: texto.max(250),
      unidad: texto.max(3).default('NIU'),
      cantidad: z.number(),
      valorUnitario: z.number(),
    }),
  ),
  totales: z.object({
    valorVenta: z.number(),
    igv: z.number(),
    total: z.number(),
  }),
});

function validarEsquema(cuerpo) {
  const resultado = esquemaComprobante.safeParse(cuerpo);
  if (resultado.success) return { datos: resultado.data, errores: [] };

  const errores = resultado.error.issues.map((issue) => ({
    regla: 'ESQUEMA',
    campo: issue.path.join('.') || '(cuerpo)',
    mensaje: issue.message,
  }));
  return { datos: null, errores };
}

module.exports = { validarEsquema };
