// Solo para el entorno local (docker compose): en AWS la tabla la crea Terraform.

const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const cliente = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT,
});
const tabla = process.env.DYNAMODB_TABLE;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function crearTabla() {
  for (let intento = 1; intento <= 30; intento += 1) {
    try {
      await cliente.send(new CreateTableCommand({
        TableName: tabla,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
      }));
      console.log(`Tabla ${tabla} creada`);
      return;
    } catch (err) {
      if (err.name === 'ResourceInUseException') {
        console.log(`La tabla ${tabla} ya existe`);
        return;
      }
      console.log(`DynamoDB local aún no responde (intento ${intento}): ${err.name}`);
      await esperar(1000);
    }
  }
  throw new Error('No se pudo crear la tabla en DynamoDB local');
}

crearTabla().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
