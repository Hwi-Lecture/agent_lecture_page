"""로컬 미리보기와 Markdown 저장 서버. 외부 네트워크에는 공개하지 않는다."""
import argparse
import base64
import binascii
import json
import os
from pathlib import Path
import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import webbrowser
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
MAX_BODY = 2 * 1024 * 1024
CONTENT_PATH = re.compile(r"content/(u[0-9]{2,})/(post|slides)\.md\Z")
SAVE_LOCK = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path == "/api/status":
            return self.reply(200, {"editable": True})
        return super().do_GET()

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path not in ("/api/save", "/api/upload"):
            return self.reply(404, {"error": "Not found"})
        host = self.headers.get("Host", "")
        allowed = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        if host not in allowed or self.headers.get("Origin") != f"http://{host}":
            return self.reply(403, {"error": "Invalid origin"})
        if self.headers.get_content_type() != "application/json":
            return self.reply(415, {"error": "Expected JSON"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            limit = 14 * 1024 * 1024 if self.path == "/api/upload" else MAX_BODY
            if not 0 < size <= limit:
                return self.reply(413, {"error": "Invalid body size"})
            data = json.loads(self.rfile.read(size).decode("utf-8"))
            if self.path == "/api/upload":
                return self.upload(data)
            path, content, original = data["path"], data["content"], data["original"]
            if not isinstance(path, str) or not CONTENT_PATH.fullmatch(path) or not isinstance(content, str) or not isinstance(original, str):
                raise ValueError("Invalid content path or content")
            target = (ROOT / path).resolve()
            if not target.is_relative_to((ROOT / "content").resolve()) or not target.is_file():
                raise ValueError("Content file does not exist")
            # 같은 디렉터리에 임시 파일을 쓰고 교체해 불완전한 저장을 피한다.
            import tempfile
            with SAVE_LOCK:
                # 브라우저 fetch().text()는 BOM을 제거하므로 비교도 BOM 없이 한다 (메모장 BOM 저장 대비)
                if target.read_bytes().decode("utf-8-sig") != original:
                    return self.reply(409, {"error": "File changed on disk"})
                name = None
                try:
                    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="", dir=target.parent, delete=False) as temp:
                        name = temp.name
                        temp.write(content)
                    os.replace(name, target)
                finally:
                    if name and os.path.exists(name):
                        os.unlink(name)
            self.reply(200, {"ok": True})
        except (ValueError, KeyError, TypeError, UnicodeError, json.JSONDecodeError):
            self.reply(400, {"error": "Invalid request"})
        except OSError:
            self.reply(500, {"error": "Save failed"})

    def upload(self, data):
        unit, name, encoded = data["unit"], data["name"], data["data"]
        if not isinstance(unit, str) or not re.fullmatch(r"u[0-9]{2,}", unit) or not isinstance(name, str) or not isinstance(encoded, str):
            raise ValueError("Invalid upload")
        extension = Path(name).suffix.lower()
        if extension not in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
            raise ValueError("Invalid extension")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("Invalid encoding")
        if not raw or len(raw) > 10 * 1024 * 1024:
            raise ValueError("Invalid file size")
        signatures = {".png": raw.startswith(b"\x89PNG\r\n\x1a\n"), ".jpg": raw.startswith(b"\xff\xd8\xff"), ".jpeg": raw.startswith(b"\xff\xd8\xff"), ".gif": raw.startswith((b"GIF87a", b"GIF89a")), ".webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"}
        if extension == ".svg":
            # SVG는 HTML과 같은 출처에서 열릴 수 있으므로 능동 콘텐츠를 거부한다.
            if re.search(rb"<!\s*(?:DOCTYPE|ENTITY)", raw, re.I) or re.search(rb"<\?(?!xml(?:\s|\?))", raw, re.I):
                raise ValueError("Unsafe SVG")
            try:
                root = ET.fromstring(raw)
            except ET.ParseError:
                raise ValueError("Invalid SVG")
            if root.tag.split("}")[-1] != "svg":
                raise ValueError("Invalid SVG")
            for node in root.iter():
                if node.tag.split("}")[-1].lower() in ("script", "foreignobject", "style", "iframe", "object", "embed", "animate", "set", "animatetransform", "animatemotion"):
                    raise ValueError("Unsafe SVG")
                for key, value in node.attrib.items():
                    attr = key.split("}")[-1].lower()
                    if attr.startswith("on") or attr == "style" or (attr in ("href", "src") and not value.startswith("#")) or re.search(r"url\s*\(", value, re.I):
                        raise ValueError("Unsafe SVG")
        elif not signatures[extension]:
            raise ValueError("Image does not match extension")
        unit_dir = (ROOT / "content" / unit).resolve()
        if not unit_dir.is_relative_to((ROOT / "content").resolve()) or not unit_dir.is_dir():
            raise ValueError("Unit does not exist")
        image_dir = unit_dir / "img"
        image_dir.mkdir(exist_ok=True)
        if not image_dir.resolve().is_relative_to(unit_dir):
            raise ValueError("Invalid image directory")
        stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(name).stem).strip("-_")[:80] or "image"
        with SAVE_LOCK:
            n = 1
            while True:
                filename = f"{stem}{'-' + str(n) if n > 1 else ''}{extension}"
                try:
                    with (image_dir / filename).open("xb") as output:
                        output.write(raw)
                    break
                except FileExistsError:
                    n += 1
        return self.reply(200, {"ok": True, "src": f"img/{filename}"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"LecturePage: {url} (Ctrl+C to stop)", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
