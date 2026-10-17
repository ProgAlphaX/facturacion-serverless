variable "region" {
  type    = string
  default = "us-east-1"
}

variable "proyecto" {
  type    = string
  default = "facturacion-serverless"
}

variable "entorno" {
  type    = string
  default = "dev"
}

variable "cidr_vpc" {
  type    = string
  default = "10.0.0.0/16"
}

variable "zonas" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "emisor_ruc" {
  type    = string
  default = "20000000001"
}

variable "emisor_razon_social" {
  type    = string
  default = "EMPRESA DEMO S.A.C."
}

variable "sunat_usuario" {
  description = "Usuario SOL de la SUNAT simulada (credenciales públicas del entorno beta de SUNAT)"
  type        = string
  default     = "MODDATOS"
}

variable "sunat_clave" {
  type      = string
  default   = "moddatos"
  sensitive = true
}

variable "enable_nat" {
  description = "Crea el NAT Gateway (cobra por hora). Solo para pruebas y demo."
  type        = bool
  default     = false
}

variable "enable_ec2" {
  description = "Crea la EC2 de la aplicación (cobra por hora). Requiere enable_nat = true."
  type        = bool
  default     = false
}

variable "tipo_instancia" {
  type    = string
  default = "t3.micro"
}

variable "repo_url" {
  type    = string
  default = "https://github.com/ProgAlphaX/facturacion-serverless.git"
}

variable "repo_branch" {
  type    = string
  default = "dev"
}

variable "compose_version" {
  description = "Versión fija de Docker Compose que instala la EC2"
  type        = string
  default     = "v5.6.0"
}
