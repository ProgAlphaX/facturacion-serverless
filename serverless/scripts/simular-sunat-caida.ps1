#Requires -Version 7
<#
Demostración de la alerta: apunta enviar-sunat a una dirección que no existe y espera.
Mientras tanto se emite una factura DESDE LA WEB; al pulsar Enter se restaura SUNAT.
Se ven los 3 reintentos, el estado ERROR_ENVIO, la alarma fe-<etapa>-error-envio-sunat y el correo de aviso.

Uso (desde serverless/):  ./scripts/simular-sunat-caida.ps1
No pide contraseña. Si la ventana se cerró a medias, vuelve a ejecutarlo y pulsa Enter: deja SUNAT restaurada.
#>
param(
  [string]$Perfil = 'fe-dev',
  [string]$Region = 'us-east-1',
  [string]$Etapa = 'dev'
)

$ErrorActionPreference = 'Stop'
$funcion = "fe-serverless-$Etapa-enviar-sunat"

function Invoke-Aws {
  $salida = & aws @args --profile $Perfil --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Falló: aws $($args -join ' ')" }
  ($salida -join "`n").Trim()
}

function Set-Variables($variables) {
  $archivo = New-TemporaryFile
  try {
    @{ Variables = $variables } | ConvertTo-Json | Set-Content $archivo
    Invoke-Aws lambda update-function-configuration --function-name $funcion --environment "file://$archivo" | Out-Null
    Invoke-Aws lambda wait function-updated --function-name $funcion | Out-Null
  } finally { Remove-Item $archivo }
}

$variables = Invoke-Aws lambda get-function-configuration --function-name $funcion --query Environment.Variables --output json |
  ConvertFrom-Json -AsHashtable
# La dirección correcta se toma de la SUNAT simulada, no de lo que tenga ahora la función (podría estar rota)
$sunat = Invoke-Aws lambda get-function-url-config --function-name "fe-serverless-$Etapa-sunat-mock" --query FunctionUrl --output text
$correctas = $variables.Clone()
$correctas['SUNAT_URL'] = "${sunat}billService"

try {
  Write-Host 'Apagando SUNAT...' -ForegroundColor Yellow
  $rotas = $correctas.Clone()
  $rotas['SUNAT_URL'] = 'https://sunat-caida.invalid/billService'
  Set-Variables $rotas

  Write-Host ''
  Write-Host 'SUNAT ESTÁ CAÍDA. Ahora emite una factura desde la web (tarda unos 20 segundos).' -ForegroundColor Red
  Read-Host 'Cuando la web muestre el error, pulsa Enter para restaurar' | Out-Null
} finally {
  Write-Host 'Restaurando SUNAT...' -ForegroundColor Cyan
  Set-Variables $correctas
}

Write-Host "Listo, SUNAT restaurada. La alarma fe-$Etapa-error-envio-sunat avisa por correo en 1 a 3 minutos." -ForegroundColor Green
