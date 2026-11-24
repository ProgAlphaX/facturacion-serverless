// API Gateway solo publica los cambios de la API si el "Deployment" es un recurso nuevo.
// Este plugin le pone al Deployment un sufijo calculado con la definición de la API (métodos, recursos, autorizador...):
// si algo de eso cambia, el nombre cambia y CloudFormation crea y publica un Deployment nuevo.
const crypto = require('node:crypto');

class VersionApi {
  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = { 'before:package:initialize': () => this.renombrar() };
  }

  renombrar() {
    const recursos = this.serverless.service.resources?.Resources;
    if (!recursos?.DespliegueApi) return;

    const definicion = Object.entries(recursos).filter(([nombre, r]) =>
      nombre !== 'DespliegueApi' && /^AWS::ApiGateway::(Method|Resource|Authorizer|Model|RequestValidator)$/.test(r.Type));
    const sufijo = crypto.createHash('sha1').update(JSON.stringify(definicion)).digest('hex').slice(0, 8);
    const nuevo = `DespliegueApi${sufijo}`;

    recursos[nuevo] = recursos.DespliegueApi;
    delete recursos.DespliegueApi;
    for (const r of Object.values(recursos)) {
      if (r.Properties?.DeploymentId?.Ref === 'DespliegueApi') r.Properties.DeploymentId = { Ref: nuevo };
    }
  }
}

module.exports = VersionApi;
