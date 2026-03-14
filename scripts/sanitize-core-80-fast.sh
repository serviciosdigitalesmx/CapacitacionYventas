#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANTILLAS="$ROOT/plantillas"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$ROOT/docs/reporte-sanitizado-core-$STAMP.md"

find "$PLANTILLAS" -type d \( -name '_premerge_backup_*' -o -name '_integracion4_backup_*' -o -name '_postfix_backup_*' \) -prune -exec rm -rf {} +

PNG_B64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

printf '# Sanitizado core\n\n| plantilla | estado |\n|---|---|\n' > "$REPORT"
count=0
for d in "$PLANTILLAS"/[0-9][0-9]_*; do
  [ -d "$d" ] || continue
  printf '%s' "$PNG_B64" | base64 -d > "$d/logo.png"
  rm -f "$d/logo.webp"

  find "$d" -maxdepth 1 -type f \( -name 'index.html' -o -name 'Pagina-principal.html' -o -name 'Pagina-principal.js' -o -name 'portal-cliente.html' -o -name 'portal-cliente.js' -o -name 'panel-operativo.html' -o -name 'panel-operativo.js' -o -name 'panel-tecnico.html' -o -name 'panel-tecnico.js' -o -name 'panel-solicitudes.html' -o -name 'panel-solicitudes.js' -o -name 'panel-archivo.html' -o -name 'panel-archivo.js' -o -name '*.css' \) -print0 \
  | while IFS= read -r -d '' f; do
      perl -0777 -i -pe '
        s/\QSrFix Oficial\E/{{BRAND}}/g;
        s/\QSrFix\E/{{BRAND}}/g;
        s/\QSRFIX\E/{{BRAND_UPPER}}/g;
        s/\QPlantilla Tecnico\E/{{BRAND}}/g;
        s/\QPlantilla Técnico\E/{{BRAND}}/g;
        s/\QPLANTILLA TECNICO\E/{{BRAND_UPPER}}/g;
        s/\QPlantilla Tecnico Monterrey\E/{{BRAND}} · {{CITY}}/g;
        s/\QMonterrey, N.L.\E/{{CITY}}/g;
        s/\QPlaza Chapultepec\E/{{CITY}}/g;
        s/\QSan Nicolás de los Garza\E/{{CITY}}/g;
        s/\Q528117006536\E/{{WHATSAPP}}/g;
        s/\Q528100000000\E/{{WHATSAPP}}/g;
        s/\Q8117006536\E/{{WHATSAPP_LOCAL}}/g;
        s/\Q81 1700 6536\E/{{WHATSAPP_HUMAN}}/g;
        s#\Qhttps://script.google.com/macros/s/AKfycbxH1zD8_14TvCajstFhtEpLNODwG9GZXkLoCXOb1IBNm0JIRmpCwS6SRsuGhZETK88z/exec\E#{{BACKEND_URL}}#g;
        s#\Qhttps://script.google.com/macros/s/BASE/exec\E#{{BACKEND_URL}}#g;
        s#\Qhttps://maps.app.goo.gl/WfZYxbunp9XhXHgr5\E#{{MAPS_URL}}#g;
        s#\Qhttps://maps.app.goo.gl/BASE\E#{{MAPS_URL}}#g;
        s/\QReparación <span>Profesional</span> de Electrónicos\E/Gestión <span>Profesional<\/span> de {{GIRO_LABEL}}/g;
        s/\QReparación Profesional de Electrónicos\E/Gestión Profesional de {{GIRO_LABEL}}/g;
        s/\QLaptops & Surface\E/{{GIRO_LABEL}} · Servicio 1/g;
        s/\QTarjetas de Video (GPU)\E/{{GIRO_LABEL}} · Servicio 2/g;
        s/\QConsolas & Controles\E/{{GIRO_LABEL}} · Servicio 3/g;
        s/\QSmartphones & Tablets\E/{{GIRO_LABEL}} · Servicio 4/g;
        s/\QPCs de Escritorio\E/{{GIRO_LABEL}} · Servicio 5/g;
        s/\QTipo de Dispositivo\E/Tipo de servicio/g;
        s/\QMarca y Modelo Exacto\E/Detalle del servicio/g;
        s/\QProblema(s) Presentados\E/Requerimientos del servicio/g;
        s/\Q#db321f\E/{{COLOR_PRIMARY}}/g;
        s/\Q#1F7EDC\E/{{COLOR_PRIMARY}}/g;
        s/\Q#ff6929\E/{{COLOR_ACCENT}}/g;
        s/\Q#FF6A2A\E/{{COLOR_ACCENT}}/g;
      ' "$f"
    done

  echo "| $(basename "$d") | OK |" >> "$REPORT"
  count=$((count+1))
done

echo "\nTotal: $count" >> "$REPORT"
echo "Sanitizado core completado: $count"
echo "Reporte: $REPORT"
