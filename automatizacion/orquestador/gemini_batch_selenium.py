#!/usr/bin/env python3
import argparse
import json
import time
from datetime import datetime
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
except Exception:
    webdriver = None

GEMINI_URL = "https://gemini.google.com/"
INPUT_SELECTORS = [
    "rich-textarea div[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
    "textarea",
    "div[contenteditable='true']",
    "[role='textbox']",
]
RESPONSE_SELECTORS = ["model-response", "message-content", "main"]


def parse_args():
    ap = argparse.ArgumentParser(description="Lote Gemini con Selenium")
    ap.add_argument("--input-dir", required=True)
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--debugger-address", default="127.0.0.1:9222")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=0)
    ap.add_argument("--timeout", type=int, default=300)
    ap.add_argument("--no-pause", action="store_true")
    return ap.parse_args()


def find_input(driver, timeout_s=60):
    end = time.time() + timeout_s
    while time.time() < end:
        for sel in INPUT_SELECTORS:
            try:
                for el in driver.find_elements(By.CSS_SELECTOR, sel):
                    if el.is_displayed() and el.size.get("height", 0) > 16 and el.size.get("width", 0) > 30:
                        return el
            except Exception:
                pass
        time.sleep(0.4)
    raise RuntimeError(f"No se encontró input visible en {driver.current_url}")


def submit_prompt(driver, prompt):
    driver.get(GEMINI_URL)
    time.sleep(2)
    box = find_input(driver)
    box.click()
    try:
        box.clear()
    except Exception:
        pass
    box.send_keys(prompt)
    box.send_keys(Keys.ENTER)


def last_response(driver):
    for sel in RESPONSE_SELECTORS:
        try:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
            if elems:
                txt = elems[-1].text.strip()
                if txt:
                    return txt
        except Exception:
            pass
    return ""


def wait_response(driver, timeout_s=300, stable_rounds=5):
    end = time.time() + timeout_s
    last = ""
    stable = 0
    while time.time() < end:
        time.sleep(2)
        cur = last_response(driver)
        if not cur:
            continue
        if cur == last:
            stable += 1
        else:
            last = cur
            stable = 0
        if stable >= stable_rounds:
            return cur
    raise RuntimeError("Timeout esperando respuesta de Gemini")


def main():
    if webdriver is None:
        print("[ERROR] selenium no instalado")
        return 1

    args = parse_args()
    in_dir = Path(args.input_dir)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    prompts = sorted(in_dir.glob("*.txt"))
    if not prompts:
        print(f"[ERROR] No hay prompts en {in_dir}")
        return 1

    start = max(1, args.start)
    end = args.end if args.end > 0 else len(prompts)
    prompts = prompts[start - 1 : end]

    print(f"[INFO] prompts a ejecutar: {len(prompts)}")
    print(f"[INFO] output: {out_dir}")

    options = webdriver.ChromeOptions()
    options.debugger_address = args.debugger_address

    try:
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"[ERROR] No pude adjuntarme a Chrome {args.debugger_address}: {e}")
        return 1

    if not args.no_pause:
        print("[INFO] Verifica Gemini logueado y sin captcha. Enter para iniciar...")
        input()

    ok = 0
    failed = []

    for i, pf in enumerate(prompts, start=start):
        print(f"\\n[{i}] {pf.name}")
        try:
            prompt = pf.read_text(encoding="utf-8")
            submit_prompt(driver, prompt)
            text = wait_response(driver, timeout_s=args.timeout)
            (out_dir / f"{pf.stem}.response.txt").write_text(text, encoding="utf-8")
            (out_dir / f"{pf.stem}.meta.json").write_text(json.dumps({
                "prompt_file": str(pf),
                "saved_at": datetime.now().isoformat(),
                "chars": len(text)
            }, ensure_ascii=False, indent=2), encoding="utf-8")
            print("[OK]")
            ok += 1
        except Exception as e:
            print(f"[FAIL] {e}")
            failed.append({"prompt": pf.name, "error": str(e)})

    summary = {
        "timestamp": datetime.now().isoformat(),
        "ok": ok,
        "failed": failed,
        "total": len(prompts)
    }
    (out_dir / "_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\\n=== RESUMEN ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
