function cargarConfig(env = process.env) {
  return {
    puerto: Number(env.SUNAT_MOCK_PORT) || 4000,
    usuario: env.SUNAT_USUARIO || 'MODDATOS',
    clave: env.SUNAT_CLAVE || 'moddatos',
    rucsInactivos: (env.RUCS_INACTIVOS || '20123456786')
      .split(',')
      .map((ruc) => ruc.trim())
      .filter(Boolean),
  };
}

module.exports = { cargarConfig };
