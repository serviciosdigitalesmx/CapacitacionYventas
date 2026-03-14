#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANTILLAS="$ROOT/plantillas"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$ROOT/docs/reporte-sanitizado-core-$STAMP.md"

repl(){ OLD="$1" NEW="$2" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$3"; }

# remove backup dirs so they are never cloned again
find "$PLANTILLAS" -type d \( -name '_premerge_backup_*' -o -name '_integracion4_backup_*' -o -name '_postfix_backup_*' \) -prune -exec rm -rf {} +

printf '# Sanitizado core\n\n| plantilla | estado |\n|---|---|\n' > "$REPORT"
count=0
for d in "$PLANTILLAS"/[0-9][0-9]_*; do
  [ -d "$d" ] || continue
  # neutral logo
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=' | base64 -d > "$d/logo.png"
  rm -f "$d/logo.webp"

  while IFS= read -r f; do
    repl 'SrFix Oficial' '{{BRAND}}' "$f"
    repl 'SrFix' '{{BRAND}}' "$f"
    repl 'SRFIX' '{{BRAND_UPPER}}' "$f"
    repl 'Plantilla Tecnico' '{{BRAND}}' "$f"
    repl 'Plantilla Técnico' '{{BRAND}}' "$f"
    repl 'PLANTILLA TECNICO' '{{BRAND_UPPER}}' "$f"
    repl 'Plantilla Tecnico Monterrey' '{{BRAND}} · {{CITY}}' "$f"

    repl 'Monterrey, N.L.' '{{CITY}}' "$f"
    repl 'Plaza Chapultepec' '{{CITY}}' "$f"
    repl 'San Nicolás de los Garza' '{{CITY}}' "$f"

    repl '528117006536' '{{WHATSAPP}}' "$f"
    repl '528100000000' '{{WHATSAPP}}' "$f"
    repl '8117006536' '{{WHATSAPP_LOCAL}}' "$f"
    repl '81 1700 6536' '{{WHATSAPP_HUMAN}}' "$f"

    repl 'https://script.google.com/macros/s/AKfycbxH1zD8_14TvCajstFhtEpLNODwG9GZXkLoCXOb1IBNm0JIRmpCwS6SRsuGhZETK88z/exec' '{{BACKEND_URL}}' "$f"
    repl 'https://script.google.com/macros/s/BASE/exec' '{{BACKEND_URL}}' "$f"
    repl 'https://maps.app.goo.gl/WfZYxbunp9XhXHgr5' '{{MAPS_URL}}' "$f"
    repl 'https://maps.app.goo.gl/BASE' '{{MAPS_URL}}' "$f"

    repl 'Reparación <span>Profesional</span> de Electrónicos' 'Gestión <span>Profesional</span> de {{GIRO_LABEL}}' "$f"
    repl 'Reparación Profesional de Electrónicos' 'Gestión Profesional de {{GIRO_LABEL}}' "$f"
    repl 'Laptops & Surface' '{{GIRO_LABEL}} · Servicio 1' "$f"
    repl 'Tarjetas de Video (GPU)' '{{GIRO_LABEL}} · Servicio 2' "$f"
    repl 'Consolas & Controles' '{{GIRO_LABEL}} · Servicio 3' "$f"
    repl 'Smartphones & Tablets' '{{GIRO_LABEL}} · Servicio 4' "$f"
    repl 'PCs de Escritorio' '{{GIRO_LABEL}} · Servicio 5' "$f"
    repl 'Tipo de Dispositivo' 'Tipo de servicio' "$f"
    repl 'Marca y Modelo Exacto' 'Detalle del servicio' "$f"
    repl 'Problema(s) Presentados' 'Requerimientos del servicio' "$f"

    repl '#db321f' '{{COLOR_PRIMARY}}' "$f"
    repl '#1F7EDC' '{{COLOR_PRIMARY}}' "$f"
    repl '#ff6929' '{{COLOR_ACCENT}}' "$f"
    repl '#FF6A2A' '{{COLOR_ACCENT}}' "$f"
  done < <(find "$d" -maxdepth 1 -type f \( -name 'index.html' -o -name 'Pagina-principal.html' -o -name 'Pagina-principal.js' -o -name 'portal-cliente.html' -o -name 'portal-cliente.js' -o -name 'panel-operativo.html' -o -name 'panel-operativo.js' -o -name 'panel-tecnico.html' -o -name 'panel-tecnico.js' -o -name 'panel-solicitudes.html' -o -name 'panel-solicitudes.js' -o -name 'panel-archivo.html' -o -name 'panel-archivo.js' -o -name '*.css' \))

  echo "| $(basename "$d") | OK |" >> "$REPORT"
  count=$((count+1))
done

echo "\nTotal: $count" >> "$REPORT"
echo "OK $count" 
echo "$REPORT"
