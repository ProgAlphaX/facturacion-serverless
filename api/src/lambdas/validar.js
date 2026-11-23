const { validarEsquema } = require('../reglas/esquema');
const { validarReglas, hoyEnLima } = require('../reglas/reglas-negocio');

exports.handler = async (event) => {
  const { datos, errores } = validarEsquema(event);
  if (errores.length > 0) return { valido: false, errores };

  const erroresReglas = validarReglas(datos, {
    emisorRuc: process.env.EMISOR_RUC,
    hoy: hoyEnLima(),
  });
  if (erroresReglas.length > 0) return { valido: false, errores: erroresReglas };

  return { valido: true, datos };
};