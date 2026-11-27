#Requires -Version 7
<#
Deja listo el backend para usar la web local con AWS: despliega la pila serverless, crea (o actualiza) el usuario de
Cognito y escribe frontend/.env.local con la URL de la API, el cliente de Cognito y la llave de API.

Uso (desde la raíz del repositorio):
  ./scripts/preparar-web.ps1
  ./scripts/preparar-web.ps1 -Perfil fe-dev -Usuario tester

La contraseña del usuario se toma de la variable FE_PASSWORD o se pide por pantalla (oculta). Debe tener 12 o más
caracteres con mayúscula, minúscula y número. NO se guarda en ningún archivo.
Al terminar la demostración: ./scripts/apagar-web.ps1
#>
param(
  [string]$Perfil = 'fe-dev',
  [string]$Region = 'us-east-1',
  [string]$Etapa = 'dev',
  [string]$Usuario = 'tester'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent

function Invoke-Aws {
  $salida = & aws @args --profile $Perfil --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Falló: aws $($args -join ' ')" }
  ($salida -join "`n").Trim()
}

function Get-SalidaPila($clave) {
  Invoke-Aws cloudformation describe-stacks --stack-name "fe-serverless-$Etapa" `
    --query "Stacks[0].Outputs[?OutputKey=='$clave'].OutputValue" --output text
}

# ── Contraseña (se pide antes de desplegar para no hacer esperar al final) ───
$clave = $env:FE_PASSWORD
if (-not $clave) {
  $segura = Read-Host "Contraseña para el usuario '$Usuario' (12 o más caracteres, con mayúscula, minúscula y número)" -AsSecureString
  $clave = [System.Net.NetworkCredential]::new('', $segura).Password
}
if ($clave.Length -lt 12 -or $clave -cnotmatch '[A-Z]' -or $clave -cnotmatch '[a-z]' -or $clave -notmatch '\d') {
  throw 'La contraseña debe tener 12 o más caracteres con mayúscula, minúscula y número.'
}

# ── 1. Desplegar ────────────────────────────────────────────────────────────
Write-Host 'Desplegando la pila serverless (1 a 4 minutos)...' -ForegroundColor Cyan
Push-Location (Join-Path $raiz 'serverless')
try {
  $env:AWS_PROFILE = $Perfil
  # El primer despliegue justo después de apagar puede fallar una vez por restos de la pila anterior: se reintenta.
  foreach ($intento in 1..2) {
    npx serverless deploy --stage $Etapa
    if ($LASTEXITCODE -eq 0) { break }
    if ($intento -eq 2) { throw 'serverless deploy falló dos veces: revisa el mensaje de arriba.' }
    Write-Host 'El despliegue falló; se reintenta una vez...' -ForegroundColor Yellow
  }
} finally { Pop-Location }

# ── 2. Datos de la pila ─────────────────────────────────────────────────────
$url = Get-SalidaPila 'UrlApi'
$clienteId = Get-SalidaPila 'ClienteApiId'
$grupoId = Get-SalidaPila 'GrupoUsuariosId'
$llaveId = Get-SalidaPila 'LlaveApiId'
if (-not $url -or -not $clienteId -or -not $grupoId -or -not $llaveId) { throw 'No se encontraron las salidas de la pila.' }

# ── 3. Usuario de Cognito con contraseña definitiva ─────────────────────────
Write-Host "Preparando el usuario '$Usuario'..." -ForegroundColor Cyan
& aws cognito-idp admin-get-user --user-pool-id $grupoId --username $Usuario --profile $Perfil --region $Region *> $null
if ($LASTEXITCODE -ne 0) {
  Invoke-Aws cognito-idp admin-create-user --user-pool-id $grupoId --username $Usuario --message-action SUPPRESS | Out-Null
}
Invoke-Aws cognito-idp admin-set-user-password --user-pool-id $grupoId --username $Usuario --password $clave --permanent | Out-Null

# ── 4. Llave de API y archivo de configuración de la web ────────────────────
$llave = Invoke-Aws apigateway get-api-key --api-key $llaveId --include-value --query value --output text
$destino = Join-Path $raiz 'frontend/.env.local'
$contenido = @(
  "API_URL=$url"
  "COGNITO_REGION=$Region"
  "COGNITO_CLIENT_ID=$clienteId"
  "API_KEY=$llave"
) -join "`n"
[System.IO.File]::WriteAllText($destino, $contenido + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'Listo. La configuración quedó en frontend/.env.local (ignorado por git).' -ForegroundColor Green
Write-Host 'Siguiente paso:  cd frontend; npm start   (http://localhost:4200, entra con el usuario y la contraseña de arriba)'
Write-Host 'Al terminar:     ./scripts/apagar-web.ps1' -ForegroundColor Yellow
