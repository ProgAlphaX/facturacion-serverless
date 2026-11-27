# Canal de las alarmas de operación. Vive en la capa permanente para que la suscripción
# por correo se confirme una sola vez y no cada vez que se vuelve a crear la pila serverless.
resource "aws_sns_topic" "alertas" {
  name = "${local.nombre}-alertas"
}

resource "aws_sns_topic_subscription" "alertas_correo" {
  topic_arn = aws_sns_topic.alertas.arn
  protocol  = "email"
  endpoint  = var.correo_operacion
}
