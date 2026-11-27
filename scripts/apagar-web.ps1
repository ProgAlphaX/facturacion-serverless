#Requires -Version 7
<#
Apaga el backend serverless (serverless remove) y comprueba que no quede nada que cobre por hora.
Los datos (DynamoDB, S3, SSM) los conserva Terraform: no se tocan. El usuario de Cognito y la llave de API SÍ se
eliminan junto con la pila; ./scripts/preparar-web.ps1 los vuelve a crear.

Uso (desde la raíz del repositorio):  ./scripts/apagar-web.ps1
#>
param(
  [string]$Perfil = 'fe-dev',
  [string]$Region = 'us-east-1',
  [string]$Etapa = 'dev'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent

& aws cloudformation describe-stacks --stack-name "fe-serverless-$Etapa" --profile $Perfil --region $Region *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host 'Eliminando la pila serverless...' -ForegroundColor Cyan
  Push-Location (Join-Path $raiz 'serverless')
  try {
    $env:AWS_PROFILE = $Perfil
    npx serverless remove --stage $Etapa
    if ($LASTEXITCODE -ne 0) { throw 'serverless remove falló.' }
  } finally { Pop-Location }
} else {
  Write-Host 'La pila ya no existe; solo se comprueba que no quede nada encendido.' -ForegroundColor Cyan
}

function Get-Aws {
  $salida = & aws @args --profile $Perfil --region $Region --output text
  if ($LASTEXITCODE -ne 0) { throw "Falló: aws $($args -join ' ')" }
  ($salida -join ' ').Trim()
}

& aws cloudformation describe-stacks --stack-name "fe-serverless-$Etapa" --profile $Perfil --region $Region *> $null
$pilaEliminada = $LASTEXITCODE -ne 0
$nat = Get-Aws ec2 describe-nat-gateways --filter 'Name=state,Values=pending,available' --query 'NatGateways[].NatGatewayId'
$instancias = Get-Aws ec2 describe-instances --filters 'Name=instance-state-name,Values=pending,running' --query 'Reservations[].Instances[].InstanceId'
$ips = Get-Aws ec2 describe-addresses --query 'Addresses[].PublicIp'

$filas = @(
  [pscustomobject]@{ Recurso = 'Pila fe-serverless-' + $Etapa; Estado = $(if ($pilaEliminada) { 'eliminada' } else { 'SIGUE ENCENDIDA' }) }
  [pscustomobject]@{ Recurso = 'NAT Gateway'; Estado = $(if ($nat) { "ENCENDIDO ($nat)" } else { 'ninguno' }) }
  [pscustomobject]@{ Recurso = 'Instancias EC2'; Estado = $(if ($instancias) { "ENCENDIDAS ($instancias)" } else { 'ninguna' }) }
  [pscustomobject]@{ Recurso = 'IP elásticas'; Estado = $(if ($ips) { "ASIGNADAS ($ips)" } else { 'ninguna' }) }
)
Write-Host ''
$filas | Format-Table -AutoSize
if ($pilaEliminada -and -not $nat -and -not $instancias -and -not $ips) {
  Write-Host 'Todo apagado: no queda nada que cobre por hora.' -ForegroundColor Green
} else {
  Write-Host 'Revisa lo marcado en mayúsculas.' -ForegroundColor Red
  exit 1
}
