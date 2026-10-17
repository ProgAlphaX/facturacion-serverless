output "vpc_id" {
  value = aws_vpc.principal.id
}

output "subredes_publicas" {
  value = { for s in aws_subnet.publica : s.tags.Name => "${s.cidr_block} (${s.availability_zone})" }
}

output "subredes_privadas" {
  value = { for s in aws_subnet.privada : s.tags.Name => "${s.cidr_block} (${s.availability_zone})" }
}

output "nat_encendido" {
  value = var.enable_nat
}
