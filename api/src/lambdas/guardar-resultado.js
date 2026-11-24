// Tres acciones sobre DynamoDB:
//   RESERVAR  { datos }                     → { id, reservado }   (false si ya existe: 409)
//   FINALIZAR { id, cdr, hash, archivos }   → { id, estado }      (ACEPTADO / RECHAZADO)
//   ERROR     { id, error, hash, archivos } → { id, estado }      (ERROR_ENVIO, se puede reintentar)
const dependencias = require('./dependencias');
const { idComprobante } = require('../sunat/xml-ubl');
const { ESTADOS } = require('../sunat/cdr');

function crearHandler({ repositorio, emisorRuc, ahora = () => new Date().toISOString() }) {
  return async (event) => {
    switch (event.accion) {
      case 'RESERVAR': {
        const id = idComprobante(emisorRuc, event.datos);
        const reservado = await repositorio().reservar({
          id,
          ...event.datos,
          estado: 'PROCESANDO',
          creadoEn: ahora(),
        });
        return { id, reservado };
      }
      case 'FINALIZAR': {
        const { id, cdr, hash, archivos } = event;
        const resumen = { codigo: cdr.codigo, descripcion: cdr.descripcion, observaciones: cdr.observaciones };
        await repositorio().actualizar(id, { estado: cdr.estado, cdr: resumen, hash, archivos });
        return { id, estado: cdr.estado };
      }
      case 'ERROR': {
        const { id, error, hash, archivos } = event;
        await repositorio().actualizar(id, { estado: ESTADOS.ERROR_ENVIO, error, hash, archivos });
        return { id, estado: ESTADOS.ERROR_ENVIO };
      }
      default:
        throw new Error(`Acción no soportada: ${event.accion}`);
    }
  };
}

exports.crearHandler = crearHandler;
exports.handler = (event) =>
  crearHandler({ repositorio: dependencias.repositorio, emisorRuc: process.env.EMISOR_RUC })(event);
