#!/usr/bin/env python3
import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROMPTS_DIR = ROOT / "prompts"
DEFAULT_OUTPUT_DIR = ROOT / "output" / "plantillas-generadas"
DEFAULT_BRIDGE_DIR = ROOT / "manual-bridge"

# Required sequence: each provider must be used.
STAGES = [
    ("arquitecto", "deepseek"),
    ("codificador", "chatgpt"),
    ("debugger", "gemini"),
    ("optimizador", "deepseek"),
]


def slugify(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "giro-sin-nombre"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


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

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError("No se pudo parsear JSON de la respuesta")


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

    normalized = {}
    for k, v in files.items():
        normalized[k] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, indent=2)
    payload["files"] = normalized
    return payload


def stage_prompt(stage: str, giro: str, external_hint: str, data: dict) -> str:
    if stage == "arquitecto":
        return fill_template(
            read_prompt("arquitecto"),
            {"GIRO": giro, "EXTERNAL_HINT": external_hint or "N/A"},
        )

    if stage == "codificador":
        return fill_template(
            read_prompt("codificador"),
            {
                "GIRO": giro,
                "ARQUITECTURA_JSON": json.dumps(data["architecture"], ensure_ascii=False, indent=2),
                "EXTERNAL_HINT": external_hint or "N/A",
            },
        )

    if stage == "debugger":
        return fill_template(
            read_prompt("debugger"),
            {
                "GIRO": giro,
                "CODIGO_JSON": json.dumps(data["coded"], ensure_ascii=False, indent=2),
            },
        )

    if stage == "optimizador":
        return fill_template(
            read_prompt("optimizador"),
            {
                "GIRO": giro,
                "DEBUG_JSON": json.dumps(data["debugged"], ensure_ascii=False, indent=2),
            },
        )

    raise ValueError(f"Stage no soportado: {stage}")


def provider_url(provider: str) -> str:
    urls = {
        "deepseek": "https://chat.deepseek.com/",
        "chatgpt": "https://chatgpt.com/",
        "gemini": "https://gemini.google.com/",
    }
    return urls.get(provider, "")


def write_manual_prompt(prompt_file: Path, stage: str, provider: str, prompt: str):
    header = [
        f"# Etapa: {stage}",
        f"# Proveedor obligatorio: {provider}",
        f"# URL sugerida: {provider_url(provider)}",
        "# Instruccion: pega este prompt en el proveedor indicado y guarda la respuesta completa en el archivo responses correspondiente.",
        "",
    ]
    prompt_file.write_text("\n".join(header) + prompt, encoding="utf-8")


def load_stage_response(path: Path):
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return None
    return extract_json(text)


def process_giro(giro: str, bridge_root: Path, output_root: Path, external_hint: str):
    giro_slug = slugify(giro)
    giro_dir = bridge_root / giro_slug
    prompts_dir = giro_dir / "prompts"
    responses_dir = giro_dir / "responses"
    prompts_dir.mkdir(parents=True, exist_ok=True)
    responses_dir.mkdir(parents=True, exist_ok=True)

    context = {}
    pending = []
    used_providers = []

    for idx, (stage, provider) in enumerate(STAGES, start=1):
        prompt_text = stage_prompt(stage, giro, external_hint, context)
        prompt_file = prompts_dir / f"{idx:02d}_{stage}.{provider}.prompt.md"
        response_file = responses_dir / f"{idx:02d}_{stage}.{provider}.response.json"

        write_manual_prompt(prompt_file, stage, provider, prompt_text)

        parsed = load_stage_response(response_file)
        if parsed is None:
            pending.append(
                {
                    "stage": stage,
                    "provider": provider,
                    "prompt_file": str(prompt_file),
                    "response_file": str(response_file),
                }
            )
            break

        used_providers.append(provider)

        if stage == "arquitecto":
            context["architecture"] = parsed
        elif stage == "codificador":
            context["coded"] = ensure_files_payload(parsed)
        elif stage == "debugger":
            context["debugged"] = ensure_files_payload(parsed)
        elif stage == "optimizador":
            context["optimized"] = ensure_files_payload(parsed)

    # only finalize if no pending and optimized exists
    if pending:
        return {
            "giro": giro,
            "giro_slug": giro_slug,
            "status": "pending_manual_input",
            "pending": pending,
            "used_providers": list(dict.fromkeys(used_providers)),
        }

    optimized = context.get("optimized")
    if not optimized:
        return {
            "giro": giro,
            "giro_slug": giro_slug,
            "status": "failed",
            "error": "No hay payload final optimizado",
            "used_providers": list(dict.fromkeys(used_providers)),
        }

    # guarantee that all 3 are used at least once
    required = {"deepseek", "chatgpt", "gemini"}
    if not required.issubset(set(used_providers)):
        return {
            "giro": giro,
            "giro_slug": giro_slug,
            "status": "failed",
            "error": "No se cumplio uso obligatorio de DeepSeek, ChatGPT y Gemini",
            "used_providers": list(dict.fromkeys(used_providers)),
        }

    out_dir = output_root / giro_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    for filename, content in optimized["files"].items():
        (out_dir / filename).write_text(content, encoding="utf-8")

    meta = {
        "giro": giro,
        "giro_slug": giro_slug,
        "created_at": datetime.now().isoformat(),
        "mode": "manual_triple_bridge",
        "sequence": STAGES,
        "used_providers": list(dict.fromkeys(used_providers)),
        "source_bridge_dir": str(giro_dir),
    }
    (out_dir / "pipeline-meta-manual.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "giro": giro,
        "giro_slug": giro_slug,
        "status": "ok",
        "output_dir": str(out_dir),
        "used_providers": list(dict.fromkeys(used_providers)),
    }


def parse_args():
    ap = argparse.ArgumentParser(description="Puente manual obligatorio DeepSeek + ChatGPT + Gemini")
    ap.add_argument("--giro", help="Giro unico a generar")
    ap.add_argument("--all", action="store_true", help="Generar para todo el catalogo")
    ap.add_argument("--max", type=int, default=0, help="Limitar cantidad de giros")
    ap.add_argument("--catalog", default="giros_catalogo.json", help="Ruta catalogo de giros JSON")
    ap.add_argument("--hint-file", default="", help="Archivo txt/md con briefing externo")
    ap.add_argument("--bridge-dir", default=str(DEFAULT_BRIDGE_DIR), help="Carpeta de prompts/responses manuales")
    ap.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Carpeta de salida final")
    return ap.parse_args()


def main():
    args = parse_args()

    catalog_path = (ROOT / args.catalog) if not Path(args.catalog).is_absolute() else Path(args.catalog)
    bridge_dir = (ROOT / args.bridge_dir) if not Path(args.bridge_dir).is_absolute() else Path(args.bridge_dir)
    output_dir = (ROOT / args.output_dir) if not Path(args.output_dir).is_absolute() else Path(args.output_dir)
    bridge_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    external_hint = ""
    if args.hint_file:
        hint_path = (ROOT / args.hint_file) if not Path(args.hint_file).is_absolute() else Path(args.hint_file)
        if hint_path.exists():
            external_hint = hint_path.read_text(encoding="utf-8").strip()

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

    print(f"[INFO] Giros a procesar: {len(giros)}")
    print(f"[INFO] Bridge manual: {bridge_dir}")
    print(f"[INFO] Output: {output_dir}")

    results = []
    for i, giro in enumerate(giros, start=1):
        giro = str(giro).strip()
        if not giro:
            continue
        print(f"\n[{i}/{len(giros)}] {giro}")
        try:
            result = process_giro(giro, bridge_dir, output_dir, external_hint)
            results.append(result)
            if result["status"] == "ok":
                print(f"[OK] {giro} -> {result['output_dir']}")
            elif result["status"] == "pending_manual_input":
                p = result["pending"][0]
                print(f"[PENDING] {giro}: completa {p['provider']} en {p['response_file']}")
                print(f"          prompt: {p['prompt_file']}")
            else:
                print(f"[FAIL] {giro}: {result.get('error', 'error desconocido')}")
        except Exception as e:
            results.append({"giro": giro, "status": "failed", "error": str(e)})
            print(f"[FAIL] {giro}: {e}")

    summary = {
        "timestamp": datetime.now().isoformat(),
        "total": len(results),
        "ok": sum(1 for r in results if r.get("status") == "ok"),
        "pending": [r for r in results if r.get("status") == "pending_manual_input"],
        "failed": [r for r in results if r.get("status") == "failed"],
        "mode": "manual_triple_bridge",
        "required_providers": ["deepseek", "chatgpt", "gemini"],
    }

    summary_file = bridge_dir / "_manual_bridge_summary.json"
    summary_file.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== RESUMEN ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\n[INFO] Summary guardado en: {summary_file}")

    if summary["failed"]:
        return 2
    if summary["pending"]:
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
