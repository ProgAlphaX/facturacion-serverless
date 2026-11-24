// Reutiliza la app Express del sunat-mock sin cambiar su lógica: solo la adapta a Lambda.
const serverless = require('serverless-http');
const { cargarConfig } = require('../../sunat-mock/src/config');
const { crearApp } = require('../../sunat-mock/src/app');

exports.handler = serverless(crearApp(cargarConfig()), {
  // El cuerpo SOAP viaja como texto; el CDR de respuesta también es texto (XML con el ZIP en base64)
  binary: false,
});
