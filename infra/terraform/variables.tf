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

variable "enable_nat" {
  description = "Crea el NAT Gateway (cobra por hora). Solo para pruebas y demo."
  type        = bool
  default     = false
}
