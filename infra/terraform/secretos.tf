# Certificado autofirmado de prueba (en producción lo emite una entidad autorizada).
# La llave queda también en el state: por eso el state vive en un bucket privado y cifrado.
resource "tls_private_key" "firma" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "firma" {
  private_key_pem       = tls_private_key.firma.private_key_pem
  validity_period_hours = 8760
  allowed_uses          = ["digital_signature", "content_commitment"]

  subject {
    common_name   = var.emisor_razon_social
    organization  = var.emisor_razon_social
    serial_number = var.emisor_ruc
    country       = "PE"
  }
}

resource "aws_ssm_parameter" "certificado" {
  name  = "/facturacion/${var.entorno}/certificado"
  type  = "String"
  tier  = "Standard"
  value = tls_self_signed_cert.firma.cert_pem
}

resource "aws_ssm_parameter" "llave_privada" {
  name  = "/facturacion/${var.entorno}/llave-privada"
  type  = "SecureString"
  tier  = "Standard"
  value = tls_private_key.firma.private_key_pem_pkcs8
}
