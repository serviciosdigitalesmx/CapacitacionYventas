#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANTILLAS="$ROOT/plantillas"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$ROOT/docs/reporte-sanitizado-plantillas-$STAMP.md"

replace_literal() {
  local old="$1"
  local new="$2"
  local file="$3"
  OLD="$old" NEW="$new" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$file"
}

slug_to_label() {
  local folder="$1"
  local slug="${folder#*_}"
  slug="${slug//-/ }"
  echo "$slug" | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'
}

mkdir -p "$(dirname "$REPORT")"
{
  echo "# Reporte sanitizado de plantillas"
  echo
  echo "- Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "- Carpeta: $PLANTILLAS"
  echo
  echo "| Plantilla | Estado |"
  echo "|---|---|"
} > "$REPORT"

# Limpieza de backups viejos dentro de plantillas (evita copiar basura al clonar).
find "$PLANTILLAS" -type d \( -name '_premerge_backup_*' -o -name '_integracion4_backup_*' -o -name '_postfix_backup_*' \) -prune -exec rm -rf {} +

# Logo base neutro (1x1 transparente) para no arrastrar branding.
PNG_B64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

count=0
while IFS= read -r dir; do
  base="$(basename "$dir")"
  giro_label="$(slug_to_label "$base")"

  # Logo neutral en plantilla base.
  echo "$PNG_B64" | base64 -d > "$dir/logo.png"
  rm -f "$dir/logo.webp"

  files=$(find "$dir" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.gs' -o -name '*.json' -o -name '*.md' -o -name '*.env' \))
  while IFS= read -r f; do
    # Placeholders de datos comerciales.
    replace_literal "SrFix Oficial" "{{BRAND}}" "$f"
    replace_literal "SrFix" "{{BRAND}}" "$f"
    replace_literal "SRFIX" "{{BRAND_UPPER}}" "$f"
    replace_literal "Plantilla Tecnico" "{{BRAND}}" "$f"
    replace_literal "Plantilla Técnico" "{{BRAND}}" "$f"
    replace_literal "Plantilla Abarrotes" "{{BRAND}}" "$f"
    replace_literal "Plantilla Barberia" "{{BRAND}}" "$f"
    replace_literal "Plantilla Barbería" "{{BRAND}}" "$f"
    replace_literal "Plantilla Academia" "{{BRAND}}" "$f"
    replace_literal "PLANTILLA TECNICO" "{{BRAND_UPPER}}" "$f"
    replace_literal "Plantilla Tecnico Monterrey" "{{BRAND}} · {{CITY}}" "$f"

    replace_literal "Monterrey, N.L." "{{CITY}}" "$f"
    replace_literal "Plaza Chapultepec" "{{CITY}}" "$f"
    replace_literal "San Nicolás de los Garza" "{{CITY}}" "$f"

    replace_literal "528117006536" "{{WHATSAPP}}" "$f"
    replace_literal "528100000000" "{{WHATSAPP}}" "$f"
    replace_literal "8117006536" "{{WHATSAPP_LOCAL}}" "$f"
    replace_literal "81 1700 6536" "{{WHATSAPP_HUMAN}}" "$f"
    replace_literal "+52 81 1700 6536" "+52 {{WHATSAPP_HUMAN}}" "$f"

    replace_literal "https://script.google.com/macros/s/AKfycbxH1zD8_14TvCajstFhtEpLNODwG9GZXkLoCXOb1IBNm0JIRmpCwS6SRsuGhZETK88z/exec" "{{BACKEND_URL}}" "$f"
    replace_literal "https://script.google.com/macros/s/REEMPLAZAR/exec" "{{BACKEND_URL}}" "$f"
    replace_literal "https://script.google.com/macros/s/BASE/exec" "{{BACKEND_URL}}" "$f"

    replace_literal "https://maps.app.goo.gl/WfZYxbunp9XhXHgr5" "{{MAPS_URL}}" "$f"
    replace_literal "https://maps.app.goo.gl/BASE" "{{MAPS_URL}}" "$f"
    replace_literal "https://maps.google.com/?q=SrFix+Oficial+Plaza+Chapultepec" "{{MAPS_URL}}" "$f"
    replace_literal "https://maps.google.com/?q=SrFix+Oficial" "{{MAPS_URL}}" "$f"

    # Textos base neutrales por giro.
    replace_literal "Reparación <span>Profesional</span> de Electrónicos" "Gestión <span>Profesional</span> de {{GIRO_LABEL}}" "$f"
    replace_literal "Reparación Profesional de Electrónicos" "Gestión Profesional de {{GIRO_LABEL}}" "$f"
    replace_literal "Servicio técnico especializado en reparación de laptops, GPUs, controles. Verifica el estado de tu equipo online. Plaza Chapultepec, San Nicolás de los Garza." "Servicio profesional de {{GIRO_LABEL}}. Cotización, seguimiento y atención desde un solo flujo digital." "$f"
    replace_literal "Opiniones verificadas de Google Maps" "Opiniones verificadas de clientes" "$f"
    replace_literal "5.0 Estrellas en Google Maps" "Opiniones verificadas" "$f"

    replace_literal "Laptops & Surface" "{{GIRO_LABEL}} · Servicio 1" "$f"
    replace_literal "Tarjetas de Video (GPU)" "{{GIRO_LABEL}} · Servicio 2" "$f"
    replace_literal "Consolas & Controles" "{{GIRO_LABEL}} · Servicio 3" "$f"
    replace_literal "Smartphones & Tablets" "{{GIRO_LABEL}} · Servicio 4" "$f"
    replace_literal "PCs de Escritorio" "{{GIRO_LABEL}} · Servicio 5" "$f"
    replace_literal "Tipo de Dispositivo" "Tipo de servicio" "$f"
    replace_literal "Marca y Modelo Exacto" "Detalle del servicio" "$f"
    replace_literal "Problema(s) Presentados" "Requerimientos del servicio" "$f"

    # Color tokens.
    replace_literal "#db321f" "{{COLOR_PRIMARY}}" "$f"
    replace_literal "#DB321F" "{{COLOR_PRIMARY}}" "$f"
    replace_literal "#1F7EDC" "{{COLOR_PRIMARY}}" "$f"
    replace_literal "#1f7edc" "{{COLOR_PRIMARY}}" "$f"
    replace_literal "#ff6929" "{{COLOR_ACCENT}}" "$f"
    replace_literal "#FF6A2A" "{{COLOR_ACCENT}}" "$f"
    replace_literal "#ff6a2a" "{{COLOR_ACCENT}}" "$f"

    # Si se dejó el nombre de giro concreto en esta plantilla, llevarlo a token.
    replace_literal "$giro_label" "{{GIRO_LABEL}}" "$f"
  done <<< "$files"

  printf '| %s | OK |\n' "$base" >> "$REPORT"
  count=$((count+1))
done < <(find "$PLANTILLAS" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9]_*' | sort)

{
  echo
  echo "Total: $count"
} >> "$REPORT"

echo "Sanitizado completado"
echo "Reporte: $REPORT"
