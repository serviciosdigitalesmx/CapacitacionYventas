#!/usr/bin/env python3
import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except Exception:
    sync_playwright = None
    PlaywrightTimeoutError = Exception

from manual_triple_bridge import (
    STAGES,
    DEFAULT_OUTPUT_DIR,
    load_json,
    slugify,
    stage_prompt,
    extract_json,
    ensure_files_payload,
)

ROOT = Path(__file__).resolve().parent
DEFAULT_AUTO_DIR = ROOT / "auto-bridge"

PROVIDER_RULES = {
    "deepseek": {
        "url": "https://chat.deepseek.com/",
        "input_selectors": [
            "textarea",
            "div[contenteditable='true']",
            "[role='textbox']",
        ],
        "response_selectors": [
            "main .markdown",
            "main .prose",
            "main article",
            "main",
        ],
    },
    "chatgpt": {
        "url": "https://chatgpt.com/",
        "input_selectors": [
            "textarea[data-testid='prompt-textarea']",
            "#prompt-textarea",
            "textarea",
            "[contenteditable='true']",
        ],
        "response_selectors": [
            "article[data-testid^='conversation-turn-'] .markdown",
            "article[data-testid^='conversation-turn-']",
            "main article",
            "main",
        ],
    },
    "gemini": {
        "url": "https://gemini.google.com/",
        "input_selectors": [
            "rich-textarea div[contenteditable='true']",
            "textarea",
            "div[contenteditable='true']",
            "[role='textbox']",
        ],
        "response_selectors": [
            "model-response .markdown",
            "model-response",
            "message-content",
            "main",
        ],
    },
}


def build_wrapped_prompt(raw_prompt: str) -> str:
    # Extra guard so extraction is deterministic.
    return (
        "Responde SOLO en JSON valido y nada mas. "
        "Encierra tu respuesta entre etiquetas exactas <SRFIX_JSON> y </SRFIX_JSON>.\n\n"
        "Formato requerido:\n"
        "<SRFIX_JSON>\n{ ... }\n</SRFIX_JSON>\n\n"
        "PROMPT ORIGINAL:\n"
        f"{raw_prompt}"
    )


def extract_json_from_response(raw_text: str):
    tagged = re.search(r"<SRFIX_JSON>\s*(\{.*\})\s*</SRFIX_JSON>", raw_text, flags=re.S)
    if tagged:
        return extract_json(tagged.group(1))
    return extract_json(raw_text)


def wait_for_visible_input(page, selectors, timeout_ms=120000):
    started = time.time()
    for sel in selectors:
        try:
            page.wait_for_selector(sel, state="visible", timeout=5000)
            return sel
        except PlaywrightTimeoutError:
            continue
    # Heuristic fallback for UI changes across providers.
    heuristic = page.evaluate(
        """
        () => {
          const nodes = Array.from(document.querySelectorAll('textarea, [contenteditable=\"true\"], [role=\"textbox\"]'));
          const visible = nodes.filter((el) => {
            const r = el.getBoundingClientRect();
            const s = window.getComputedStyle(el);
            return r.width > 40 && r.height > 20 && s.visibility !== 'hidden' && s.display !== 'none';
          });
          if (!visible.length) return null;
          const target = visible.sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height))[0];
          if (target.id) return `#${target.id}`;
          if (target.getAttribute('data-testid')) return `[data-testid=\"${target.getAttribute('data-testid')}\"]`;
          if (target.getAttribute('aria-label')) return `[aria-label=\"${target.getAttribute('aria-label')}\"]`;
          return target.tagName.toLowerCase();
        }
        """
    )
    if heuristic:
        try:
            page.wait_for_selector(heuristic, state="visible", timeout=3000)
            return heuristic
        except PlaywrightTimeoutError:
            pass
    elapsed = int((time.time() - started) * 1000)
    raise RuntimeError(f"No encontre caja de texto visible tras {elapsed}ms")


def submit_prompt(page, provider: str, prompt: str):
    rules = PROVIDER_RULES[provider]
    selector = wait_for_visible_input(page, rules["input_selectors"])

    # Focus and inject content.
    page.click(selector)
    try:
        page.fill(selector, prompt)
    except Exception:
        # contenteditable fallback
        page.evaluate(
            """
            (sel, value) => {
              const el = document.querySelector(sel);
              if (!el) return;
              if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                el.innerText = value;
                el.dispatchEvent(new InputEvent('input', { bubbles: true }));
              }
            }
            """,
            selector,
            prompt,
        )

    page.keyboard.press("Enter")


def _last_text_from_selectors(page, selectors):
    for sel in selectors:
        try:
            locator = page.locator(sel)
            count = locator.count()
            if count > 0:
                txt = locator.nth(count - 1).inner_text(timeout=2000).strip()
                if txt:
                    return txt
        except Exception:
            continue
    try:
        return page.locator("main").inner_text(timeout=2000).strip()
    except Exception:
        return ""


def wait_response_stable(page, provider: str, timeout_s: int = 240, stable_rounds: int = 4):
    selectors = PROVIDER_RULES[provider]["response_selectors"]
    end_at = time.time() + timeout_s
    last = ""
    same = 0

    while time.time() < end_at:
        time.sleep(2)
        current = _last_text_from_selectors(page, selectors)
        if not current:
            continue

        # when tagged json appears we can finish early
        if "<SRFIX_JSON>" in current and "</SRFIX_JSON>" in current:
            return current

        if current == last:
            same += 1
        else:
            same = 0
            last = current

        if same >= stable_rounds:
            return current

    raise RuntimeError(f"Timeout esperando respuesta estable de {provider}")


def ensure_pages(context):
    pages = {"deepseek": None, "chatgpt": None, "gemini": None}

    for p in context.pages:
        url = p.url or ""
        if "chat.deepseek.com" in url:
            pages["deepseek"] = p
        elif "chatgpt.com" in url:
            pages["chatgpt"] = p
        elif "gemini.google.com" in url:
            pages["gemini"] = p

    for provider, page in pages.items():
        if page is None:
            page = context.new_page()
            page.goto(PROVIDER_RULES[provider]["url"], wait_until="domcontentloaded")
            pages[provider] = page

    return pages


def process_giro(giro: str, pages: dict, auto_dir: Path, output_dir: Path, external_hint: str):
    giro_slug = slugify(giro)
    giro_dir = auto_dir / giro_slug
    prompts_dir = giro_dir / "prompts"
    responses_dir = giro_dir / "responses"
    prompts_dir.mkdir(parents=True, exist_ok=True)
    responses_dir.mkdir(parents=True, exist_ok=True)

    context = {}
    used = []

    for idx, (stage, provider) in enumerate(STAGES, start=1):
        print(f"[STEP] {giro} :: {stage} via {provider}")
        raw_prompt = stage_prompt(stage, giro, external_hint, context)
        wrapped = build_wrapped_prompt(raw_prompt)

        prompt_file = prompts_dir / f"{idx:02d}_{stage}.{provider}.prompt.md"
        response_file = responses_dir / f"{idx:02d}_{stage}.{provider}.response.txt"
        parsed_file = responses_dir / f"{idx:02d}_{stage}.{provider}.parsed.json"

        prompt_file.write_text(wrapped, encoding="utf-8")

        page = pages[provider]
        page.bring_to_front()
        submit_prompt(page, provider, wrapped)
        raw_response = wait_response_stable(page, provider)
        response_file.write_text(raw_response, encoding="utf-8")

        parsed = extract_json_from_response(raw_response)
        parsed_file.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")

        used.append(provider)

        if stage == "arquitecto":
            context["architecture"] = parsed
        elif stage == "codificador":
            context["coded"] = ensure_files_payload(parsed)
        elif stage == "debugger":
            context["debugged"] = ensure_files_payload(parsed)
        elif stage == "optimizador":
            context["optimized"] = ensure_files_payload(parsed)

    required = {"deepseek", "chatgpt", "gemini"}
    if not required.issubset(set(used)):
        raise RuntimeError("No se uso el trio obligatorio DeepSeek+ChatGPT+Gemini")

    optimized = context.get("optimized")
    if not optimized:
        raise RuntimeError("No hay output optimizado")

    final_dir = output_dir / giro_slug
    final_dir.mkdir(parents=True, exist_ok=True)
    for filename, content in optimized["files"].items():
        (final_dir / filename).write_text(content, encoding="utf-8")

    meta = {
        "giro": giro,
        "giro_slug": giro_slug,
        "created_at": datetime.now().isoformat(),
        "mode": "auto_triple_bridge_playwright",
        "sequence": STAGES,
        "used_providers": used,
        "source_auto_dir": str(giro_dir),
    }
    (final_dir / "pipeline-meta-auto.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    return final_dir


def parse_args():
    ap = argparse.ArgumentParser(description="Automatizacion UI sin API: DeepSeek + ChatGPT + Gemini")
    ap.add_argument("--giro", help="Giro unico a generar")
    ap.add_argument("--all", action="store_true", help="Generar para todo el catalogo")
    ap.add_argument("--max", type=int, default=0, help="Limitar cantidad")
    ap.add_argument("--catalog", default="giros_catalogo.json", help="Ruta catalogo")
    ap.add_argument("--hint-file", default="", help="Archivo txt/md con briefing externo")
    ap.add_argument("--auto-dir", default=str(DEFAULT_AUTO_DIR), help="Directorio para prompts/responses automaticos")
    ap.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directorio de salida final")
    ap.add_argument("--profile-dir", default=str(ROOT / ".pw-profile"), help="Perfil persistente playwright")
    ap.add_argument("--use-chrome-profile", action="store_true", help="Usar perfil real de Google Chrome")
    ap.add_argument("--cdp-url", default="", help="Conectar a Chrome existente via CDP (ej. http://127.0.0.1:9222)")
    ap.add_argument(
        "--chrome-user-data-dir",
        default=str(Path.home() / "Library/Application Support/Google/Chrome"),
        help="Ruta user data dir de Chrome (macOS default)",
    )
    ap.add_argument("--chrome-profile-directory", default="Default", help="Subperfil de Chrome (Default, Profile 1, etc)")
    ap.add_argument("--headless", action="store_true", help="Ejecutar sin ventana (no recomendado para login)")
    return ap.parse_args()


def main():
    if sync_playwright is None:
        print("[ERROR] Falta playwright. Instala con: python3 -m pip install playwright && python3 -m playwright install chromium")
        return 1

    args = parse_args()

    catalog_path = (ROOT / args.catalog) if not Path(args.catalog).is_absolute() else Path(args.catalog)
    auto_dir = (ROOT / args.auto_dir) if not Path(args.auto_dir).is_absolute() else Path(args.auto_dir)
    output_dir = (ROOT / args.output_dir) if not Path(args.output_dir).is_absolute() else Path(args.output_dir)
    profile_dir = (ROOT / args.profile_dir) if not Path(args.profile_dir).is_absolute() else Path(args.profile_dir)
    chrome_user_data_dir = (
        (ROOT / args.chrome_user_data_dir) if not Path(args.chrome_user_data_dir).is_absolute() else Path(args.chrome_user_data_dir)
    )

    auto_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    if not args.use_chrome_profile:
        profile_dir.mkdir(parents=True, exist_ok=True)

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
    if args.use_chrome_profile:
        print(f"[INFO] Chrome user data: {chrome_user_data_dir}")
        print(f"[INFO] Chrome profile dir: {args.chrome_profile_directory}")
    else:
        print(f"[INFO] Profile: {profile_dir}")

    ok = 0
    failed = []

    with sync_playwright() as p:
        close_context_on_exit = True
        try:
            if args.cdp_url:
                browser = p.chromium.connect_over_cdp(args.cdp_url)
                if browser.contexts:
                    context = browser.contexts[0]
                else:
                    context = browser.new_context()
                close_context_on_exit = False
            elif args.use_chrome_profile:
                context = p.chromium.launch_persistent_context(
                    str(chrome_user_data_dir),
                    channel="chrome",
                    headless=args.headless,
                    viewport={"width": 1440, "height": 900},
                    args=[f"--profile-directory={args.chrome_profile_directory}"],
                )
            else:
                context = p.chromium.launch_persistent_context(
                    str(profile_dir),
                    headless=args.headless,
                    viewport={"width": 1440, "height": 900},
                )
        except Exception as e:
            print(f"[ERROR] No pude abrir el contexto del navegador: {e}")
            if args.use_chrome_profile:
                print("[TIP] Cierra completamente Google Chrome y vuelve a correr el comando (incluyendo procesos en segundo plano).")
            if args.cdp_url:
                print("[TIP] Abre Chrome con --remote-debugging-port=9222 y vuelve a intentar.")
            return 1

        pages = ensure_pages(context)

        print("[INFO] Si no hay sesion iniciada, logueate una vez en cada pestaña y luego presiona Enter...")
        input()

        for i, giro in enumerate(giros, start=1):
            giro = str(giro).strip()
            if not giro:
                continue
            print(f"\n[{i}/{len(giros)}] Generando: {giro}")
            try:
                out = process_giro(giro, pages, auto_dir, output_dir, external_hint)
                print(f"[OK] {giro} -> {out}")
                ok += 1
            except Exception as e:
                print(f"[FAIL] {giro}: {e}")
                failed.append({"giro": giro, "error": str(e)})

        if close_context_on_exit:
            context.close()

    summary = {
        "timestamp": datetime.now().isoformat(),
        "total": len(giros),
        "ok": ok,
        "failed": failed,
        "mode": "auto_triple_bridge_playwright",
    }
    summary_path = auto_dir / "_auto_bridge_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== RESUMEN ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"[INFO] Summary: {summary_path}")

    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
