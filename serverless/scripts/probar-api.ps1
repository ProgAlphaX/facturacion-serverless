#Requires -Version 7
<#
Prueba de integración de la API desplegada (Fase 8): corre los casos de la entrega y muestra una tabla con el resultado.

Uso (desde serverless/):
  ./scripts/probar-api.ps1
  ./scripts/probar-api.ps1 -Perfil fe-dev -Usuario tester

Necesita: AWS CLI con el perfil indicado, la pila desplegada (npx serverless deploy) y el usuario de Cognito creado.
La contraseña se toma de la variable FE_PASSWORD o se pide por pantalla; nunca se guarda ni se imprime.
Crea comprobantes de prueba reales (números al azar) en la cuenta, así que cada corrida deja datos nuevos.
#>
param(
  [string]$Perfil = 'fe-dev',
  [string]$Region = 'us-east-1',
  [string]$Etapa = 'dev',
  [string]$Usuario = 'tester',
  [int]$EsperaPdfSegundos = 40
)

$ErrorActionPreference = 'Stop'
$ejemplos = Join-Path $PSScriptRoot '../../ejemplos'

function Invoke-Aws {
  $salida = & aws @args --profile $Perfil --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Falló: aws $($args -join ' ')" }
  ($salida -join "`n").Trim()
}

function Get-SalidaPila($clave) {
  Invoke-Aws cloudformation describe-stacks --stack-name "fe-serverless-$Etapa" `
    --query "Stacks[0].Outputs[?OutputKey=='$clave'].OutputValue" --output text
}

# ── Credenciales ────────────────────────────────────────────────────────────
Write-Host 'Preparando credenciales...' -ForegroundColor Cyan
$url = Get-SalidaPila 'UrlApi'
$clienteId = Get-SalidaPila 'ClienteApiId'
$llaveId = Get-SalidaPila 'LlaveApiId'
if (-not $url -or -not $clienteId -or -not $llaveId) { throw 'No se encontraron las salidas de la pila. ¿Ya hiciste npx serverless deploy?' }

$clave = $env:FE_PASSWORD
if (-not $clave) {
  $segura = Read-Host "Contraseña de Cognito para '$Usuario'" -AsSecureString
  $clave = [System.Net.NetworkCredential]::new('', $segura).Password
}
$jwt = Invoke-Aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $clienteId `
  --auth-parameters "USERNAME=$Usuario,PASSWORD=$clave" --query AuthenticationResult.IdToken --output text
$key = Invoke-Aws apigateway get-api-key --api-key $llaveId --include-value --query value --output text
$cuenta = Invoke-Aws sts get-caller-identity --query Account --output text
$bucket = "fe-$Etapa-comprobantes-$cuenta"

$cabeceras = @{ Authorization = $jwt; 'x-api-key' = $key }
$soloLlave = @{ 'x-api-key' = $key }
$soloJwt = @{ Authorization = $jwt }

# ── Utilidades ──────────────────────────────────────────────────────────────
$zonaLima = try { [TimeZoneInfo]::FindSystemTimeZoneById('SA Pacific Standard Time') } catch { [TimeZoneInfo]::FindSystemTimeZoneById('America/Lima') }
$hoy = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $zonaLima).ToString('yyyy-MM-dd')

function Get-Comprobante($archivo) {
  $c = Get-Content (Join-Path $ejemplos "$archivo.json") -Raw | ConvertFrom-Json
  $c.numero = Get-Random -Minimum 90000000 -Maximum 99999999
  $c.fechaEmision = $hoy
  $c
}

function Send-Api($metodo, $ruta, $cuerpo, $encabezados) {
  $p = @{ Uri = "$url$ruta"; Method = $metodo; Headers = $encabezados; SkipHttpErrorCheck = $true }
  if ($cuerpo) { $p.Body = ($cuerpo | ConvertTo-Json -Depth 10); $p.ContentType = 'application/json' }
  $r = Invoke-WebRequest @p
  $json = try { $r.Content | ConvertFrom-Json } catch { $null }
  [pscustomobject]@{ Codigo = [int]$r.StatusCode; Cuerpo = $json }
}

function Test-ExistePdf($id) {
  & aws s3api head-object --bucket $bucket --key "pdf/$id.pdf" --profile $Perfil --region $Region *> $null
  $LASTEXITCODE -eq 0
}

$resultados = [System.Collections.Generic.List[object]]::new()
function Add-Resultado($caso, $esperado, $obtenido, $ok) {
  $resultados.Add([pscustomobject]@{ Caso = $caso; Esperado = $esperado; Obtenido = $obtenido; Resultado = $(if ($ok) { 'OK' } else { 'FALLA' }) })
}

Write-Host "API: $url" -ForegroundColor Cyan
Write-Host 'Ejecutando casos...' -ForegroundColor Cyan

# 1. Factura válida
$factura = Get-Comprobante 'factura-valida'
$idFactura = "$($env:EMISOR_RUC ?? '20000000001')-01-$($factura.serie)-$($factura.numero)"
$r = Send-Api POST '/comprobantes' $factura $cabeceras
Add-Resultado 'Factura válida' '201 ACEPTADO' "$($r.Codigo) $($r.Cuerpo.estado)" ($r.Codigo -eq 201 -and $r.Cuerpo.estado -eq 'ACEPTADO')

# 2. Boleta válida
$boleta = Get-Comprobante 'boleta-valida'
$r = Send-Api POST '/comprobantes' $boleta $cabeceras
Add-Resultado 'Boleta válida' '201 ACEPTADO' "$($r.Codigo) $($r.Cuerpo.estado)" ($r.Codigo -eq 201 -and $r.Cuerpo.estado -eq 'ACEPTADO')

# 3. RUC del cliente inactivo → SUNAT rechaza
$rechazada = Get-Comprobante 'factura-valida'
$rechazada.cliente.numDoc = '20123456786'
$idRechazada = "$($env:EMISOR_RUC ?? '20000000001')-01-$($rechazada.serie)-$($rechazada.numero)"
$r = Send-Api POST '/comprobantes' $rechazada $cabeceras
Add-Resultado 'RUC inactivo (SUNAT rechaza)' '201 RECHAZADO 2017' "$($r.Codigo) $($r.Cuerpo.estado) $($r.Cuerpo.cdr.codigo)" `
  ($r.Codigo -eq 201 -and $r.Cuerpo.estado -eq 'RECHAZADO' -and $r.Cuerpo.cdr.codigo -eq '2017')

# 4. IGV incorrecto
$r = Send-Api POST '/comprobantes' (Get-Comprobante 'factura-igv-incorrecto') $cabeceras
Add-Resultado 'IGV incorrecto' '400 INVALIDO' "$($r.Codigo) $($r.Cuerpo.estado)" ($r.Codigo -eq 400)

# 5. Número repetido
$r = Send-Api POST '/comprobantes' $factura $cabeceras
Add-Resultado 'Número repetido' '409 DUPLICADO' "$($r.Codigo) $($r.Cuerpo.estado)" ($r.Codigo -eq 409)

# 6 y 7. Candados
$r = Send-Api GET "/comprobantes/$idFactura" $null $soloLlave
Add-Resultado 'Sin JWT' '401' "$($r.Codigo)" ($r.Codigo -eq 401)
$r = Send-Api GET "/comprobantes/$idFactura" $null $soloJwt
Add-Resultado 'Sin API key' '403' "$($r.Codigo)" ($r.Codigo -eq 403)

# 8. Consulta por id
$r = Send-Api GET "/comprobantes/$idFactura" $null $cabeceras
Add-Resultado 'GET por id' '200 ACEPTADO' "$($r.Codigo) $($r.Cuerpo.estado)" ($r.Codigo -eq 200 -and $r.Cuerpo.estado -eq 'ACEPTADO')

# 9. PDF automático (lo genera el trigger de S3; puede tardar unos segundos)
$limite = (Get-Date).AddSeconds($EsperaPdfSegundos)
do { $hayPdf = Test-ExistePdf $idFactura; if (-not $hayPdf) { Start-Sleep 3 } } until ($hayPdf -or (Get-Date) -gt $limite)
Add-Resultado 'PDF de la factura aceptada' 'existe pdf/<id>.pdf' $(if ($hayPdf) { 'existe' } else { 'no existe' }) $hayPdf
Add-Resultado 'PDF de la rechazada' 'no existe' $(if (Test-ExistePdf $idRechazada) { 'existe' } else { 'no existe' }) (-not (Test-ExistePdf $idRechazada))

# 10. Listado (GET /comprobantes): la factura recién emitida es de las más nuevas, así que aparece en la primera página
$r = Send-Api GET '/comprobantes?limite=100' $null $cabeceras
$aparece = $r.Codigo -eq 200 -and (@($r.Cuerpo.comprobantes | Where-Object id -eq $idFactura).Count -eq 1)
Add-Resultado 'Listado incluye la factura emitida' '200 y aparece' "$($r.Codigo) $(if ($aparece) { 'aparece' } else { 'no aparece' })" $aparece
$r = Send-Api GET '/comprobantes?estado=INVENTADO' $null $cabeceras
Add-Resultado 'Listado con estado inválido' '400' "$($r.Codigo)" ($r.Codigo -eq 400)

# 11. Descarga: URL temporal de S3 y contenido real del PDF; el PDF de una rechazada no existe
$r = Send-Api GET "/comprobantes/$idFactura/archivos/pdf" $null $cabeceras
$esPdf = $false
if ($r.Codigo -eq 200 -and $r.Cuerpo.url) {
  $archivo = Invoke-WebRequest $r.Cuerpo.url -SkipHttpErrorCheck
  $esPdf = $archivo.StatusCode -eq 200 -and [System.Text.Encoding]::ASCII.GetString($archivo.Content[0..3]) -eq '%PDF'
}
Add-Resultado 'Descarga del PDF por URL temporal' '200 y archivo %PDF' "$($r.Codigo) $(if ($esPdf) { '%PDF' } else { 'otro contenido' })" $esPdf
$r = Send-Api GET "/comprobantes/$idRechazada/archivos/pdf" $null $cabeceras
Add-Resultado 'Descarga del PDF de la rechazada' '404' "$($r.Codigo)" ($r.Codigo -eq 404)

# 12. Ráfaga: debe aparecer algún 429 (hasta 3 intentos; el límite es aproximado)
$conteo = @{}
for ($intento = 1; $intento -le 3 -and -not $conteo.ContainsKey(429); $intento++) {
  $conteo = @{}
  1..80 | ForEach-Object -Parallel {
    (Invoke-WebRequest "$using:url/comprobantes/$using:idFactura" -Headers $using:cabeceras -SkipHttpErrorCheck).StatusCode
  } -ThrottleLimit 8 | Group-Object | ForEach-Object { $conteo[[int]$_.Name] = $_.Count }
}
$detalle = ($conteo.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)×$($_.Value)" }) -join ' '
Add-Resultado 'Ráfaga de 80 peticiones' 'algún 429' $detalle ($conteo.ContainsKey(429))

# ── Resumen ─────────────────────────────────────────────────────────────────
Write-Host ''
$resultados | Format-Table -AutoSize
$fallas = @($resultados | Where-Object Resultado -eq 'FALLA').Count
if ($fallas -eq 0) { Write-Host "Todos los casos pasaron ($($resultados.Count) de $($resultados.Count))." -ForegroundColor Green }
else { Write-Host "$fallas caso(s) fallaron." -ForegroundColor Red; exit 1 }
