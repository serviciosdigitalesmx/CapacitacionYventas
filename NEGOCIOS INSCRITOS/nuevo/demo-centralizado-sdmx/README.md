# SERVICIOS DIGITALES MX - ESTRUCTURA GENERAL

Esta carpeta centraliza la operación para replicar sistemas por vertical de negocio.

## Estructura

- `plantillas/`
  - Plantilla base por tipo de negocio.
  - Actualmente incluye:
    - `tecnico/`
    - `abarrotes/`
    - `barberia/`
    - `academia/`

- `scripts/`
  - Scripts operativos para clonado y activación.
  - `create-client-copy.sh`: clona cliente desde plantilla.
  - `kit_replicable_server.py`: backend local para UI interactiva.
  - `run-kit-ui.sh`: levanta UI local.
  - `client-config.example.env`: variables ejemplo para ejecución en terminal.

- `docs/`
  - Documentación operativa.
  - `KIT_REPLICABLE_V1_INTERACTIVO.html`
  - `USO_SCRIPT_REPLICA.md`
  - `ALTA_CLIENTE_V1.md`
  - `CHECKLIST_ACTIVACION_CLIENTE.md`

- `NEGOCIOS INSCRITOS/`
  - Carpeta destino para clientes ya productivos.

- `clientes-archivados/`
  - Clientes no activos o históricos.

- `branding/`
  - Logos, paletas y assets por cliente.

- `checklists/`
  - Checklists por plan y vertical.

- `automatizacion/`
  - Flujos futuros para alta semiautomática.

## Flujo recomendado (v1)

1. Elegir vertical (`tecnico`, `abarrotes`, etc.).
2. Clonar desde plantilla.
3. Personalizar branding y datos.
4. Probar flujo completo.
5. Mover cliente a `NEGOCIOS INSCRITOS/`.

## Comandos base

### Levantar UI interactiva

```bash
cd "/Users/jesusvilla/Desktop/SERVICIOS DIGITALES MX ESTRUCTURA"
python3 scripts/kit_replicable_server.py
```

Abrir: `http://127.0.0.1:8787`

### Clonar por terminal

```bash
cd "/Users/jesusvilla/Desktop/SERVICIOS DIGITALES MX ESTRUCTURA"
source scripts/client-config.example.env
bash scripts/create-client-copy.sh \
  --source "auto" \
  --target "/Users/jesusvilla/Desktop/cliente-demo" \
  --brand "Cliente Demo" \
  --city "Monterrey, N.L." \
  --whatsapp "528112345678" \
  --backend-url "https://script.google.com/macros/s/REEMPLAZAR/exec" \
  --maps-url "https://maps.app.goo.gl/REEMPLAZAR" \
  --vertical "tecnico" \
  --color-primary "#1F7EDC" \
  --color-accent "#FF6A2A"
```

## Siguiente implementación sugerida (misma lógica)

1. `checklists/planes/` con checklist por plan (`basico`, `pro`, `full`).
2. `plantillas/<vertical>/manifest.json` para declarar módulos por defecto.
3. Script `scripts/save-as-template.sh` para guardar una réplica validada como nueva plantilla.
4. Script `scripts/validate-client.sh` para validación automática pre-entrega.
5. Carpeta `NEGOCIOS INSCRITOS/<cliente>/meta/` con JSON de configuración y estado.
