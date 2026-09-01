#!/usr/bin/env python3
"""
actualizar_indices.py — actualiza los Índices Unificados INEI de PRESUNEXO.

INEI publica cada mes (a mediados del mes siguiente) una Resolución Jefatural
en El Peruano con la tabla de índices para las 13 áreas geográficas. Este
script descarga esa página, extrae la columna del área indicada y genera un
JSON que se importa en la app (Fórmula polinómica → Índices INEI → Importar).

Uso:
  python actualizar_indices.py --mes 2026-07 --url https://busquedas.elperuano.pe/dispositivo/NL/XXXXXXX-1
  python actualizar_indices.py --mes 2026-07 --archivo tabla_pegada.txt   (texto copiado de la tabla)
  Opcional: --area 4 (defecto: 4 = Lima y Callao) · --salida indices_2026-07.json

Cómo encontrar la URL: busca en https://busquedas.elperuano.pe
"indices unificados <mes> 2026" y copia el enlace del dispositivo (NL/…).
"""
import argparse
import json
import re
import sys
import urllib.request

def descargar(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (PRESUNEXO actualizador)'})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode('utf-8', errors='replace')

def limpiar_html(html: str) -> str:
    html = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html, flags=re.S | re.I)
    html = re.sub(r'<[^>]+>', ' ', html)
    html = html.replace('&nbsp;', ' ')
    return html

def parsear(texto: str, area: int) -> dict:
    """Busca filas 'CODIGO v1 v2 ... v13' y devuelve {codigo: valor_del_area}."""
    valores = {}
    # número tipo 109,29 / 109.29 / 1,234.56
    num = r'\d{1,3}(?:[.,]\d{3})*[.,]\d{2}'
    patron = re.compile(rf'\b(\d{{2}}(?:-1)?)\s+((?:{num}\s+){{12}}{num})\b')
    for m in patron.finditer(texto):
        codigo = m.group(1)
        cols = re.findall(num, m.group(2))
        if len(cols) < 13:
            continue
        v = cols[area - 1].replace('.', '').replace(',', '.') if (',' in cols[area - 1] and cols[area - 1].rindex(',') > cols[area - 1].find('.')) else cols[area - 1].replace(',', '.')
        try:
            valores[codigo] = round(float(v), 2)
        except ValueError:
            continue
    return valores

def main():
    ap = argparse.ArgumentParser(description='Actualizador de índices unificados INEI para PRESUNEXO')
    ap.add_argument('--mes', required=True, help="Mes de los índices, formato YYYY-MM (ej. 2026-07)")
    ap.add_argument('--url', help='URL del dispositivo en El Peruano (NL/…)')
    ap.add_argument('--archivo', help='Archivo de texto con la tabla copiada (alternativa a --url)')
    ap.add_argument('--area', type=int, default=4, help='Área geográfica 1-13 (defecto 4 = Lima y Callao)')
    ap.add_argument('--salida', help='Archivo JSON de salida (defecto indices_<mes>.json)')
    args = ap.parse_args()

    if not re.fullmatch(r'\d{4}-\d{2}', args.mes):
        sys.exit('El mes debe tener formato YYYY-MM, por ejemplo 2026-07')
    if not args.url and not args.archivo:
        sys.exit('Indica --url (El Peruano) o --archivo (tabla copiada). Ver --help.')

    if args.url:
        print(f'Descargando {args.url} …')
        texto = limpiar_html(descargar(args.url))
    else:
        with open(args.archivo, encoding='utf-8') as f:
            texto = f.read()

    valores = parsear(texto, args.area)
    if len(valores) < 20:
        sys.exit(f'Solo se reconocieron {len(valores)} índices — la página no parece contener la tabla '
                 f'de 13 áreas. Copia la tabla a un .txt y usa --archivo, o revisa la URL.')

    salida = args.salida or f'indices_{args.mes}.json'
    contenido = { 'mes': args.mes, 'area': args.area, 'fuente': args.url or args.archivo, 'valores': valores }
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump(contenido, f, ensure_ascii=False, indent=2)

    print(f'OK: {len(valores)} índices del área {args.area} para {args.mes} → {salida}')
    print('Impórtalo en PRESUNEXO: Fórmula polinómica → Índices INEI → Importar JSON.')

if __name__ == '__main__':
    main()
