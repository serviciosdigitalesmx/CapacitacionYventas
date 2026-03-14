#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib import request, error

ROOT = Path(__file__).resolve().parent
PROMPTS_DIR = ROOT / "prompts"


DEFAULT_PROVIDER_CONFIG = {
    "output_dir": "output/plantillas-generadas",
    "providers": {
        "arquitecto": {"type": "mock", "model": "mock-arquitecto"},
        "codificador": {"type": "mock", "model": "mock-codificador"},
        "debugger": {"type": "mock", "model": "mock-debugger"},
        "optimizador": {"type": "mock", "model": "mock-optimizador"},
    },
}


def slugify(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "giro-sin-nombre"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_provider_config(config_path: Path | None):
    if not config_path:
        return DEFAULT_PROVIDER_CONFIG
    if not config_path.exists():
        raise FileNotFoundError(f"No existe config: {config_path}")
    return load_json(config_path)


def read_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"No existe prompt: {path}")
    return path.read_text(encoding="utf-8")


def fill_template(text: str, values: dict) -> str:
    out = text
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def extract_json(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # fallback: extract first {...}
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        return json.loads(candidate)
    raise ValueError("No se pudo parsear JSON de la respuesta")


def call_openai_compatible(base_url: str, api_key: str, model: str, prompt: str, timeout: int = 120):
    url = base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Responde solo con JSON cuando se te pida formato estricto."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTPError {e.code}: {body}")
    except Exception as e:
        raise RuntimeError(f"Error request provider: {e}")

    data = json.loads(raw)
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Respuesta sin choices")
    msg = choices[0].get("message") or {}
    content = msg.get("content")
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        content = "\n".join(parts)
    return content or ""


def mock_architecture(giro: str):
    return {
        "resumen": f"Plantilla replicable para {giro}",
        "modulos": [
            "landing page",
            "cotizador",
            "portal cliente",
            "panel operativo",
            "historial",
        ],
        "flujo_cliente": [
            "entra a landing",
            "solicita cotizacion",
            "recibe folio",
            "consulta estatus",
        ],
        "flujo_operativo": [
            "recibe solicitud",
            "genera orden",
            "actualiza estatus",
            "cierra servicio",
        ],
        "datos_necesarios": [
            "nombre negocio",
            "telefono whatsapp",
            "direccion",
            "servicios",
            "colores",
        ],
        "reglas_cotizacion": ["subtotal", "descuento opcional", "total"],
        "estructura_ordenes": ["folio", "cliente", "servicio", "estado", "fecha"],
    }


def mock_files(giro: str, architecture: dict):
    service_examples = ", ".join(architecture.get("modulos", [])[:3])

    config_json = {
        "BUSINESS_NAME": "{{BUSINESS_NAME}}",
        "WHATSAPP": "{{WHATSAPP}}",
        "COLORS": {"primary": "{{COLORS.primary}}", "accent": "{{COLORS.accent}}"},
        "SERVICES": ["{{SERVICES.0}}", "{{SERVICES.1}}", "{{SERVICES.2}}"],
        "VERTICAL": giro,
    }

    index_html = f"""<!doctype html>
<html lang=\"es\">
<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{{{{BUSINESS_NAME}}}}</title></head>
<body>
  <h1>{{{{BUSINESS_NAME}}}}</h1>
  <p>Plantilla base para giro: {giro}</p>
  <p>Modulos base: {service_examples}</p>
  <a href=\"cotizador.html\">Cotizar</a>
  <a href=\"portal.html\">Portal cliente</a>
</body>
</html>
"""

    cotizador_html = """<!doctype html>
<html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Cotizador</title></head>
<body>
  <h2>Cotizador</h2>
  <form>
    <input placeholder=\"Nombre\" />
    <input placeholder=\"Telefono\" />
    <input placeholder=\"Servicio\" />
    <button type=\"button\">Enviar</button>
  </form>
</body>
</html>
"""

    portal_html = """<!doctype html>
<html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Portal</title></head>
<body>
  <h2>Portal del cliente</h2>
  <input placeholder=\"Folio\" />
  <button type=\"button\">Consultar</button>
</body>
</html>
"""

    code_gs = """function doGet(e){
  const action = (e && e.parameter && e.parameter.action) || 'status';
  return ContentService.createTextOutput(JSON.stringify({ok:true, action:action})).setMimeType(ContentService.MimeType.JSON);
}
"""

    return {
        "files": {
            "index.html": index_html,
            "cotizador.html": cotizador_html,
            "portal.html": portal_html,
            "Code.gs": code_gs,
            "config.json": json.dumps(config_json, ensure_ascii=False, indent=2),
        },
        "notes": "Generado por modo mock",
    }


def ensure_files_payload(payload: dict):
    if not isinstance(payload, dict):
        raise ValueError("Payload invalido")
    files = payload.get("files")
    if not isinstance(files, dict):
        raise ValueError("Payload sin files")

    required = ["index.html", "cotizador.html", "portal.html", "Code.gs", "config.json"]
    missing = [f for f in required if f not in files]
    if missing:
        raise ValueError("Faltan archivos en payload: " + ", ".join(missing))

    # normalize to str
    norm = {}
    for k, v in files.items():
        norm[k] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, indent=2)
    payload["files"] = norm
    return payload


def provider_call(
    stage: str,
    prompt: str,
    provider_cfg: dict,
    giro: str,
    context: dict,
    dry_run: bool,
    on_provider_error: str = "fail",
):
    ptype = provider_cfg.get("type", "mock")

    if dry_run or ptype == "mock":
        if stage == "arquitecto":
            return json.dumps(mock_architecture(giro), ensure_ascii=False, indent=2)
        if stage in ("codificador", "debugger", "optimizador"):
            files = context.get("current_files")
            if files:
                return json.dumps(files, ensure_ascii=False, indent=2)
            return json.dumps(mock_files(giro, context.get("architecture", {})), ensure_ascii=False, indent=2)
        raise ValueError(f"Stage no soportado: {stage}")

    if ptype == "openai_compatible":
        api_key_env = provider_cfg.get("api_key_env")
        api_key = os.getenv(api_key_env or "")
        if not api_key:
            # fallback safe
            return provider_call(stage, prompt, {"type": "mock"}, giro, context, dry_run=True, on_provider_error=on_provider_error)

        base_url = provider_cfg.get("base_url", "").strip()
        model = provider_cfg.get("model", "").strip()
        if not base_url or not model:
            raise ValueError(f"Provider {stage} incompleto (base_url/model)")

        try:
            return call_openai_compatible(base_url=base_url, api_key=api_key, model=model, prompt=prompt)
        except Exception as e:
            if on_provider_error == "mock":
                print(f"[WARN] {stage} fallo en giro '{giro}'. Fallback a mock. Error: {e}")
                return provider_call(stage, prompt, {"type": "mock"}, giro, context, dry_run=True, on_provider_error=on_provider_error)
            raise

    raise ValueError(f"Tipo de provider no soportado: {ptype}")


def run_pipeline_for_giro(
    giro: str,
    providers_cfg: dict,
    output_root: Path,
    dry_run: bool,
    external_hint: str,
    on_provider_error: str,
):
    giro_slug = slugify(giro)
    run_dir = output_root / giro_slug
    run_dir.mkdir(parents=True, exist_ok=True)

    architect_prompt = fill_template(read_prompt("arquitecto"), {"GIRO": giro, "EXTERNAL_HINT": external_hint or "N/A"})
    arq_raw = provider_call(
        "arquitecto",
        architect_prompt,
        providers_cfg["arquitecto"],
        giro,
        {},
        dry_run,
        on_provider_error=on_provider_error,
    )
    architecture = extract_json(arq_raw)

    coder_prompt = fill_template(
        read_prompt("codificador"),
        {
            "GIRO": giro,
            "ARQUITECTURA_JSON": json.dumps(architecture, ensure_ascii=False, indent=2),
            "EXTERNAL_HINT": external_hint or "N/A",
        },
    )
    cod_raw = provider_call(
        "codificador",
        coder_prompt,
        providers_cfg["codificador"],
        giro,
        {"architecture": architecture},
        dry_run,
        on_provider_error=on_provider_error,
    )
    coded = ensure_files_payload(extract_json(cod_raw))

    dbg_prompt = fill_template(
        read_prompt("debugger"),
        {"GIRO": giro, "CODIGO_JSON": json.dumps(coded, ensure_ascii=False, indent=2)},
    )
    dbg_raw = provider_call(
        "debugger",
        dbg_prompt,
        providers_cfg["debugger"],
        giro,
        {"current_files": coded},
        dry_run,
        on_provider_error=on_provider_error,
    )
    debugged = ensure_files_payload(extract_json(dbg_raw))

    opt_prompt = fill_template(
        read_prompt("optimizador"),
        {"GIRO": giro, "DEBUG_JSON": json.dumps(debugged, ensure_ascii=False, indent=2)},
    )
    opt_raw = provider_call(
        "optimizador",
        opt_prompt,
        providers_cfg["optimizador"],
        giro,
        {"current_files": debugged},
        dry_run,
        on_provider_error=on_provider_error,
    )
    optimized = ensure_files_payload(extract_json(opt_raw))

    # write files
    for filename, content in optimized["files"].items():
        (run_dir / filename).write_text(content, encoding="utf-8")

    metadata = {
        "giro": giro,
        "giro_slug": giro_slug,
        "created_at": datetime.now().isoformat(),
        "dry_run": dry_run,
        "providers": providers_cfg,
        "architecture": architecture,
        "notes": {
            "coder": coded.get("notes", ""),
            "debugger": debugged.get("notes", ""),
            "optimizador": optimized.get("notes", ""),
        },
    }
    (run_dir / "pipeline-meta.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    return run_dir


def parse_args():
    ap = argparse.ArgumentParser(description="Orquestador multi-IA para plantillas de giros")
    ap.add_argument("--giro", help="Giro unico a generar")
    ap.add_argument("--all", action="store_true", help="Generar para todo el catalogo")
    ap.add_argument("--max", type=int, default=0, help="Limitar cantidad de giros")
    ap.add_argument("--config", default="providers.example.json", help="Ruta config providers JSON")
    ap.add_argument("--catalog", default="giros_catalogo.json", help="Ruta catalogo de giros JSON")
    ap.add_argument("--hint-file", default="", help="Archivo txt/md con briefing externo (ej. resumen DeepSeek manual)")
    ap.add_argument("--dry-run", action="store_true", help="No usa APIs externas, genera con mocks")
    ap.add_argument(
        "--on-provider-error",
        choices=["fail", "mock"],
        default="mock",
        help="Que hacer si una llamada API falla: fail (detener giro) o mock (fallback automatico, default)",
    )
    return ap.parse_args()


def main():
    args = parse_args()

    config_path = (ROOT / args.config) if not Path(args.config).is_absolute() else Path(args.config)
    catalog_path = (ROOT / args.catalog) if not Path(args.catalog).is_absolute() else Path(args.catalog)

    try:
        cfg = load_provider_config(config_path)
    except Exception as e:
        print(f"[ERROR] Config providers invalida: {e}")
        return 1

    providers_cfg = cfg.get("providers", {})
    for role in ["arquitecto", "codificador", "debugger", "optimizador"]:
        if role not in providers_cfg:
            providers_cfg[role] = {"type": "mock", "model": f"mock-{role}"}

    output_dir = cfg.get("output_dir", "output/plantillas-generadas")
    output_root = (ROOT / output_dir) if not Path(output_dir).is_absolute() else Path(output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    external_hint = ""
    if args.hint_file:
        hint_path = (ROOT / args.hint_file) if not Path(args.hint_file).is_absolute() else Path(args.hint_file)
        if hint_path.exists():
            external_hint = hint_path.read_text(encoding="utf-8").strip()
        else:
            print(f"[WARN] hint-file no existe: {hint_path}. Se ignora.")

    giros = []
    if args.giro:
        giros = [args.giro.strip()]
    elif args.all:
        if not catalog_path.exists():
            print(f"[ERROR] No existe catalogo: {catalog_path}")
            return 1
        giros = load_json(catalog_path)
    else:
        print("[ERROR] Debes usar --giro o --all")
        return 1

    if args.max and args.max > 0:
        giros = giros[: args.max]

    total = len(giros)
    print(f"[INFO] Giros a generar: {total}")
    print(f"[INFO] Output: {output_root}")
    print(f"[INFO] Modo dry-run: {args.dry_run}")
    print(f"[INFO] on-provider-error: {args.on_provider_error}")

    ok = 0
    failed = []
    for i, giro in enumerate(giros, 1):
        giro = str(giro).strip()
        if not giro:
            continue
        print(f"\n[{i}/{total}] Generando: {giro}")
        try:
            out = run_pipeline_for_giro(
                giro,
                providers_cfg,
                output_root,
                args.dry_run,
                external_hint,
                args.on_provider_error,
            )
            print(f"[OK] {giro} -> {out}")
            ok += 1
        except Exception as e:
            print(f"[FAIL] {giro}: {e}")
            failed.append({"giro": giro, "error": str(e)})

    summary = {
        "timestamp": datetime.now().isoformat(),
        "total": total,
        "ok": ok,
        "failed": failed,
        "dry_run": args.dry_run,
    }
    (output_root / "_run_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== RESUMEN ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
