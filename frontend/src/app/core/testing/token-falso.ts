/** Solo para pruebas: arma un JWT sin firma real, suficiente para que la web lea `exp`. */
export function tokenFalso(venceEnSegundos: number): string {
  const codificar = (objeto: object): string => btoa(JSON.stringify(objeto)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + venceEnSegundos;
  return `${codificar({ alg: 'none' })}.${codificar({ exp, 'cognito:username': 'tester' })}.firma`;
}
