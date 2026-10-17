output "bucket_state" {
  description = "Bucket para el campo bucket de backend.hcl"
  value       = aws_s3_bucket.state.bucket
}
