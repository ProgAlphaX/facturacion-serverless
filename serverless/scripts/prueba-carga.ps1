#Requires -Version 7
<#
Demostración de escalado: emite facturas a ritmo constante y muestra cómo respondió la API.
En el panel de CloudWatch las ejecuciones simultáneas suben durante la prueba y vuelven a 0 al terminar.

Uso (desde serverless/):  ./scripts/prueba-carga.ps1
                          ./scripts/prueba-carga.ps1 -PorSegundo 3    (pasa el límite de 10 simultáneas de la cuenta)
La contraseña se toma de FE_PASSWORD o se pide por pantalla; no se guarda.
Crea comprobantes de prueba reales y consume la cuota de la API (1 000 peticiones por día).
#>
param(
  [ValidateRange(5, 120)][int]$Segundos = 45,
  [ValidateRange(1, 5)][int]$PorSegundo = 2,
  [string]$Perfil = 'fe-dev',
  [string]$Region = 'us-east-1',
  [string]$Etapa = 'dev',
  [string]$Usuario = 'tester'
)

$ErrorActionPreference = 'Stop'

function Invoke-Aws {
  $salida = & aws @args --profile $Perfil --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Falló: aws $($args -join ' ')" }
  ($salida -join "`n").Trim()
}

function Get-SalidaPila($clave) {
  Invoke-Aws cloudformation describe-stacks --stack-name "fe-serverless-$Etapa" `
    --query "Stacks[0].Outputs[?OutputKey=='$clave'].OutputValue" --output text
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

$base = Get-Content (Join-Path $PSScriptRoot '../../ejemplos/factura-valida.json') -Raw | ConvertFrom-Json
$zonaLima = [TimeZoneInfo]::FindSystemTimeZoneById('SA Pacific Standard Time')
$base.fechaEmision = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $zonaLima).ToString('yyyy-MM-dd')
$plantilla = $base | ConvertTo-Json -Depth 10
$primero = Get-Random -Minimum 80000000 -Maximum 89000000
$total = $Segundos * $PorSegundo

Write-Host "Enviando $total facturas: $PorSegundo por segundo durante $Segundos s..." -ForegroundColor Cyan
$inicio = [DateTime]::UtcNow
$resultados = 0..($total - 1) | ForEach-Object -ThrottleLimit 12 -Parallel {
  # Cada petición espera su turno para mantener el ritmo
  $espera = ($using:inicio).AddSeconds($_ / $using:PorSegundo) - [DateTime]::UtcNow
  if ($espera.TotalMilliseconds -gt 0) { Start-Sleep -Milliseconds $espera.TotalMilliseconds }
  $cuerpo = ($using:plantilla) | ConvertFrom-Json
  $cuerpo.numero = ($using:primero) + $_
  $reloj = [Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-WebRequest -Uri "$($using:url)/comprobantes" -Method Post -ContentType 'application/json' -SkipHttpErrorCheck `
    -Headers @{ Authorization = $using:jwt; 'x-api-key' = $using:llave } -Body ($cuerpo | ConvertTo-Json -Depth 10)
  [pscustomobject]@{ Codigo = [int]$r.StatusCode; Segundos = $reloj.Elapsed.TotalSeconds }
}

Write-Host ''
$resultados | Group-Object Codigo | Sort-Object Name | ForEach-Object {
  $nombre = @{ '201' = 'emitidas'; '429' = 'frenadas por el plan de uso'; '500' = 'sin instancia libre (límite de 10 de la cuenta)' }[$_.Name]
  Write-Host ("  HTTP {0}: {1,4}  {2}" -f $_.Name, $_.Count, $nombre)
}
$tiempos = @($resultados | Where-Object Codigo -EQ 201 | ForEach-Object Segundos | Sort-Object)
if ($tiempos.Count) {
  Write-Host ("  Emisión: mediana {0:N1} s · p95 {1:N1} s" -f $tiempos[[int][math]::Floor($tiempos.Count * 0.5)], $tiempos[[int][math]::Floor(($tiempos.Count - 1) * 0.95)])
}
Write-Host ''
Write-Host "Abre CloudWatch → Paneles → fe-$Etapa-facturacion y espera 1 a 2 minutos: las simultáneas suben y vuelven a 0." -ForegroundColor Green
