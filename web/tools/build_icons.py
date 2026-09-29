#!/usr/bin/env python3
"""Membangun ikon PWA TeleCare.

Bentuknya sengaja sama dengan favicon SVG di app/index.html: kotak bersudut
tumpul berwarna hijau Kemenkes dengan garis EKG putih. Dibangun lewat skrip
supaya dapat direproduksi, mengikuti pola blender/build_assets.py.

Pemakaian:
    python tools/build_icons.py
"""
from __future__ import annotations

import argparse
import os

from PIL import Image, ImageDraw

GREEN = (4, 154, 91, 255)
WHITE = (255, 255, 255, 255)

# Garis EKG pada kanvas 32x32, disalin dari favicon di app/index.html:
# M5 17 h5 l2.4-6 l3.6 12 l2.8-8 l1.8 2 H27
ECG = [(5, 17), (10, 17), (12.4, 11), (16, 23), (18.8, 15), (20.6, 17), (27, 17)]
BASE = 32
RADIUS = 9          # sudut tumpul pada kanvas 32
STROKE = 2.4        # ketebalan garis pada kanvas 32

# Digambar pada kelipatan ini lalu diperkecil, supaya tepinya halus.
SS = 4


def draw_icon(size: int, *, maskable: bool = False) -> Image.Image:
    """Menggambar satu ikon.

    maskable=True menghasilkan latar penuh tanpa sudut tumpul dan isi yang
    diperkecil, agar tetap utuh ketika peluncur memotongnya jadi bentuk lain
    (zona aman Android: 80% bagian tengah).
    """
    w = size * SS
    img = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        d.rectangle([0, 0, w, w], fill=GREEN)
        content = 0.62          # isi menempati 62% agar aman saat dipotong
    else:
        r = RADIUS / BASE * w
        d.rounded_rectangle([0, 0, w - 1, w - 1], radius=r, fill=GREEN)
        content = 1.0

    # Memetakan kanvas 32x32 ke area isi yang sudah diskalakan dan dipusatkan.
    span = w * content
    off = (w - span) / 2
    scale = span / BASE
    pts = [(off + x * scale, off + y * scale) for x, y in ECG]
    width = max(1, round(STROKE * scale))

    d.line(pts, fill=WHITE, width=width, joint='curve')
    # PIL tidak punya ujung membulat, jadi ujung garis ditambal manual.
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join('app', 'assets', 'icons'),
                    help='folder keluaran')
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    jobs = [
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('icon-maskable-192.png', 192, True),
        ('icon-maskable-512.png', 512, True),
        ('apple-touch-icon.png', 180, False),
    ]
    for name, size, maskable in jobs:
        path = os.path.join(args.out, name)
        draw_icon(size, maskable=maskable).save(path, 'PNG', optimize=True)
        print(f'  {path}  ({size}x{size}{", maskable" if maskable else ""})'
              f'  {os.path.getsize(path):,} byte')

    print(f'\n{len(jobs)} ikon dibangun di {args.out}')


if __name__ == '__main__':
    main()
