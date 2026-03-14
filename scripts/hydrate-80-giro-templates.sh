#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANTILLAS_DIR="$ROOT/plantillas"
SRFIX_DIR="/Users/jesusvilla/Desktop/SrFix/templates"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$ROOT/docs/reporte-hidratacion-$STAMP.md"

if [[ ! -d "$PLANTILLAS_DIR" ]]; then
  echo "No existe plantillas: $PLANTILLAS_DIR" >&2
  exit 1
fi

for v in tecnico abarrotes barberia academia; do
  if [[ ! -d "$SRFIX_DIR/$v" ]]; then
    echo "Falta plantilla base: $SRFIX_DIR/$v" >&2
    exit 1
  fi
done

infer_vertical() {
  local slug="$1"
  local token_slug="-$slug-"

  if [[ "$token_slug" =~ -(academia|escuela|guarderia|ingles|musica|yoga)- ]]; then
    echo "academia"
    return
  fi

  if [[ "$token_slug" =~ -(barberia|salon|belleza|spa|unas|manicure)- ]]; then
    echo "barberia"
    return
  fi

  if [[ "$token_slug" =~ -(abarrotes|tienda|carniceria|fruteria|panaderia|tortilleria|cafeteria|restaurante|taqueria|dark-kitchen|pasteleria|heladeria|floreria|eventos|banquetes|pet-shop|ropa|boutique|joyeria|zapateria|muebleria|colchones|electronica)- ]]; then
    echo "abarrotes"
    return
  fi

  echo "tecnico"
}

mkdir -p "$(dirname "$REPORT")"
{
  echo "# Reporte de hidratacion"
  echo
  echo "- Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "- Origen base: $SRFIX_DIR"
  echo "- Destino: $PLANTILLAS_DIR"
  echo
  echo "| Carpeta | Vertical aplicada | Backup |"
  echo "|---|---|---|"
} > "$REPORT"

count=0
while IFS= read -r target; do
  base="$(basename "$target")"
  slug="${base#*_}"
  vertical="$(infer_vertical "$slug")"
  source="$SRFIX_DIR/$vertical"

  backup_dir="$target/_premerge_backup_$STAMP"
  mkdir -p "$backup_dir"

  for f in Code.gs config.json cotizador.html index.html portal.html pipeline-meta.json; do
    if [[ -f "$target/$f" ]]; then
      cp -f "$target/$f" "$backup_dir/$f"
    fi
  done

  rsync -a --exclude='.DS_Store' "$source/" "$target/"

  count=$((count + 1))
  printf '| %s | %s | %s |\n' "$base" "$vertical" "$(basename "$backup_dir")" >> "$REPORT"
done < <(find "$PLANTILLAS_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9]_*' | sort)

{
  echo
  echo "Total carpetas procesadas: $count"
} >> "$REPORT"

echo "Hidratacion completada."
echo "Reporte: $REPORT"
