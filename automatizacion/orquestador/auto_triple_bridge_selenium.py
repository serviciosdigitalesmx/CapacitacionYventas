#!/usr/bin/env python3
import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from manual_triple_bridge import (
    STAGES,
    DEFAULT_OUTPUT_DIR,
    load_json,
    slugify,
    stage_prompt,
    extract_json,
    ensure_files_payload,
)

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
except Exception:
    webdriver = None

ROOT = Path(__file__).resolve().parent
DEFAULT_AUTO_DIR = ROOT / "auto-bridge"

PROVIDER_RULES = {
    "deepseek": {
        "url": "https://chat.deepseek.com/",
        "input_selectors": ["textarea", "div[contenteditable='true']", "[role='textbox']"],
        "response_selectors": ["main .markdown", "main .prose", "main article", "main"],
    },
    "chatgpt": {
        "url": "https://chatgpt.com/",
        "input_selectors": ["textarea[data-testid='prompt-textarea']", "#prompt-textarea", "textarea", "[contenteditable='true']"],
        "response_selectors": ["article[data-testid^='conversation-turn-'] .markdown", "article[data-testid^='conversation-turn-']", "main article", "main"],
    },
    "gemini": {
        "url": "https://gemini.google.com/",
        "input_selectors": ["rich-textarea div[contenteditable='true']", "textarea", "div[contenteditable='true']", "[role='textbox']"],
        "response_selectors": ["model-response .markdown", "model-response", "message-content", "main"],
    },
}

METHODOLOGY_PROVIDERS = ["deepseek", "chatgpt", "gemini"]


def build_wrapped_prompt(raw_prompt: str) -> str:
    return (
        "Responde SOLO en JSON valido y nada mas. "
        "Encierra tu respuesta entre etiquetas exactas <SRFIX_JSON> y </SRFIX_JSON>.\n\n"
        "Formato requerido:\n<SRFIX_JSON>\n{ ... }\n</SRFIX_JSON>\n\n"
        "PROMPT ORIGINAL:\n"
        f"{raw_prompt}"
    )


def extract_json_from_response(raw_text: str):
    tagged = re.search(r"<SRFIX_JSON>\s*(\{.*\})\s*</SRFIX_JSON>", raw_text, flags=re.S)
    if tagged:
        return extract_json(tagged.group(1))
    return extract_json(raw_text)


def methodology_prompt(provider: str) -> str:
    role = {
        "deepseek": "arquitectura y optimizacion de plantillas replicables",
        "chatgpt": "codificacion de archivos base (HTML, Apps Script, config)",
        "gemini": "debug, validacion y endurecimiento de calidad",
    }.get(provider, "diseno de plantillas")
    return (
        "Necesito tu metodologia GLOBAL para producir 80 plantillas de negocios locales, una por giro, de forma consistente y replicable.\\n\\n"
        f"Tu responsabilidad principal en este pipeline: {role}.\\n\\n"
        "Devuelve SOLO JSON valido entre etiquetas <SRFIX_JSON> ... </SRFIX_JSON> con este formato exacto:\\n"
        "{\\n"
        '  "provider": "' + provider + '",\\n'
        '  "principios": ["..."],\\n'
        '  "checklist_operativa": ["..."],\\n'
        '  "errores_comunes": ["..."],\\n'
        '  "criterios_aceptacion": ["..."],\\n'
        '  "plantilla_mental": "pasos concretos reutilizables para cada giro"\\n'
        "}\\n\\n"
        "Contexto de salida final por giro: index.html, cotizador.html, portal.html, Code.gs, config.json."
    )


def normalize_methodology_text(method_item):
    if isinstance(method_item, dict):
        return json.dumps(method_item, ensure_ascii=False, indent=2)
    if isinstance(method_item, str):
        return method_item
    return ""


def collect_methodology(driver, auto_dir: Path):
    methodology = {}
    method_dir = auto_dir / "_methodology"
    method_dir.mkdir(parents=True, exist_ok=True)

    for provider in METHODOLOGY_PROVIDERS:
        print(f"[META] Recolectando metodologia global de {provider}...")
        prompt = methodology_prompt(provider)
        raw = run_stage(driver, provider, prompt, debug_dir=method_dir, stage_name=f"methodology-{provider}")
        raw_path = method_dir / f"{provider}.raw.txt"
        raw_path.write_text(raw, encoding="utf-8")
        try:
            parsed = extract_json_from_response(raw)
        except Exception:
            parsed = {"provider": provider, "raw": raw}
        parsed_path = method_dir / f"{provider}.json"
        parsed_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
        methodology[provider] = parsed

    return methodology


def find_visible_input(driver, selectors, timeout_s=45):
    end = time.time() + timeout_s
    while time.time() < end:
        for sel in selectors:
            try:
                elems = driver.find_elements(By.CSS_SELECTOR, sel)
                for el in elems:
                    if el.is_displayed() and el.size.get("height", 0) > 16 and el.size.get("width", 0) > 30:
                        return el
            except Exception:
                continue
        time.sleep(0.5)
    raise RuntimeError(f"No encontre caja de texto visible | url={driver.current_url} | title={driver.title}")


def submit_prompt(driver, provider: str, prompt: str):
    inp = find_visible_input(driver, PROVIDER_RULES[provider]["input_selectors"])
    try:
        inp.clear()
    except Exception:
        pass
    inp.click()
    inp.send_keys(prompt)
    inp.send_keys(Keys.ENTER)


def last_response_text(driver, selectors):
    for sel in selectors:
        try:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
            if elems:
                txt = elems[-1].text.strip()
                if txt:
                    return txt
        except Exception:
            continue
    return ""


def wait_response_stable(driver, provider: str, timeout_s=240, stable_rounds=4):
    selectors = PROVIDER_RULES[provider]["response_selectors"]
    end = time.time() + timeout_s
    last = ""
    same = 0

    while time.time() < end:
        time.sleep(2)
        current = last_response_text(driver, selectors)
        if not current:
            continue
        if "<SRFIX_JSON>" in current and "</SRFIX_JSON>" in current:
            return current
        if current == last:
            same += 1
        else:
            last = current
            same = 0
        if same >= stable_rounds:
            return current

    raise RuntimeError(f"Timeout esperando respuesta estable de {provider}")


def run_stage(driver, provider: str, prompt: str, debug_dir: Path | None = None, stage_name: str = ""):
    driver.get(PROVIDER_RULES[provider]["url"])
    time.sleep(2)
    try:
        submit_prompt(driver, provider, prompt)
    except Exception:
        if debug_dir:
            debug_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            (debug_dir / f"{stamp}.{stage_name}.{provider}.html").write_text(driver.page_source, encoding="utf-8")
            driver.save_screenshot(str(debug_dir / f"{stamp}.{stage_name}.{provider}.png"))
        raise
    return wait_response_stable(driver, provider)


def process_giro(giro: str, driver, auto_dir: Path, output_dir: Path, external_hint: str, methodology: dict):
    giro_slug = slugify(giro)
    giro_dir = auto_dir / giro_slug
    prompts_dir = giro_dir / "prompts"
    responses_dir = giro_dir / "responses"
    debug_dir = giro_dir / "debug"
    prompts_dir.mkdir(parents=True, exist_ok=True)
    responses_dir.mkdir(parents=True, exist_ok=True)

    ctx = {"methodology": methodology or {}}
    used = []

    for idx, (stage, provider) in enumerate(STAGES, start=1):
        print(f"[STEP] {giro} :: {stage} via {provider}")
        raw_prompt = stage_prompt(stage, giro, external_hint, ctx)
        method_text = normalize_methodology_text(ctx.get("methodology", {}).get(provider, ""))
        if method_text:
            raw_prompt = (
                "Contexto metodologico obligatorio para esta etapa. Debes seguirlo:\\n"
                f"{method_text}\\n\\n"
                "Ahora resuelve la tarea del giro respetando ese marco:\\n\\n"
                f"{raw_prompt}"
            )
        wrapped = build_wrapped_prompt(raw_prompt)

        prompt_file = prompts_dir / f"{idx:02d}_{stage}.{provider}.prompt.md"
        resp_file = responses_dir / f"{idx:02d}_{stage}.{provider}.response.txt"
        parsed_file = responses_dir / f"{idx:02d}_{stage}.{provider}.parsed.json"

        prompt_file.write_text(wrapped, encoding="utf-8")

        raw_response = run_stage(driver, provider, wrapped, debug_dir=debug_dir, stage_name=stage)
        resp_file.write_text(raw_response, encoding="utf-8")

        parsed = extract_json_from_response(raw_response)
        parsed_file.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")

        used.append(provider)
        if stage == "arquitecto":
            ctx["architecture"] = parsed
        elif stage == "codificador":
            ctx["coded"] = ensure_files_payload(parsed)
        elif stage == "debugger":
            ctx["debugged"] = ensure_files_payload(parsed)
        elif stage == "optimizador":
            ctx["optimized"] = ensure_files_payload(parsed)

    if not {"deepseek", "chatgpt", "gemini"}.issubset(set(used)):
        raise RuntimeError("No se uso el trio obligatorio")

    optimized = ctx.get("optimized")
    if not optimized:
        raise RuntimeError("No hay output optimizado")

    out_dir = output_dir / giro_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    for filename, content in optimized["files"].items():
        (out_dir / filename).write_text(content, encoding="utf-8")

    meta = {
        "giro": giro,
        "giro_slug": giro_slug,
        "created_at": datetime.now().isoformat(),
        "mode": "auto_triple_bridge_selenium",
        "sequence": STAGES,
        "used_providers": used,
        "source_auto_dir": str(giro_dir),
    }
    (out_dir / "pipeline-meta-auto-selenium.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return out_dir


def parse_args():
    ap = argparse.ArgumentParser(description="Automatizacion Selenium sin API: DeepSeek + ChatGPT + Gemini")
    ap.add_argument("--giro", help="Giro unico")
    ap.add_argument("--all", action="store_true", help="Todo el catalogo")
    ap.add_argument("--max", type=int, default=0, help="Limitar cantidad")
    ap.add_argument("--catalog", default="giros_catalogo.json")
    ap.add_argument("--hint-file", default="")
    ap.add_argument("--auto-dir", default=str(DEFAULT_AUTO_DIR))
    ap.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    ap.add_argument("--chrome-user-data-dir", default=str(Path.home() / "Library/Application Support/Google/Chrome"))
    ap.add_argument("--chrome-profile-directory", default="Default")
    ap.add_argument("--debugger-address", default="", help="Adjuntarse a Chrome abierto (ej. 127.0.0.1:9222)")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--no-pause", action="store_true", help="No esperar Enter antes de arrancar el pipeline")
    ap.add_argument("--methodology-file", default=str(DEFAULT_AUTO_DIR / "_methodology.json"), help="Archivo JSON de metodologia global")
    ap.add_argument("--collect-methodology", action="store_true", help="Forzar recoleccion de metodologia global")
    return ap.parse_args()


def main():
    if webdriver is None:
        print("[ERROR] Falta selenium. Instala con: python3 -m pip install selenium")
        return 1

    args = parse_args()

    catalog_path = (ROOT / args.catalog) if not Path(args.catalog).is_absolute() else Path(args.catalog)
    auto_dir = (ROOT / args.auto_dir) if not Path(args.auto_dir).is_absolute() else Path(args.auto_dir)
    output_dir = (ROOT / args.output_dir) if not Path(args.output_dir).is_absolute() else Path(args.output_dir)
    chrome_user_data_dir = (ROOT / args.chrome_user_data_dir) if not Path(args.chrome_user_data_dir).is_absolute() else Path(args.chrome_user_data_dir)
    methodology_file = (ROOT / args.methodology_file) if not Path(args.methodology_file).is_absolute() else Path(args.methodology_file)

    auto_dir.mkdir(parents=True, exist_ok=True)
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

    print(f"[INFO] Giros: {len(giros)}")
    print(f"[INFO] Auto dir: {auto_dir}")
    print(f"[INFO] Output: {output_dir}")
    print(f"[INFO] Chrome user data: {chrome_user_data_dir}")
    print(f"[INFO] Chrome profile: {args.chrome_profile_directory}")

    options = webdriver.ChromeOptions()
    if args.debugger_address:
        options.debugger_address = args.debugger_address
    else:
        options.add_argument(f"--user-data-dir={chrome_user_data_dir}")
        options.add_argument(f"--profile-directory={args.chrome_profile_directory}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--start-maximized")
    if args.headless:
        options.add_argument("--headless=new")

    try:
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"[ERROR] No pude iniciar Chrome con Selenium: {e}")
        print("[TIP] Cierra completamente Chrome si el perfil esta en uso y vuelve a intentar.")
        if args.debugger_address:
            print("[TIP] Verifica que Chrome este abierto con --remote-debugging-port=9222.")
        return 1

    if not args.no_pause:
        print("[INFO] Si hace falta login/captcha, resuelvelo y presiona Enter para arrancar...")
        input()

    # Phase 0: collect or load methodology for the three providers.
    methodology = {}
    if methodology_file.exists() and not args.collect_methodology:
        try:
            methodology = json.loads(methodology_file.read_text(encoding="utf-8"))
            print(f"[META] Metodologia cargada de: {methodology_file}")
        except Exception:
            methodology = {}

    if not methodology:
        methodology = collect_methodology(driver, auto_dir)
        methodology_file.parent.mkdir(parents=True, exist_ok=True)
        methodology_file.write_text(json.dumps(methodology, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[META] Metodologia guardada en: {methodology_file}")

    ok = 0
    failed = []

    try:
        for i, giro in enumerate(giros, start=1):
            giro = str(giro).strip()
            if not giro:
                continue
            print(f"\n[{i}/{len(giros)}] Generando: {giro}")
            try:
                out = process_giro(giro, driver, auto_dir, output_dir, external_hint, methodology)
                print(f"[OK] {giro} -> {out}")
                ok += 1
            except Exception as e:
                print(f"[FAIL] {giro}: {e}")
                failed.append({"giro": giro, "error": str(e)})
    finally:
        driver.quit()

    summary = {
        "timestamp": datetime.now().isoformat(),
        "total": len(giros),
        "ok": ok,
        "failed": failed,
        "mode": "auto_triple_bridge_selenium",
    }
    summary_path = auto_dir / "_auto_bridge_selenium_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== RESUMEN ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"[INFO] Summary: {summary_path}")
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
