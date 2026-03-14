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

  while IFS= read -r -d '' f; do
    ruby /tmp/sanitize_core_replacer.rb "$f"
  done < <(find "$d" -maxdepth 1 -type f \( -name 'index.html' -o -name 'Pagina-principal.html' -o -name 'Pagina-principal.js' -o -name 'portal-cliente.html' -o -name 'portal-cliente.js' -o -name 'panel-operativo.html' -o -name 'panel-operativo.js' -o -name 'panel-tecnico.html' -o -name 'panel-tecnico.js' -o -name 'panel-solicitudes.html' -o -name 'panel-solicitudes.js' -o -name 'panel-archivo.html' -o -name 'panel-archivo.js' -o -name '*.css' \) -print0)

  echo "| $(basename "$d") | OK |" >> "$REPORT"
  count=$((count+1))
done

echo "\nTotal: $count" >> "$REPORT"
echo "Sanitizado core completado: $count"
echo "Reporte: $REPORT"
