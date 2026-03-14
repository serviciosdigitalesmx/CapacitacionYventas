#!/usr/bin/env python3
import base64
import json
import os
import re
import socket
import subprocess
import tempfile
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "docs" / "KIT_REPLICABLE_V1_INTERACTIVO.html"
CLONE_SCRIPT = ROOT / "scripts" / "create-client-copy.sh"
PLANTILLAS_DIR = ROOT / "plantillas"
DEFAULT_SOURCE = str(ROOT)
NEGOCIOS_DIR = ROOT / "NEGOCIOS INSCRITOS"
STATUS_DIR_MAP = {
    "nuevo": "nuevo",
    "en-config": "en-config",
    "entregado": "entregado",
    "mantenimiento": "mantenimiento",
}
PREVIEW_SERVERS = {}


def json_response(handler, code, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def slugify(text):
    text = (text or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "cliente-nuevo"


def infer_vertical_profile(slug: str) -> str:
    slug = (slug or "").strip().lower()
    token_slug = f"-{slug}-"
    if re.search(r"-(academia|escuela|guarderia|ingles|musica|yoga)-", token_slug):
        return "academia"
    if re.search(r"-(barberia|salon|belleza|spa|unas|manicure)-", token_slug):
        return "barberia"
    if re.search(
        r"-(abarrotes|tienda|carniceria|fruteria|panaderia|tortilleria|cafeteria|restaurante|taqueria|dark-kitchen|pasteleria|heladeria|floreria|eventos|banquetes|pet-shop|ropa|boutique|joyeria|zapateria|muebleria|colchones|electronica)-",
        token_slug,
    ):
        return "abarrotes"
    return "tecnico"


def pretty_giro_name(slug: str) -> str:
    words = [w for w in (slug or "").replace("-", " ").split(" ") if w]
    return " ".join(w.capitalize() for w in words) or "Giro"


def list_giros():
    items = []
    if not PLANTILLAS_DIR.exists():
        return items

    for p in sorted(PLANTILLAS_DIR.iterdir()):
        if not p.is_dir():
            continue
        m = re.match(r"^(\d{2})_(.+)$", p.name)
        if not m:
            continue
        slug = m.group(2)
        items.append(
            {
                "id": p.name,
                "numero": m.group(1),
                "slug": slug,
                "name": pretty_giro_name(slug),
                "vertical_profile": infer_vertical_profile(slug),
                "source": str(p),
            }
        )
    return items


def decode_data_url(data_url):
    if not data_url or "," not in data_url:
        return None, None
    header, b64 = data_url.split(",", 1)
    mime = ""
    m = re.match(r"data:([^;]+);base64", header)
    if m:
        mime = m.group(1).lower()
    try:
        return mime, base64.b64decode(b64)
    except Exception:
        return mime, None


def write_logo_variants(target_path: Path, mime: str, data: bytes):
    """Accepts jpeg/png/webp and generates at least logo.png without manual conversion."""
    if not data:
        return {"png": False, "webp": False}

    ext_map = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
    }
    ext = ext_map.get(mime, ".img")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tf:
        tf.write(data)
        src = Path(tf.name)

    out_png = target_path / "logo.png"
    out_webp = target_path / "logo.webp"
    wrote_png = False
    wrote_webp = False

    try:
        if mime == "image/png":
            out_png.write_bytes(data)
            wrote_png = True
        else:
            try:
                subprocess.run(
                    ["sips", "-s", "format", "png", str(src), "--out", str(out_png)],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                wrote_png = True
            except Exception:
                # Fallback: still keep raw bytes in logo.png so user doesn't lose logo.
                out_png.write_bytes(data)
                wrote_png = True

        if mime == "image/webp":
            out_webp.write_bytes(data)
            wrote_webp = True
        else:
            try:
                subprocess.run(
                    ["sips", "-s", "format", "webp", str(src), "--out", str(out_webp)],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                wrote_webp = True
            except Exception:
                # Evita conservar webp viejo del template; forzamos fallback a logo.png.
                try:
                    out_webp.unlink(missing_ok=True)
                except Exception:
                    pass
                wrote_webp = False
    finally:
        try:
            src.unlink(missing_ok=True)
        except Exception:
            pass

    return {"png": wrote_png, "webp": wrote_webp}


def find_free_port(start=8791, attempts=30):
    for port in range(start, start + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("No se encontró puerto libre para preview")


def start_preview_server(target_dir: Path):
    target_dir = target_dir.resolve()
    key = str(target_dir)
    existing = PREVIEW_SERVERS.get(key)
    if existing:
        proc = existing["proc"]
        if proc and proc.poll() is None:
            return existing["url"]
        PREVIEW_SERVERS.pop(key, None)

    port = find_free_port()
    proc = subprocess.Popen(
        ["python3", "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=str(target_dir),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}/index.html"
    PREVIEW_SERVERS[key] = {"proc": proc, "port": port, "url": url}
    return url


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/" or path == "/kit":
            if not HTML_PATH.exists():
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"No se encontro el HTML interactivo")
                return
            data = HTML_PATH.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if path == "/health":
            return json_response(self, 200, {"ok": True, "service": "kit-replicable-server"})

        if path == "/api/giros":
            return json_response(self, 200, {"ok": True, "giros": list_giros()})

        return json_response(self, 404, {"ok": False, "error": "Ruta no encontrada"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/preview":
            try:
                payload = self._read_json()
            except Exception:
                return json_response(self, 400, {"ok": False, "error": "JSON invalido"})

            target = str(payload.get("target", "")).strip()
            if not target:
                return json_response(self, 400, {"ok": False, "error": "Falta target"})
            target_path = Path(target)
            if not target_path.is_dir():
                return json_response(self, 400, {"ok": False, "error": "Target no existe o no es carpeta"})

            try:
                url = start_preview_server(target_path)
                return json_response(self, 200, {"ok": True, "url": url, "target": str(target_path)})
            except Exception as e:
                return json_response(self, 500, {"ok": False, "error": f"No se pudo iniciar preview: {e}"})

        if path == "/api/open-target":
            try:
                payload = self._read_json()
            except Exception:
                return json_response(self, 400, {"ok": False, "error": "JSON invalido"})

            target = str(payload.get("target", "")).strip()
            if not target:
                return json_response(self, 400, {"ok": False, "error": "Falta target"})
            target_path = Path(target)
            if not target_path.exists():
                return json_response(self, 400, {"ok": False, "error": "Target no existe"})
            try:
                subprocess.run(["open", str(target_path)], check=True)
                return json_response(self, 200, {"ok": True, "target": str(target_path)})
            except Exception as e:
                return json_response(self, 500, {"ok": False, "error": f"No se pudo abrir la carpeta: {e}"})

        if path != "/api/clone":
            return json_response(self, 404, {"ok": False, "error": "Ruta no encontrada"})

        try:
            payload = self._read_json()
        except Exception:
            return json_response(self, 400, {"ok": False, "error": "JSON invalido"})

        brand = str(payload.get("brand", "")).strip()
        city = str(payload.get("city", "")).strip()
        whatsapp = str(payload.get("whatsapp", "")).strip()
        backend_url = str(payload.get("backend_url", "")).strip()
        maps_url = str(payload.get("maps_url", "")).strip()
        color_primary = str(payload.get("color_primary", "#1F7EDC")).strip() or "#1F7EDC"
        color_accent = str(payload.get("color_accent", "#FF6A2A")).strip() or "#FF6A2A"
        source = str(payload.get("source", "")).strip() or "auto"
        target = str(payload.get("target", "")).strip()
        modules = payload.get("modules", {}) or {}
        vertical = str(payload.get("vertical", "tecnico")).strip() or "tecnico"
        giro_id = str(payload.get("giro_id", "")).strip()
        onboarding_status = str(payload.get("onboarding_status", "nuevo")).strip().lower() or "nuevo"
        status_dir = STATUS_DIR_MAP.get(onboarding_status, "nuevo")

        # Nuevo flujo: si viene giro numerado, usar su carpeta como source y derivar perfil vertical.
        giro_match = re.match(r"^(\d{2})_(.+)$", giro_id)
        if giro_match:
            giro_slug = giro_match.group(2)
            giro_source = PLANTILLAS_DIR / giro_id
            if giro_source.is_dir() and (source == "auto" or source == ""):
                source = str(giro_source)
            vertical = infer_vertical_profile(giro_slug)
        else:
            # Compatibilidad: si el cliente manda "vertical" con formato de giro.
            legacy_match = re.match(r"^(\d{2})_(.+)$", vertical)
            if legacy_match:
                giro_slug = legacy_match.group(2)
                giro_source = PLANTILLAS_DIR / vertical
                if giro_source.is_dir() and (source == "auto" or source == ""):
                    source = str(giro_source)
                vertical = infer_vertical_profile(giro_slug)

        required = {
            "brand": brand,
            "city": city,
            "whatsapp": whatsapp,
            "backend_url": backend_url,
            "maps_url": maps_url,
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            return json_response(self, 400, {"ok": False, "error": f"Faltan campos: {', '.join(missing)}"})

        if not target:
            NEGOCIOS_DIR.mkdir(parents=True, exist_ok=True)
            status_path = NEGOCIOS_DIR / status_dir
            status_path.mkdir(parents=True, exist_ok=True)
            target = str(status_path / f"{slugify(brand)}-sdmx")

        cmd = [
            str(CLONE_SCRIPT),
            "--source",
            source,
            "--target",
            target,
            "--brand",
            brand,
            "--city",
            city,
            "--whatsapp",
            whatsapp,
            "--backend-url",
            backend_url,
            "--maps-url",
            maps_url,
            "--vertical",
            vertical,
            "--color-primary",
            color_primary,
            "--color-accent",
            color_accent,
        ]

        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            return json_response(
                self,
                500,
                {
                    "ok": False,
                    "error": "Falló la clonación",
                    "stdout": e.stdout,
                    "stderr": e.stderr,
                    "target": target,
                },
            )

        target_path = Path(target)
        target_path.mkdir(parents=True, exist_ok=True)

        # New robust path: single logo upload in jpg/jpeg/png/webp.
        logo_mime, logo_data = decode_data_url(payload.get("logo_data_url"))
        logo_png_mime, logo_png_data = decode_data_url(payload.get("logo_png_data_url"))
        logo_webp_mime, logo_webp_data = decode_data_url(payload.get("logo_webp_data_url"))
        logo_status = {"png": False, "webp": False}

        if logo_data:
            logo_status = write_logo_variants(target_path, logo_mime, logo_data)
        else:
            # Backward compatibility with legacy two-input mode.
            if logo_png_data:
                st = write_logo_variants(target_path, logo_png_mime or "image/png", logo_png_data)
                logo_status["png"] = logo_status["png"] or st["png"]
                logo_status["webp"] = logo_status["webp"] or st["webp"]
            if logo_webp_data:
                st = write_logo_variants(target_path, logo_webp_mime or "image/webp", logo_webp_data)
                logo_status["png"] = logo_status["png"] or st["png"]
                logo_status["webp"] = logo_status["webp"] or st["webp"]

        activation_payload = {
            "brand": brand,
            "city": city,
            "whatsapp": whatsapp,
            "backend_url": backend_url,
            "maps_url": maps_url,
            "password_operativo": str(payload.get("password_operativo", "")).strip(),
            "password_tecnico": str(payload.get("password_tecnico", "")).strip(),
            "color_primary": color_primary,
            "color_accent": color_accent,
            "modules": modules,
            "vertical": vertical,
            "giro_id": giro_id,
            "onboarding_status": onboarding_status,
            "created_at": datetime.now().isoformat(),
        }

        (target_path / "sdmx-alta-cliente.json").write_text(
            json.dumps(activation_payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        return json_response(
            self,
            200,
            {
                "ok": True,
                "target": target,
                "message": "Cliente clonado correctamente",
                "stdout": proc.stdout,
                "modules": modules,
                "vertical": vertical,
                "giro_id": giro_id,
                "onboarding_status": onboarding_status,
                "color_primary": color_primary,
                "color_accent": color_accent,
                "logo_status": logo_status,
            },
        )


def main():
    port = int(os.environ.get("KIT_UI_PORT", "8787"))
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"KIT UI activo en http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
