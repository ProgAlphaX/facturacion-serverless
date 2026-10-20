provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.proyecto
      Environment = var.entorno
      ManagedBy   = "terraform"
      Group       = "Grupo4"
    }
  }
}

data "aws_caller_identity" "actual" {}

locals {
  nombre = "fe-${var.entorno}"
}
