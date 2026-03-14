#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANTILLAS_DIR="$ROOT/plantillas"
SRFIX_DIR="/Users/jesusvilla/Desktop/SrFix/templates"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$ROOT/docs/reporte-validacion-$STAMP.md"

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
  echo "# Reporte de validacion de plantillas 80"
  echo
  echo "- Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "- Plantillas evaluadas: $PLANTILLAS_DIR"
  echo "- Baseline: $SRFIX_DIR"
  echo
  echo "| Carpeta | Vertical esperada | Archivos baseline | Archivos carpeta | Faltantes baseline | Extras no permitidos | Diferencias contenido | Estado |"
  echo "|---|---:|---:|---:|---:|---:|---:|---|"
} > "$REPORT"

ok=0
fail=0

while IFS= read -r target; do
  base="$(basename "$target")"
  slug="${base#*_}"
  vertical="$(infer_vertical "$slug")"
  source="$SRFIX_DIR/$vertical"

  if [[ ! -d "$source" ]]; then
    printf '| %s | %s | - | - | - | - | - | FAIL (baseline faltante) |\n' "$base" "$vertical" >> "$REPORT"
    fail=$((fail+1))
    continue
  fi

  names_source="$(mktemp)"
  names_target="$(mktemp)"

  find "$source" -type f ! -name '.DS_Store' | sed "s#^$source/##" | sort > "$names_source"
  find "$target" -type f ! -name '.DS_Store' ! -path '*/_premerge_backup_*/*' ! -path '*/_postfix_backup_*/*' | sed "s#^$target/##" | sort > "$names_target"

  n_source=$(wc -l < "$names_source" | tr -d ' ')
  n_target=$(wc -l < "$names_target" | tr -d ' ')
  missing_count=$(comm -23 "$names_source" "$names_target" | wc -l | tr -d ' ')

  extras_filtered=$(mktemp)
  comm -13 "$names_source" "$names_target" \
    | rg -v '^(Code\.gs|config\.json|cotizador\.html|portal\.html)$' > "$extras_filtered" || true
  extras_not_allowed=$(wc -l < "$extras_filtered" | tr -d ' ')

  # Comparacion binaria directa para archivos en comun (mas rapido que hashear todo).
  content_diff=0
  while IFS= read -r rel; do
    a="$source/$rel"
    b="$target/$rel"
    [[ -f "$a" && -f "$b" ]] || continue
    cmp -s "$a" "$b" || content_diff=$((content_diff+1))
  done < <(comm -12 "$names_source" "$names_target")

  state="OK"
  if [[ "$missing_count" -ne 0 || "$extras_not_allowed" -ne 0 || "$content_diff" -ne 0 ]]; then
    state="FAIL"
    fail=$((fail+1))
  else
    ok=$((ok+1))
  fi

  printf '| %s | %s | %s | %s | %s | %s | %s | %s |\n' "$base" "$vertical" "$n_source" "$n_target" "$missing_count" "$extras_not_allowed" "$content_diff" "$state" >> "$REPORT"

  rm -f "$names_source" "$names_target" "$extras_filtered"
done < <(find "$PLANTILLAS_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9]_*' | sort)

{
  echo
  echo "## Resumen"
  echo "- OK: $ok"
  echo "- FAIL: $fail"
} >> "$REPORT"

echo "Validacion terminada."
echo "Reporte: $REPORT"
