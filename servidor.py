#!/usr/bin/env python3
"""Servidor local de PRESUNEXO sin caché (los cambios siempre cargan frescos)."""
import http.server
import os

PUERTO = 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # silencioso

if __name__ == '__main__':
    print(f'PRESUNEXO en http://localhost:{PUERTO}  (Ctrl+C para detener)')
    http.server.ThreadingHTTPServer(('127.0.0.1', PUERTO), SinCache).serve_forever()
