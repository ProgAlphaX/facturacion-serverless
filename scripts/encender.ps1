# Crea el NAT Gateway y la EC2 (~0.06 USD por hora). Al terminar: scripts\apagar.ps1
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..\infra\terraform')
try {
    terraform apply '-var=enable_nat=true' '-var=enable_ec2=true'
    if ($LASTEXITCODE -ne 0) { throw 'Error en terraform apply' }
    terraform output entrar_a_la_ec2
    Write-Host 'La EC2 tarda unos 5 minutos en instalar Docker y levantar los contenedores.' -ForegroundColor Yellow
    Write-Host 'No olvides apagar con: scripts\apagar.ps1' -ForegroundColor Yellow
}
finally {
    Pop-Location
}
