#!/usr/bin/env bash
# Pruebas rápidas de la API con los mismos casos que la colección de Postman.
# Uso (en la EC2 o en la PC con docker compose):  bash scripts/probar-api.sh
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RUC_EMISOR="${RUC_EMISOR:-20000000001}"
# Fecha de Perú (UTC-5): la regla R04 rechaza fechas futuras
HOY="$(date -u -d '-5 hours' +%F)"

aleatorio() { echo $(( ((RANDOM << 15) | RANDOM) % 90000000 + 1000 )); }

comprobante() {
  local tipo=$1 serie=$2 numero=$3 tipo_doc=$4 num_doc=$5 nombre=$6 cantidad=$7 valor=$8 venta=$9 igv=${10} total=${11}
  printf '{"tipo":"%s","serie":"%s","numero":%s,"fechaEmision":"%s","moneda":"PEN",' "$tipo" "$serie" "$numero" "$HOY"
  printf '"cliente":{"tipoDoc":"%s","numDoc":"%s","nombre":"%s"},' "$tipo_doc" "$num_doc" "$nombre"
  printf '"items":[{"descripcion":"Servicio de consultoria","unidad":"ZZ","cantidad":%s,"valorUnitario":%s}],' "$cantidad" "$valor"
  printf '"totales":{"valorVenta":%s,"igv":%s,"total":%s}}' "$venta" "$igv" "$total"
}

resumen() { grep -oE '"(estado|regla)":"[A-Z0-9_]+"|"codigo":"[0-9]+"' <<<"$1" | head -3 | tr '\n' ' '; }

aprobadas=0
fallidas=0

# probar <nombre> <método> <ruta> <código esperado> <texto esperado> [cuerpo]
probar() {
  local respuesta codigo cuerpo
  if [ -n "${6:-}" ]; then
    respuesta=$(curl -s -w '\n%{http_code}' -X "$2" "$BASE_URL$3" -H 'Content-Type: application/json' -d "$6")
  else
    respuesta=$(curl -s -w '\n%{http_code}' -X "$2" "$BASE_URL$3")
  fi
  codigo=$(tail -n1 <<<"$respuesta")
  cuerpo=$(sed '$d' <<<"$respuesta")

  if [ "$codigo" = "$4" ] && grep -q -- "$5" <<<"$cuerpo"; then
    printf '  ✅ %-46s HTTP %s  %s\n' "$1" "$codigo" "$(resumen "$cuerpo")"
    aprobadas=$((aprobadas + 1))
  else
    printf '  ❌ %-46s HTTP %s (esperado %s)\n     %s\n' "$1" "$codigo" "$4" "$cuerpo"
    fallidas=$((fallidas + 1))
  fi
}

NUM_FACTURA=$(aleatorio)
ID_FACTURA=$(printf '%s-01-F001-%08d' "$RUC_EMISOR" "$NUM_FACTURA")

echo "Probando $BASE_URL  (fecha $HOY)"
echo
probar "Health" GET /health 200 '"status":"ok"'
probar "Factura válida → ACEPTADO (CDR 0)" POST /comprobantes 201 '"estado":"ACEPTADO"' \
  "$(comprobante 01 F001 "$NUM_FACTURA" 6 20100070970 'CLIENTE DEMO S.A.' 2 100 200 36 236)"
probar "Boleta válida → ACEPTADO" POST /comprobantes 201 '"estado":"ACEPTADO"' \
  "$(comprobante 03 B001 "$(aleatorio)" 1 12345678 'JUAN PEREZ QUISPE' 3 50 150 27 177)"
probar "RUC inactivo → RECHAZADO por SUNAT (2017)" POST /comprobantes 201 '"codigo":"2017"' \
  "$(comprobante 01 F001 "$(aleatorio)" 6 20123456786 'EMPRESA DADA DE BAJA' 1 100 100 18 118)"
probar "IGV incorrecto → 400 (R10)" POST /comprobantes 400 '"regla":"R10"' \
  "$(comprobante 01 F001 "$(aleatorio)" 6 20100070970 'CLIENTE DEMO S.A.' 2 100 200 30 230)"
probar "Boleta > S/ 700 sin DNI → 400 (R08)" POST /comprobantes 400 '"regla":"R08"' \
  "$(comprobante 03 B001 "$(aleatorio)" 0 - 'CLIENTES VARIOS' 1 800 800 144 944)"
probar "Factura repetida → 409 (R12)" POST /comprobantes 409 '"regla":"R12"' \
  "$(comprobante 01 F001 "$NUM_FACTURA" 6 20100070970 'CLIENTE DEMO S.A.' 2 100 200 36 236)"
probar "Consultar la factura emitida → 200" GET "/comprobantes/$ID_FACTURA" 200 '"estado":"ACEPTADO"'

echo
echo "Resultado: $aprobadas correctas, $fallidas con error"
echo
echo "Id de la factura emitida (para la prueba de reinicio):"
echo "  $ID_FACTURA"
echo "Consultarla después:"
echo "  curl -s $BASE_URL/comprobantes/$ID_FACTURA"

[ "$fallidas" -eq 0 ]
