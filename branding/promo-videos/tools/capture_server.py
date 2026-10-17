"""Tanıtım videosu kareleri için yerel alma sunucusu (yalnız 127.0.0.1).

Tarayıcıdaki yakalama betiği her kareyi PNG olarak POST eder:
  POST /put?path=<göreli/yol.png>   gövde: ham dosya baytları
  GET  /get?path=<göreli/yol>       kök altındaki bir dosyayı döner (ses betiği olayları okur)
Dosyalar komut satırında verilen kök klasörün altına yazılır.
Kullanım: python3 capture_server.py <kök_klasör> [port]
"""
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.abspath(sys.argv[1])
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _target(self):
        query = parse_qs(urlparse(self.path).query)
        rel = query.get("path", [""])[0]
        target = os.path.abspath(os.path.join(ROOT, rel))
        if not rel or not target.startswith(ROOT + os.sep):
            return None
        return target

    def do_GET(self):
        target = self._target()
        if not target or not os.path.isfile(target):
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        with open(target, "rb") as fh:
            data = fh.read()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        target = self._target()
        if not target:
            self.send_response(400)
            self._cors()
            self.end_headers()
            return
        os.makedirs(os.path.dirname(target), exist_ok=True)
        length = int(self.headers.get("Content-Length", 0))
        with open(target, "wb") as fh:
            fh.write(self.rfile.read(length))
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
