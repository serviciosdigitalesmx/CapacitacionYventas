# Orquestador Multi-IA de Plantillas

Este modulo corre una linea de ensamblaje de IAs por rol:

1. Arquitecto
2. Codificador
3. Debugger
4. Optimizador

## Estructura

- `orchestrator.py`: pipeline principal
- `providers.example.json`: configuracion de modelos/APIs
- `giros_catalogo.json`: lista de giros para lote
- `prompts/`: prompts por rol
- `output/plantillas-generadas/`: salida final

## Ejecucion rapida (sin APIs, modo mock)

```bash
cd "/Users/jesusvilla/Desktop/SERVICIOS DIGITALES MX ESTRUCTURA/automatizacion/orquestador"
python3 orchestrator.py --all --max 8 --dry-run
```

## Si no tienes API de DeepSeek

No pasa nada. Puedes correr con:
- solo Gemini, o
- OpenAI + Gemini.

Ya vienen presets:
- `providers.gemini-only.example.json`
- `providers.openai-gemini.example.json`

Y puedes inyectar insight manual de DeepSeek (copiado/pegado) con:

```bash
python3 orchestrator.py --all --config providers.gemini-only.example.json --hint-file deepseek-hint.example.txt
```

Si el proveedor responde 429/cuota, el pipeline ahora cae automaticamente a `mock` por default (`--on-provider-error mock`) y sigue con el siguiente giro.

## Ejecucion real con APIs

1. Configura llaves de API en tu shell:

```bash
export OPENAI_API_KEY="..."
export DEEPSEEK_API_KEY="..."
export GEMINI_API_KEY="..."
```

2. Corre pipeline real:

```bash
python3 orchestrator.py --all --config providers.example.json
```

Si quieres detenerte en el primer error de API, usa:

```bash
python3 orchestrator.py --all --config providers.example.json --on-provider-error fail
```

Nota: ChatGPT Plus/Pro del sitio no siempre equivale a API activa; para el pipeline necesitas `OPENAI_API_KEY` con facturacion de API habilitada.

## Salida por giro

Cada giro se guarda en:

`output/plantillas-generadas/<giro-slug>/`

Con archivos:
- `index.html`
- `cotizador.html`
- `portal.html`
- `Code.gs`
- `config.json`
- `pipeline-meta.json`

## Nota

Generar "todos los giros posibles" literalmente no es finito. Este modulo arranca con un catalogo amplio y lo puedes extender en `giros_catalogo.json`.

## Modo sin API y sin Selenium (obligatorio DeepSeek + ChatGPT + Gemini)

Si quieres que cada giro pase forzosamente por las 3 plataformas sin usar API:

```bash
cd "/Users/jesusvilla/Desktop/SERVICIOS DIGITALES MX ESTRUCTURA/automatizacion/orquestador"
python3 manual_triple_bridge.py --all --max 5 --hint-file deepseek-hint.example.txt
```

Flujo obligatorio por giro:
1. `arquitecto` -> DeepSeek
2. `codificador` -> ChatGPT
3. `debugger` -> Gemini
4. `optimizador` -> DeepSeek

El script te genera prompts y te indica el archivo `response.json` que debes llenar por etapa.
Rerun el mismo comando para continuar donde se quedo hasta completar cada giro.

Rutas generadas:
- prompts/respuestas manuales: `manual-bridge/<giro-slug>/`
- salida final: `output/plantillas-generadas/<giro-slug>/`

## Modo automatico UI (sin API, sin Selenium) con Playwright

Script: `auto_triple_bridge_playwright.py`

Instalacion una sola vez:

```bash
cd "/Users/jesusvilla/Desktop/SERVICIOS DIGITALES MX ESTRUCTURA/automatizacion/orquestador"
python3 -m pip install playwright
python3 -m playwright install chromium
```

Ejecucion (ejemplo):

```bash
python3 auto_triple_bridge_playwright.py --all --max 10 --hint-file deepseek-hint.example.txt
```

Usando tu perfil real de Chrome:

```bash
python3 auto_triple_bridge_playwright.py --all --max 10 --hint-file deepseek-hint.example.txt --use-chrome-profile --chrome-profile-directory "Default"
```

Si tu sesion esta en otro perfil: `"Profile 1"`, `"Profile 2"`, etc.

## Modo automatico con Selenium (metodologia global + lote por giro)

Script: `auto_triple_bridge_selenium.py`

Este flujo primero recolecta metodologia global (1 pregunta robusta por proveedor):
- DeepSeek
- ChatGPT
- Gemini

Luego ejecuta los giros uno por uno aplicando esa metodologia en cada etapa.

Ejemplo (adjuntado a Chrome debug en 9222):

```bash
python auto_triple_bridge_selenium.py --all --max 80 --hint-file deepseek-hint.example.txt --debugger-address 127.0.0.1:9222 --no-pause --collect-methodology
```

Metodologia se guarda en:
- `auto-bridge/_methodology.json`

Notas:
- Usa flujo obligatorio: DeepSeek -> ChatGPT -> Gemini -> DeepSeek.
- No usa API ni Selenium, automatiza las UIs web.
- La primera vez abre pestañas y te deja iniciar sesion; luego sigue en automatico.
- Guarda trazas en `auto-bridge/<giro-slug>/` y salida final en `output/plantillas-generadas/<giro-slug>/`.
