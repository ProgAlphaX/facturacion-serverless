# Destruye el NAT Gateway y la EC2. Conserva la red, DynamoDB, S3 y el certificado (no cobran por hora).
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..\infra\terraform')
try {
    terraform apply '-var=enable_nat=false' '-var=enable_ec2=false'
    if ($LASTEXITCODE -ne 0) { throw 'Error en terraform apply' }
    Write-Host 'NAT y EC2 apagados. Los datos en DynamoDB y S3 se conservan.' -ForegroundColor Green
}
finally {
    Pop-Location
}
