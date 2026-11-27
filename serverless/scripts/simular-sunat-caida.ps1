#Requires -Version 7
<#
Demostración de la alerta: apunta enviar-sunat a una dirección que no existe, emite una factura y restaura todo.
Se ven los 3 reintentos, el estado ERROR_ENVIO, la alarma fe-<etapa>-error-envio-sunat y el correo de aviso.

Uso (desde serverless/):  ./scripts/simular-sunat-caida.ps1
La contraseña se toma de FE_PASSWORD o se pide por pantalla; no se guarda.
#>
param(
  [string]$Perfil = 'fe-dev',
  [string]$Region = 'us-east-1',
  [string]$Etapa = 'dev',
  [string]$Usuario = 'tester'
)

$ErrorActionPreference = 'Stop'
$funcion = "fe-serverless-$Etapa-enviar-sunat"

function Invoke-Aws {
  $salida = & aws @args --profile $Perfil --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Falló: aws $($args -join ' ')" }
  ($salida -join "`n").Trim()
}

function Get-SalidaPila($clave) {
  Invoke-Aws cloudformation describe-stacks --stack-name "fe-serverless-$Etapa" `
    --query "Stacks[0].Outputs[?OutputKey=='$clave'].OutputValue" --output text
}

function Set-Variables($variables) {
  $archivo = New-TemporaryFile
  try {
    @{ Variables = $variables } | ConvertTo-Json | Set-Content $archivo
    Invoke-Aws lambda update-function-configuration --function-name $funcion --environment "file://$archivo" | Out-Null
    Invoke-Aws lambda wait function-updated --function-name $funcion | Out-Null
  } finally { Remove-Item $archivo }
}

$url = Get-SalidaPila 'UrlApi'
$clienteId = Get-SalidaPila 'ClienteApiId'
$llave = Invoke-Aws apigateway get-api-key --api-key (Get-SalidaPila 'LlaveApiId') --include-value --query value --output text
$clave = $env:FE_PASSWORD
if (-not $clave) {
  $segura = Read-Host "Contraseña de Cognito para '$Usuario'" -AsSecureString
  $clave = [System.Net.NetworkCredential]::new('', $segura).Password
}
$jwt = Invoke-Aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $clienteId `
  --auth-parameters "USERNAME=$Usuario,PASSWORD=$clave" --query AuthenticationResult.IdToken --output text

$originales = Invoke-Aws lambda get-function-configuration --function-name $funcion --query Environment.Variables --output json |
  ConvertFrom-Json -AsHashtable

$factura = Get-Content (Join-Path $PSScriptRoot '../../ejemplos/factura-valida.json') -Raw | ConvertFrom-Json
$factura.numero = Get-Random -Minimum 90000000 -Maximum 99999999
$zonaLima = [TimeZoneInfo]::FindSystemTimeZoneById('SA Pacific Standard Time')
$factura.fechaEmision = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $zonaLima).ToString('yyyy-MM-dd')

try {
  Write-Host 'Simulando que SUNAT no responde...' -ForegroundColor Yellow
  $rotas = $originales.Clone()
  $rotas['SUNAT_URL'] = 'https://sunat-caida.invalid/billService'
  Set-Variables $rotas

  Write-Host 'Emitiendo una factura (tarda unos 20 segundos por los reintentos)...'
  $reloj = [Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-WebRequest -Uri "$url/comprobantes" -Method Post -ContentType 'application/json' -SkipHttpErrorCheck `
    -Headers @{ Authorization = $jwt; 'x-api-key' = $llave } -Body ($factura | ConvertTo-Json -Depth 10)
  Write-Host "Respuesta $($r.StatusCode) en $([math]::Round($reloj.Elapsed.TotalSeconds, 1)) s: $($r.Content)"
} finally {
  Write-Host 'Restaurando la dirección de SUNAT...' -ForegroundColor Cyan
  Set-Variables $originales
}

Write-Host ''
Write-Host "Listo. En 1 a 3 minutos la alarma fe-$Etapa-error-envio-sunat pasa a 'In alarm' y llega el correo." -ForegroundColor Green
