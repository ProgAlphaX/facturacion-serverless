data "aws_ssm_parameter" "ami_al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "app" {
  count = var.enable_ec2 ? 1 : 0

  ami                         = data.aws_ssm_parameter.ami_al2023.insecure_value
  instance_type               = var.tipo_instancia
  subnet_id                   = aws_subnet.privada[0].id
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = false

  # IMDSv2 obligatorio; hop limit 2 para que los contenedores puedan usar el rol de la instancia
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 10
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    region              = var.region
    repo_url            = var.repo_url
    repo_branch         = var.repo_branch
    compose_version     = var.compose_version
    buildx_version      = var.buildx_version
    tabla               = aws_dynamodb_table.comprobantes.name
    bucket              = aws_s3_bucket.comprobantes.bucket
    param_certificado   = aws_ssm_parameter.certificado.name
    param_llave         = aws_ssm_parameter.llave_privada.name
    emisor_ruc          = var.emisor_ruc
    emisor_razon_social = var.emisor_razon_social
    sunat_usuario       = var.sunat_usuario
    sunat_clave         = var.sunat_clave
  })
  user_data_replace_on_change = true

  tags = { Name = "${local.nombre}-ec2-app" }

  lifecycle {
    precondition {
      condition     = var.enable_nat
      error_message = "La EC2 necesita el NAT para instalar Docker y descargar el código: usa también enable_nat = true."
    }
  }

  depends_on = [aws_route.privada_nat]
}
