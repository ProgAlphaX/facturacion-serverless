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

output "tabla_dynamodb" {
  value = aws_dynamodb_table.comprobantes.name
}

output "bucket_comprobantes" {
  value = aws_s3_bucket.comprobantes.bucket
}

output "ec2_id" {
  value = var.enable_ec2 ? aws_instance.app[0].id : "apagada"
}

output "ec2_ip_privada" {
  value = var.enable_ec2 ? aws_instance.app[0].private_ip : "apagada"
}

output "entrar_a_la_ec2" {
  value = var.enable_ec2 ? "aws ssm start-session --target ${aws_instance.app[0].id}" : "EC2 apagada"
}
