# Sin reglas de entrada: la EC2 se administra con Session Manager (sin SSH ni puerto 22)
resource "aws_security_group" "app" {
  name        = "${local.nombre}-sg-app"
  description = "EC2 de la aplicacion: sin entrada, solo salida HTTPS"
  vpc_id      = aws_vpc.principal.id
  tags        = { Name = "${local.nombre}-sg-app" }
}

resource "aws_vpc_security_group_egress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  description       = "HTTPS hacia SSM, GitHub, Docker Hub, DynamoDB y S3"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

data "aws_iam_policy_document" "asumir_ec2" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${local.nombre}-rol-ec2-app"
  assume_role_policy = data.aws_iam_policy_document.asumir_ec2.json
}

resource "aws_iam_role_policy_attachment" "app_ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "EstadosEnDynamoDB"
    actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem"]
    resources = [aws_dynamodb_table.comprobantes.arn]
  }

  statement {
    sid       = "ArchivosEnS3"
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${aws_s3_bucket.comprobantes.arn}/*"]
  }

  statement {
    sid     = "CertificadoEnSSM"
    actions = ["ssm:GetParameter"]
    resources = [
      aws_ssm_parameter.certificado.arn,
      aws_ssm_parameter.llave_privada.arn,
    ]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "${local.nombre}-permisos-app"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "app" {
  name = "${local.nombre}-perfil-ec2-app"
  role = aws_iam_role.app.name
}
