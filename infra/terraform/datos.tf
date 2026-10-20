resource "aws_dynamodb_table" "comprobantes" {
  name         = "${local.nombre}-comprobantes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  # Recuperación a cualquier segundo de los últimos 35 días (RPO); con pocos KB su costo es casi cero
  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = false # false = cifrado con llave propiedad de AWS (gratis); true exigiría KMS
  }
}

resource "aws_s3_bucket" "comprobantes" {
  bucket = "${local.nombre}-comprobantes-${data.aws_caller_identity.actual.account_id}"
  # Proyecto académico: permite destruir el bucket aunque tenga archivos
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "comprobantes" {
  bucket                  = aws_s3_bucket.comprobantes.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "comprobantes" {
  bucket = aws_s3_bucket.comprobantes.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "comprobantes" {
  bucket = aws_s3_bucket.comprobantes.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "comprobantes" {
  bucket = aws_s3_bucket.comprobantes.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "comprobantes" {
  bucket = aws_s3_bucket.comprobantes.id

  rule {
    id     = "limpiar-versiones-antiguas"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  depends_on = [aws_s3_bucket_versioning.comprobantes]
}

data "aws_iam_policy_document" "solo_tls" {
  statement {
    sid     = "RechazarConexionesSinTLS"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.comprobantes.arn,
      "${aws_s3_bucket.comprobantes.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "comprobantes" {
  bucket = aws_s3_bucket.comprobantes.id
  policy = data.aws_iam_policy_document.solo_tls.json

  depends_on = [aws_s3_bucket_public_access_block.comprobantes]
}
