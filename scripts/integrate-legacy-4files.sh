#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANTILLAS_DIR="$ROOT/plantillas"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$ROOT/docs/reporte-integracion-4archivos-$STAMP.md"

slug_to_title() {
  local slug="$1"
  echo "$slug" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) tolower(substr($i,2)) }}1'
}

append_integration_block() {
  local file="$1"
  if rg -q "INTEGRACION_LEGACY_4_ARCHIVOS" "$file"; then
    return
  fi

  cat >> "$file" <<'GS'

// ==========================================
// INTEGRACION_LEGACY_4_ARCHIVOS
// ==========================================

function getConfig() {
  // Compatibilidad con plantillas legacy basadas en config.json.
  try {
    const file = DriveApp.getFilesByName('config.json').next();
    const raw = file.getBlob().getDataAsString();
    return JSON.parse(raw);
  } catch (err) {
    return {
      b: { name: 'SrFix', slogan: 'Servicio profesional' },
      svs: [{ n: 'Servicio base', d: 'Descripción base', p: 'Cotizar' }]
    };
  }
}

function renderLegacyView_(page) {
  // Puente para vistas legacy sin alterar el doGet API existente.
  return HtmlService.createTemplateFromFile(page).evaluate();
}
GS
}

mkdir -p "$(dirname "$REPORT")"
{
  echo "# Reporte integracion 4 archivos"
  echo
  echo "- Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "- Destino: $PLANTILLAS_DIR"
  echo
  echo "| Carpeta | Estado |"
  echo "|---|---|"
} > "$REPORT"

count=0
while IFS= read -r dir; do
  base="$(basename "$dir")"
  slug="${base#*_}"
  giro_name="$(slug_to_title "$slug")"

  backup="$dir/_integracion4_backup_$STAMP"
  mkdir -p "$backup"

  for f in codigo.gs Code.gs config.json cotizador.html portal.html; do
    [[ -f "$dir/$f" ]] && cp -f "$dir/$f" "$backup/$f"
  done

  if [[ -f "$dir/codigo.gs" ]]; then
    append_integration_block "$dir/codigo.gs"
  fi

  cat > "$dir/Code.gs" <<'GS'
/**
 * Archivo legacy conservado para compatibilidad.
 * La logica principal vive en codigo.gs.
 */
function legacyRenderIndex_() {
  return HtmlService.createTemplateFromFile('index').evaluate();
}
GS

  cat > "$dir/config.json" <<JSON
{"b":{"name":"$giro_name","slogan":"Servicio profesional"},"svs":[{"n":"Servicio base","d":"Descripcion base","p":"Cotizar"}]}
JSON

  cat > "$dir/cotizador.html" <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cotizador</title>
  <meta http-equiv="refresh" content="0;url=./Pagina-principal.html#cotizar" />
</head>
<body>
  <p>Redirigiendo al cotizador...</p>
  <p><a href="./Pagina-principal.html#cotizar">Ir al cotizador</a></p>
</body>
</html>
HTML

  cat > "$dir/portal.html" <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Portal</title>
  <meta http-equiv="refresh" content="0;url=./portal-cliente.html" />
</head>
<body>
  <p>Redirigiendo al portal...</p>
  <p><a href="./portal-cliente.html">Ir al portal cliente</a></p>
</body>
</html>
HTML

  printf '| %s | OK |\n' "$base" >> "$REPORT"
  count=$((count+1))
done < <(find "$PLANTILLAS_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9]_*' | sort)

{
  echo
  echo "Total procesadas: $count"
} >> "$REPORT"

echo "Integracion completada."
echo "Reporte: $REPORT"
