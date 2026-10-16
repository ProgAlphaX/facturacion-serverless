const FACTORES_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS_RUC = ['10', '15', '17', '20'];

// Dígito verificador SUNAT: módulo 11 con los factores 5,4,3,2,7,6,5,4,3,2.
function esRucValido(ruc) {
  if (typeof ruc !== 'string' || !/^\d{11}$/.test(ruc)) return false;
  if (!PREFIJOS_RUC.includes(ruc.slice(0, 2))) return false;

  const suma = FACTORES_RUC.reduce((acc, factor, i) => acc + factor * Number(ruc[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 10) verificador = 0;
  if (verificador === 11) verificador = 1;

  return verificador === Number(ruc[10]);
}

function esDniValido(dni) {
  return typeof dni === 'string' && /^\d{8}$/.test(dni);
}

module.exports = { esRucValido, esDniValido };
