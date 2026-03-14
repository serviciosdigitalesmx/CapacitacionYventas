# Plantillas por Giro

Esta carpeta contiene plantillas base para replicación por vertical:

- `tecnico`
- `abarrotes`
- `barberia`
- `academia`

## Regla de uso
Si el clonador corre con `--source auto`, usa automáticamente `templates/<vertical>`.

Ejemplo:

```bash
bash scripts/create-client-copy.sh \
  --source auto \
  --target "/Users/jesusvilla/Desktop/cliente-demo" \
  --brand "Cliente Demo" \
  --city "Monterrey, N.L." \
  --whatsapp "528112345678" \
  --backend-url "https://script.google.com/macros/s/REEMPLAZAR/exec" \
  --maps-url "https://maps.app.goo.gl/REEMPLAZAR" \
  --vertical "abarrotes"
```

## Importante
Cuando mejores textos/estructura de una vertical, aplica el cambio en la plantilla correspondiente para que futuras réplicas ya nazcan correctas.
