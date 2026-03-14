# Uso Rápido: Script de Réplica

## 1) Editar variables
Duplica `scripts/client-config.example.env` a `scripts/client-config.env` y cambia los valores.
Si quieres usar plantillas por giro, deja `SOURCE="auto"` y selecciona `VERTICAL`.

## 2) Ejecutar
Desde la carpeta del proyecto:

```bash
source scripts/client-config.env
bash scripts/create-client-copy.sh \
  --source "$SOURCE" \
  --target "$TARGET" \
  --brand "$BRAND" \
  --city "$CITY" \
  --whatsapp "$WHATSAPP" \
  --backend-url "$BACKEND_URL" \
  --maps-url "$MAPS_URL" \
  --vertical "${VERTICAL:-tecnico}" \
  --color-primary "${COLOR_PRIMARY:-#1F7EDC}" \
  --color-accent "${COLOR_ACCENT:-#FF6A2A}"
```

## 3) Validar en la copia
- `index.html`: marca y enlaces.
- `portal-cliente.js`: backend/WhatsApp.
- `panel-operativo.js`: backend/WhatsApp/PDF footer.
- `panel-tecnico.js`: mensajes/footers.
- `panel-solicitudes.js`: mensajes/footers.

## Alcance actual
Este script deja una copia funcional base para nuevo cliente y aplica perfil por vertical (`tecnico`, `abarrotes`, `barberia`, `academia`). No configura Apps Script ni DNS automáticamente; eso sigue manual con checklist.

## Plantillas por giro
El proyecto ya incluye plantillas base en:
- `templates/tecnico`
- `templates/abarrotes`
- `templates/barberia`
- `templates/academia`

Cuando `SOURCE=auto`, se usa la carpeta `templates/<vertical>`.
