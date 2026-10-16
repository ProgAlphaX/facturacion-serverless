// Versiones en memoria de DynamoDB y S3 para probar la API sin infraestructura.

function crearRepositorioEnMemoria() {
  const items = new Map();
  return {
    items,
    async reservar(registro) {
      const actual = items.get(registro.id);
      if (actual && actual.estado !== 'ERROR_ENVIO') return false;
      items.set(registro.id, { ...registro });
      return true;
    },
    async actualizar(id, campos) {
      items.set(id, { ...items.get(id), ...campos });
    },
    async obtener(id) {
      return items.get(id) || null;
    },
  };
}

function crearAlmacenEnMemoria() {
  const archivos = new Map();
  return {
    archivos,
    async guardar(clave, contenido) {
      archivos.set(clave, contenido);
      return clave;
    },
  };
}

module.exports = { crearRepositorioEnMemoria, crearAlmacenEnMemoria };
