resource "aws_vpc" "principal" {
  cidr_block           = var.cidr_vpc
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.nombre}-vpc" }
}

# El grupo por defecto de la VPC permite tráfico interno: se deja sin reglas para que nada lo use por error
resource "aws_default_security_group" "principal" {
  vpc_id = aws_vpc.principal.id
  tags   = { Name = "${local.nombre}-sg-default-bloqueado" }
}

resource "aws_internet_gateway" "principal" {
  vpc_id = aws_vpc.principal.id
  tags   = { Name = "${local.nombre}-igw" }
}

resource "aws_subnet" "publica" {
  count                   = length(var.zonas)
  vpc_id                  = aws_vpc.principal.id
  cidr_block              = cidrsubnet(var.cidr_vpc, 8, count.index + 1)
  availability_zone       = var.zonas[count.index]
  map_public_ip_on_launch = false

  tags = { Name = "${local.nombre}-public-${substr(var.zonas[count.index], -1, 1)}", Tipo = "publica" }
}

resource "aws_subnet" "privada" {
  count             = length(var.zonas)
  vpc_id            = aws_vpc.principal.id
  cidr_block        = cidrsubnet(var.cidr_vpc, 8, count.index + 11)
  availability_zone = var.zonas[count.index]

  tags = { Name = "${local.nombre}-private-${substr(var.zonas[count.index], -1, 1)}", Tipo = "privada" }
}

resource "aws_eip" "nat" {
  count  = var.enable_nat ? 1 : 0
  domain = "vpc"
  tags   = { Name = "${local.nombre}-eip-nat" }
}

# Un solo NAT (no uno por zona): suficiente para el proyecto y cuesta la mitad
resource "aws_nat_gateway" "principal" {
  count         = var.enable_nat ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.publica[0].id
  tags          = { Name = "${local.nombre}-nat" }

  depends_on = [aws_internet_gateway.principal]
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.principal.id
  }

  tags = { Name = "${local.nombre}-rt-publica" }
}

resource "aws_route_table" "privada" {
  vpc_id = aws_vpc.principal.id
  tags   = { Name = "${local.nombre}-rt-privada" }
}

resource "aws_route" "privada_nat" {
  count                  = var.enable_nat ? 1 : 0
  route_table_id         = aws_route_table.privada.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.principal[0].id
}

resource "aws_route_table_association" "publica" {
  count          = length(var.zonas)
  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}

resource "aws_route_table_association" "privada" {
  count          = length(var.zonas)
  subnet_id      = aws_subnet.privada[count.index].id
  route_table_id = aws_route_table.privada.id
}

# Gateway endpoints (gratis): la red privada llega a S3 y DynamoDB sin pasar por Internet
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.principal.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.privada.id]
  tags              = { Name = "${local.nombre}-endpoint-s3" }
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.principal.id
  service_name      = "com.amazonaws.${var.region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.privada.id]
  tags              = { Name = "${local.nombre}-endpoint-dynamodb" }
}
