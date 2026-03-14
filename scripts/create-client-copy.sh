#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Uso:
  $(basename "$0") \
    --source "/ruta/proyecto-base" \
    --target "/ruta/proyecto-cliente" \
    --brand "Nombre Comercial" \
    --city "Ciudad, Estado" \
    --whatsapp "528112345678" \
    --backend-url "https://script.google.com/macros/s/.../exec" \
    --maps-url "https://maps.app.goo.gl/..." \
    [--vertical "tecnico|abarrotes|barberia|academia"] \
    [--color-primary "#1F7EDC"] \
    [--color-accent "#FF6A2A"]
USAGE
}

SOURCE=""
TARGET=""
BRAND=""
CITY=""
WHATSAPP=""
BACKEND_URL=""
MAPS_URL=""
VERTICAL="tecnico"
COLOR_PRIMARY="#1F7EDC"
COLOR_ACCENT="#FF6A2A"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLANTILLAS_DIR="$ROOT_DIR/plantillas"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --brand) BRAND="$2"; shift 2 ;;
    --city) CITY="$2"; shift 2 ;;
    --whatsapp) WHATSAPP="$2"; shift 2 ;;
    --backend-url) BACKEND_URL="$2"; shift 2 ;;
    --maps-url) MAPS_URL="$2"; shift 2 ;;
    --vertical) VERTICAL="$2"; shift 2 ;;
    --color-primary) COLOR_PRIMARY="$2"; shift 2 ;;
    --color-accent) COLOR_ACCENT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumento desconocido: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$TARGET" || -z "$BRAND" || -z "$CITY" || -z "$WHATSAPP" || -z "$BACKEND_URL" || -z "$MAPS_URL" ]]; then
  echo "Faltan argumentos requeridos."
  usage
  exit 1
fi

if [[ -z "$SOURCE" || "$SOURCE" == "auto" ]]; then
  if [[ -d "$PLANTILLAS_DIR/$VERTICAL" ]]; then
    SOURCE="$PLANTILLAS_DIR/$VERTICAL"
    echo "Usando plantilla base por vertical: $SOURCE"
  elif [[ -d "$ROOT_DIR/templates/$VERTICAL" ]]; then
    SOURCE="$ROOT_DIR/templates/$VERTICAL"
    echo "Usando plantilla base por vertical (legacy templates): $SOURCE"
  else
    SOURCE="$ROOT_DIR"
    echo "Plantilla de vertical no encontrada. Usando base general: $SOURCE"
  fi
fi

if [[ ! -d "$SOURCE" ]]; then
  echo "No existe SOURCE: $SOURCE"
  exit 1
fi

if [[ -e "$TARGET" ]]; then
  echo "TARGET ya existe: $TARGET"
  exit 1
fi

rsync -a --exclude='.git' --exclude='.DS_Store' "$SOURCE/" "$TARGET/"

replace_in_file() {
  local old="$1"
  local new="$2"
  local file="$3"
  OLD="$old" NEW="$new" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$file"
}

replace_token_in_file() {
  local token="$1"
  local value="$2"
  local file="$3"
  TOKEN="$token" VALUE="$value" perl -0pi -e 's/\Q$ENV{TOKEN}\E/$ENV{VALUE}/g' "$file"
}

BRAND_UPPER=$(echo "$BRAND" | tr '[:lower:]' '[:upper:]')
WHATSAPP_DIGITS=$(echo "$WHATSAPP" | tr -cd '0-9')
WHATSAPP_LOCAL="${WHATSAPP_DIGITS#52}"
if [[ ${#WHATSAPP_LOCAL} -ge 10 ]]; then
  WHATSAPP_HUMAN="${WHATSAPP_LOCAL:0:2} ${WHATSAPP_LOCAL:2:4} ${WHATSAPP_LOCAL:6:4}"
else
  WHATSAPP_HUMAN="$WHATSAPP"
fi

SOURCE_BASE="$(basename "$SOURCE")"
GIRO_LABEL="$VERTICAL"
if [[ "$SOURCE_BASE" =~ ^[0-9]{2}_(.+)$ ]]; then
  GIRO_LABEL="${BASH_REMATCH[1]}"
fi
GIRO_LABEL="${GIRO_LABEL//-/ }"
GIRO_LABEL="$(echo "$GIRO_LABEL" | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')"

inject_placeholders() {
  local text_files
  text_files=$(find "$TARGET" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.gs" -o -name "*.json" -o -name "*.md" -o -name "*.env" \) \
    ! -path "*/_premerge_backup_*/*" ! -path "*/_integracion4_backup_*/*" ! -path "*/_postfix_backup_*/*")
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    replace_token_in_file "{{BRAND}}" "$BRAND" "$f"
    replace_token_in_file "{{BRAND_UPPER}}" "$BRAND_UPPER" "$f"
    replace_token_in_file "{{CITY}}" "$CITY" "$f"
    replace_token_in_file "{{WHATSAPP}}" "$WHATSAPP" "$f"
    replace_token_in_file "{{WHATSAPP_LOCAL}}" "$WHATSAPP_LOCAL" "$f"
    replace_token_in_file "{{WHATSAPP_HUMAN}}" "$WHATSAPP_HUMAN" "$f"
    replace_token_in_file "{{MAPS_URL}}" "$MAPS_URL" "$f"
    replace_token_in_file "{{BACKEND_URL}}" "$BACKEND_URL" "$f"
    replace_token_in_file "{{COLOR_PRIMARY}}" "$COLOR_PRIMARY" "$f"
    replace_token_in_file "{{COLOR_ACCENT}}" "$COLOR_ACCENT" "$f"
    replace_token_in_file "{{GIRO_LABEL}}" "$GIRO_LABEL" "$f"
    replace_token_in_file "{{GIRO_TITLE}}" "$GIRO_LABEL" "$f"
  done <<< "$text_files"
}

FILES=(
  "$TARGET/index.html"
  "$TARGET/Pagina-principal.html"
  "$TARGET/Pagina-principal.js"
  "$TARGET/integrador.html"
  "$TARGET/portal-cliente.html"
  "$TARGET/portal-cliente.js"
  "$TARGET/panel-operativo.html"
  "$TARGET/panel-operativo.js"
  "$TARGET/panel-tecnico.html"
  "$TARGET/panel-tecnico.js"
  "$TARGET/panel-solicitudes.html"
  "$TARGET/panel-solicitudes.js"
  "$TARGET/panel-archivo.html"
  "$TARGET/panel-archivo.js"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue

  replace_in_file "https://script.google.com/macros/s/AKfycbxH1zD8_14TvCajstFhtEpLNODwG9GZXkLoCXOb1IBNm0JIRmpCwS6SRsuGhZETK88z/exec" "$BACKEND_URL" "$f"
  replace_in_file "https://script.google.com/macros/s/REEMPLAZAR/exec" "$BACKEND_URL" "$f"
  replace_in_file "https://script.google.com/macros/s/BASE/exec" "$BACKEND_URL" "$f"
  replace_in_file "528117006536" "$WHATSAPP" "$f"
  replace_in_file "528100000000" "$WHATSAPP" "$f"
  replace_in_file "81 1700 6536" "$WHATSAPP_HUMAN" "$f"
  replace_in_file "+52 81 1700 6536" "+52 $WHATSAPP_HUMAN" "$f"
  replace_in_file "8117006536" "$WHATSAPP_LOCAL" "$f"
  replace_in_file "https://maps.app.goo.gl/WfZYxbunp9XhXHgr5" "$MAPS_URL" "$f"
  replace_in_file "https://maps.app.goo.gl/BASE" "$MAPS_URL" "$f"
  replace_in_file "https://maps.google.com/?q=SrFix+Oficial+Plaza+Chapultepec" "$MAPS_URL" "$f"
  replace_in_file "https://maps.google.com/?q=SrFix+Oficial" "$MAPS_URL" "$f"

  replace_in_file "SrFix Oficial" "$BRAND" "$f"
  replace_in_file "SRFIX" "$BRAND_UPPER" "$f"
  replace_in_file "SrFix" "$BRAND" "$f"
  replace_in_file "PLANTILLA TECNICO" "$BRAND_UPPER" "$f"
  replace_in_file "Plantilla Tecnico" "$BRAND" "$f"
  replace_in_file "Plantilla Técnico" "$BRAND" "$f"
  replace_in_file "Plantilla Abarrotes" "$BRAND" "$f"
  replace_in_file "Plantilla Barberia" "$BRAND" "$f"
  replace_in_file "Plantilla Barbería" "$BRAND" "$f"
  replace_in_file "Plantilla Academia" "$BRAND" "$f"
  replace_in_file "Plaza Chapultepec" "$CITY" "$f"
  replace_in_file "San Nicolás de los Garza" "$CITY" "$f"
  replace_in_file "Plantilla Tecnico Monterrey" "$BRAND" "$f"
  replace_in_file "$BRAND Monterrey" "$BRAND · $CITY" "$f"
  replace_in_file "SR<span class=\"text-[{{COLOR_PRIMARY}}]\">FIX</span>" "$BRAND_UPPER" "$f"
  replace_in_file "SR<span class=\"text-[#db321f]\">FIX</span>" "$BRAND_UPPER" "$f"
  replace_in_file "SR<span>FIX</span>" "$BRAND_UPPER" "$f"
  replace_in_file "Monterrey, N.L." "$CITY" "$f"
done

apply_vertical_profile() {
  local vertical="$1"
  local h1=''
  local sub=''
  local title=''

  case "$vertical" in
    tecnico)
      return 0
      ;;
    abarrotes)
      title='Gestión Profesional para Abarrotes'
      h1='CONTROL INTELIGENTE PARA TU ABARROTE'
      sub='Organiza pedidos, seguimiento y atención al cliente en un solo sistema simple.'
      ;;
    barberia)
      title='Gestión Profesional para Barbería'
      h1='OPERACIÓN PROFESIONAL PARA TU BARBERÍA'
      sub='Administra citas, servicios y seguimiento en una plataforma ordenada y rápida.'
      ;;
    academia)
      title='Gestión Profesional para Academia'
      h1='CONTROL OPERATIVO PARA TU ACADEMIA'
      sub='Centraliza alumnos, servicios y seguimiento administrativo en un flujo claro.'
      ;;
    *)
      echo "Vertical no reconocido: $vertical. Se mantiene perfil tecnico."
      return 0
      ;;
  esac

  local fronts=("$TARGET/index.html" "$TARGET/Pagina-principal.html")
  for file in "${fronts[@]}"; do
    [[ -f "$file" ]] || continue

    replace_in_file "Reparación Profesional de Electrónicos" "$title" "$file"
    replace_in_file "REPARACIÓN PROFESIONAL DE ELECTRÓNICOS" "$h1" "$file"
    replace_in_file "Especialistas en dispositivos que otros no pueden reparar. Desde Surface hasta GPUs de alta gama, recuperamos tu tecnología." "$sub" "$file"

    # Limpieza rápida de testimonios típicos de electrónicos
    replace_in_file "Llevé mi Surface a varios lugares (incluso a la Plaza de la Tecnología) y nadie pudo repararla. $BRAND lo logró donde otros fallaron. Magnífico lugar." "Excelente atención y seguimiento. Desde que usamos el sistema tenemos más orden en el negocio." "$file"
    replace_in_file "Llevé un componente de PC (GPU) el cual daba por perdido y $BRAND le dio una segunda vida. La mejor experiencia que he tenido en servicios de reparación." "Ahora todo queda registrado con folio y es más fácil atender rápido a los clientes." "$file"

    # Título HTML
    replace_in_file "$BRAND | Reparación Profesional de Electrónicos" "$BRAND | $title" "$file"

    if [[ "$vertical" == "abarrotes" ]]; then
      replace_in_file "Servicio técnico especializado en reparación de laptops, GPUs, controles. Verifica el estado de tu equipo online. Plaza Chapultepec, San Nicolás de los Garza." "Sistema de gestión para abarrotes: pedidos, cotizaciones, seguimiento y control operativo en un solo lugar." "$file"
      replace_in_file "Reparación <span>Profesional</span> de Electrónicos" "Gestión <span>Profesional</span> de Abarrotes" "$file"
      replace_in_file "Especialistas en reparación de electrónicos en " "Sistema de gestión para abarrotes en " "$file"
      replace_in_file "Selecciona el servicio que necesitas y completa el formulario para recibir tu presupuesto personalizado" "Selecciona el tipo de solicitud y completa el formulario para atenderte más rápido." "$file"
      replace_in_file "Laptops & Surface" "Abarrotes y Despensa" "$file"
      replace_in_file "Microsoft Surface, MacBooks, y laptops de todas las marcas. Pantallas, teclados y placas madre." "Solicitud y seguimiento de productos de despensa, básicos del hogar y consumo diario." "$file"
      replace_in_file "Tarjetas de Video (GPU)" "Bebidas y Botanas" "$file"
      replace_in_file "Reparación avanzada de GPUs gaming. Reballing, reemplazo de chips y recuperación de tarjetas \"muertas\"." "Atención de pedidos de bebidas, botanas y productos de consumo rápido." "$file"
      replace_in_file "Consolas & Controles" "Lácteos y Refrigerados" "$file"
      replace_in_file "Reparación express de controles Wii, Xbox, PlayStation. Joysticks y botones en 15 minutos." "Gestión de surtido para lácteos, refrigerados y productos de alta rotación." "$file"
      replace_in_file "Smartphones & Tablets" "Limpieza y Hogar" "$file"
      replace_in_file "Cambio de pantallas, baterías, puertos de carga y reparación de daños por agua." "Solicitudes de productos de limpieza, higiene y mantenimiento del hogar." "$file"
      replace_in_file "PCs de Escritorio" "Pedidos por Volumen" "$file"
      replace_in_file "Mantenimiento, ensamblado, overclocking seguro y reparación de componentes de alto rendimiento." "Control de pedidos grandes para negocio, eventos y compras programadas." "$file"
      replace_in_file "Diagnóstico Gratuito" "Cotización Rápida" "$file"
      replace_in_file "Evaluación sin costo ni compromiso. Te explicamos el problema y las soluciones disponibles." "Envíanos tu solicitud y te respondemos con tiempos, disponibilidad y total estimado." "$file"
      replace_in_file "Cuéntanos más sobre tu equipo para darte el mejor precio" "Cuéntanos qué productos necesitas para darte una cotización clara." "$file"
      replace_in_file "Tipo de Dispositivo" "Tipo de Solicitud" "$file"
      replace_in_file "Selecciona el tipo de equipo" "Selecciona el tipo de pedido" "$file"
      replace_in_file "Laptop / Notebook" "Despensa básica" "$file"
      replace_in_file "Microsoft Surface" "Bebidas" "$file"
      replace_in_file "MacBook" "Botanas" "$file"
      replace_in_file "Tarjeta de Video (GPU)" "Lácteos y refrigerados" "$file"
      replace_in_file "PC de Escritorio" "Limpieza y hogar" "$file"
      replace_in_file "Control de Consola" "Mayoreo / volumen" "$file"
      replace_in_file "Consola (Xbox/PlayStation)" "Reposición semanal" "$file"
      replace_in_file "Celular / Smartphone" "Lista personalizada" "$file"
      replace_in_file "Tablet / iPad" "Entrega a domicilio" "$file"
      replace_in_file "Marca y Modelo Exacto" "Detalle de productos solicitados" "$file"
      replace_in_file "Ej: Dell XPS 15 9520, RTX 3080 Ti, iPhone 13 Pro Max..." "Ej: Arroz, frijol, leche, refrescos, jabón, papel..." "$file"
      replace_in_file "Problema(s) Presentados" "Categorías de interés" "$file"
      replace_in_file "Pantalla / Display" "Despensa básica" "$file"
      replace_in_file "Batería / No enciende" "Bebidas y botanas" "$file"
      replace_in_file "Lentitud / Se traba" "Lácteos y refrigerados" "$file"
      replace_in_file "No da video" "Limpieza y hogar" "$file"
      replace_in_file "Sobrecalentamiento" "Mayoreo / volumen" "$file"
      replace_in_file "Daño por agua / líquido" "Entrega a domicilio" "$file"
    fi
  done

  # Mensajes de WhatsApp más neutros
  local scripts=("$TARGET/Pagina-principal.js" "$TARGET/panel-tecnico.js" "$TARGET/panel-solicitudes.js")
  for file in "${scripts[@]}"; do
    [[ -f "$file" ]] || continue
    replace_in_file "Nueva cotización - $BRAND" "Nueva solicitud - $BRAND" "$file"
    replace_in_file "te contactamos de $BRAND respecto a tu solicitud de cotización" "te contactamos de $BRAND respecto a tu solicitud" "$file"
  done
}

apply_vertical_profile "$VERTICAL"

apply_giro_personalization() {
  # Si viene de plantilla numerada, aplicar textos genéricos por giro para no dejar "electrónicos".
  if [[ ! "$SOURCE_BASE" =~ ^[0-9]{2}_.+$ ]]; then
    return 0
  fi

  local fronts=("$TARGET/index.html" "$TARGET/Pagina-principal.html")
  for file in "${fronts[@]}"; do
    [[ -f "$file" ]] || continue
    replace_in_file "Reparación <span>Profesional</span> de Electrónicos" "Gestión <span>Profesional</span> de ${GIRO_LABEL}" "$file"
    replace_in_file "Reparación Profesional de Electrónicos" "Gestión Profesional de ${GIRO_LABEL}" "$file"
    replace_in_file "Servicio técnico especializado en reparación de laptops, GPUs, controles. Verifica el estado de tu equipo online. Plaza Chapultepec, San Nicolás de los Garza." "Servicio profesional de ${GIRO_LABEL}. Cotización, seguimiento y atención desde un solo flujo digital." "$file"
    replace_in_file "Servicio técnico especializado en reparación de laptops, GPUs, controles." "Servicio profesional de ${GIRO_LABEL}." "$file"
    replace_in_file "Verifica el estado de tu equipo online." "Cotización, seguimiento y atención desde un solo flujo digital." "$file"
    replace_in_file "Selecciona el servicio que necesitas y completa el formulario para recibir tu presupuesto personalizado" "Selecciona el servicio de ${GIRO_LABEL} que necesitas y completa el formulario para cotizar." "$file"
    replace_in_file "Laptops & Surface" "${GIRO_LABEL} · Servicio 1" "$file"
    replace_in_file "Microsoft Surface, MacBooks, y laptops de todas las marcas. Pantallas, teclados y placas madre." "Atención especializada en ${GIRO_LABEL}, diagnóstico, reparación e instalación según tu necesidad." "$file"
    replace_in_file "Tarjetas de Video (GPU)" "${GIRO_LABEL} · Servicio 2" "$file"
    replace_in_file "Reparación avanzada de GPUs gaming. Reballing, reemplazo de chips y recuperación de tarjetas \"muertas\"." "Servicio profesional de ${GIRO_LABEL} con seguimiento claro y tiempos definidos." "$file"
    replace_in_file "Consolas & Controles" "${GIRO_LABEL} · Servicio 3" "$file"
    replace_in_file "Reparación express de controles Wii, Xbox, PlayStation. Joysticks y botones en 15 minutos." "Mantenimiento preventivo y correctivo para ${GIRO_LABEL} con atención personalizada." "$file"
    replace_in_file "Smartphones & Tablets" "${GIRO_LABEL} · Servicio 4" "$file"
    replace_in_file "Cambio de pantallas, baterías, puertos de carga y reparación de daños por agua." "Optimización y mejora de servicio en ${GIRO_LABEL} para operación diaria." "$file"
    replace_in_file "PCs de Escritorio" "${GIRO_LABEL} · Servicio 5" "$file"
    replace_in_file "Mantenimiento, ensamblado, overclocking seguro y reparación de componentes de alto rendimiento." "Soporte integral para ${GIRO_LABEL}, desde diagnóstico hasta entrega final." "$file"
    replace_in_file "Tipo de Dispositivo" "Tipo de servicio" "$file"
    replace_in_file "Marca y Modelo Exacto" "Detalle del servicio" "$file"
    replace_in_file "Problema(s) Presentados" "Requerimientos del servicio" "$file"
    replace_in_file "Visítanos en Plaza Chapultepec" "Visítanos en ${CITY}" "$file"
    replace_in_file "Opiniones verificadas de Google Maps" "Opiniones verificadas de clientes" "$file"
    replace_in_file "$BRAND | Reparación Profesional de Electrónicos" "$BRAND | Servicios de ${GIRO_LABEL}" "$file"
    replace_in_file "San Nicolás de los Garza" "$CITY" "$file"
    replace_in_file "Llevé mi Surface a varios lugares (incluso a la Plaza de la Tecnología) y nadie pudo repararla." "Excelente servicio y atención profesional." "$file"
    replace_in_file "Llevé un componente de PC (GPU) el cual daba por perdido" "Tenía una solicitud complicada y" "$file"
  done
}

apply_giro_personalization

inject_placeholders

cleanup_final_text() {
  local fronts=("$TARGET/index.html" "$TARGET/Pagina-principal.html")
  for file in "${fronts[@]}"; do
    [[ -f "$file" ]] || continue
    replace_in_file "$CITY, $CITY" "$CITY" "$file"
    replace_in_file " y y " " y " "$file"
  done
}

cleanup_final_text

apply_brand_colors() {
  local c1="$1"
  local c2="$2"
  # Reemplazo de paleta principal usada por la base SrFix.
  local color_files
  color_files=$(find "$TARGET" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" \))
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    replace_in_file "#1F7EDC" "$c1" "$f"
    replace_in_file "#FF6A2A" "$c2" "$f"
  done <<< "$color_files"
}

apply_brand_colors "$COLOR_PRIMARY" "$COLOR_ACCENT"

echo ""
echo "Copia de cliente creada: $TARGET"
echo "Vertical aplicado: $VERTICAL"
echo "Colores aplicados: primary=$COLOR_PRIMARY accent=$COLOR_ACCENT"
echo ""
echo "Siguientes pasos manuales recomendados:"
echo "1) Reemplazar logo.png y logo.webp en $TARGET"
echo "2) Revisar textos comerciales/testimonios en index.html"
echo "3) Probar flujo: cotización -> solicitud -> orden SRF -> portal"
echo "4) Configurar passwords en Apps Script"
