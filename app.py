#!/usr/bin/env python3
"""
PRESUNEXO — servidor de producción (Flask).

Sirve la app estática y expone /api/proyectos para guardar los proyectos de
cada usuario POR CUENTA, como JSON, en un bucket privado de Supabase.

La identidad llega desde el campus Constructor IA en un token firmado (HMAC):
la web abre PRESUNEXO con ?t=<token>; aquí se verifica la firma y el
vencimiento, y el `sub` del token es la clave de almacenamiento del usuario.

Variables de entorno (en Render):
  PRESUNEXO_SECRET              secreto compartido con el campus (firma del token)
  SUPABASE_URL                  https://<proj>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY     service key (solo servidor)
  PRESUNEXO_BUCKET              opcional, por defecto "presunexo"
"""
import base64
import hashlib
import hmac
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory, Response

BASE = Path(__file__).resolve().parent
SECRET = os.environ.get("PRESUNEXO_SECRET", "")
SUPA_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPA_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = os.environ.get("PRESUNEXO_BUCKET", "presunexo")

app = Flask(__name__, static_folder=None)
app.config["JSON_AS_ASCII"] = False


# ── Token firmado (HMAC-SHA256) ─────────────────────────────────────────────
def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def verificar_token(token: str):
    """Devuelve el payload dict si el token es válido y no venció; si no, None."""
    if not token or not SECRET or token.count(".") != 1:
        return None
    p_b64, sig_b64 = token.split(".", 1)
    esperado = hmac.new(SECRET.encode(), p_b64.encode(), hashlib.sha256).digest()
    try:
        recibido = _b64url_decode(sig_b64)
    except Exception:
        return None
    if not hmac.compare_digest(esperado, recibido):
        return None
    try:
        payload = json.loads(_b64url_decode(p_b64))
    except Exception:
        return None
    if not isinstance(payload, dict) or not payload.get("sub"):
        return None
    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and time.time() > exp:
        return None
    return payload


def _usuario_de_request():
    token = request.headers.get("X-Token") or request.args.get("t") or ""
    payload = verificar_token(token)
    if not payload:
        return None
    # Clave de almacenamiento: slug estable, saneado para nombre de objeto.
    sub = str(payload["sub"]).strip().lower()
    sub = "".join(c if (c.isalnum() or c in "-_.@") else "-" for c in sub)
    return sub or None


# ── Supabase Storage (JSON por usuario) ─────────────────────────────────────
def _supa(ruta: str, metodo="GET", cuerpo=None):
    url = f"{SUPA_URL}/storage/v1/object/{ruta}"
    headers = {
        "apikey": SUPA_KEY,
        "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type": "application/json",
    }
    if metodo == "POST":
        headers["x-upsert"] = "true"
    req = urllib.request.Request(url, data=cuerpo, headers=headers, method=metodo)
    return urllib.request.urlopen(req, timeout=15)


def leer_estado(sub: str):
    try:
        with _supa(f"{BUCKET}/{sub}.json") as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (400, 404):
            return None
        raise
    except Exception:
        return None


def guardar_estado(sub: str, estado) -> bool:
    cuerpo = json.dumps(estado, ensure_ascii=False).encode("utf-8")
    try:
        with _supa(f"{BUCKET}/{sub}.json", "POST", cuerpo) as r:
            return 200 <= r.status < 300
    except Exception:
        return False


# ── API ─────────────────────────────────────────────────────────────────────
@app.route("/api/salud")
def salud():
    return jsonify(ok=True, nube=bool(SUPA_URL and SUPA_KEY and SECRET))


@app.route("/api/proyectos", methods=["GET"])
def get_proyectos():
    sub = _usuario_de_request()
    if not sub:
        return jsonify(error="token_invalido"), 401
    return jsonify(estado=leer_estado(sub))


@app.route("/api/proyectos", methods=["PUT"])
def put_proyectos():
    sub = _usuario_de_request()
    if not sub:
        return jsonify(error="token_invalido"), 401
    try:
        datos = request.get_json(force=True)
    except Exception:
        return jsonify(error="cuerpo_invalido"), 400
    estado = datos.get("estado") if isinstance(datos, dict) else None
    if not isinstance(estado, dict) or not isinstance(estado.get("proyectos"), list):
        return jsonify(error="estado_invalido"), 400
    if not guardar_estado(sub, estado):
        return jsonify(error="no_se_pudo_guardar"), 502
    return jsonify(ok=True)


# ── Estáticos (la app) ───────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(BASE, "index.html")


@app.route("/<path:ruta>")
def estaticos(ruta: str):
    if ruta.startswith("api/"):
        return Response("no encontrado", status=404)
    destino = (BASE / ruta).resolve()
    if not str(destino).startswith(str(BASE)) or not destino.is_file():
        return Response("no encontrado", status=404)
    return send_from_directory(BASE, ruta)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 8765)), debug=True)
