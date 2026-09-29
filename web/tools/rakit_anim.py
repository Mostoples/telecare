"""
Merakit frame PNG hasil render Blender menjadi WebP animasi transparan.

    python tools/rakit_anim.py build/anim-ikon assets/3d/ikon-anim [--ms 80] [--mutu 78]
    python tools/rakit_anim.py build/video/frames assets/3d/dekor --satu dekor --sisi 520
    python tools/rakit_anim.py build/video/frames assets/3d/dekor --satu pola --sisi 480 --utuh

Setiap subfolder (satu ikon) → <keluaran>/<nama>.webp. Kabut alfa tipis dari
penangkap bayangan dibuang (ambang keras, sama seperti rapikan_alfa.py) dan
semua frame dipotong dengan kotak GABUNGAN supaya objek tidak "melompat".
"""
import glob
import os
import sys

from PIL import Image

AMBANG = 12
SISI = 160


def bersihkan(im):
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v <= AMBANG else v)
    return Image.merge("RGBA", (r, g, b, a))


def rakit(folder, keluar, ms, mutu, potong=True):
    fs = sorted(glob.glob(os.path.join(folder, "*.png")))
    if not fs:
        return None
    frames = [bersihkan(Image.open(f).convert("RGBA")) for f in fs]
    kotak = None
    for fr in frames:
        b = fr.getchannel("A").getbbox()
        if b:
            kotak = b if kotak is None else (min(kotak[0], b[0]), min(kotak[1], b[1]),
                                             max(kotak[2], b[2]), max(kotak[3], b[3]))
    if kotak and potong:
        w, h = frames[0].size
        pad = 6
        # kotak persegi agar ukuran tampil konsisten dengan ikon diam
        x0, y0, x1, y1 = kotak
        sisi = max(x1 - x0, y1 - y0) + 2 * pad
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        x0, y0 = max(0, cx - sisi // 2), max(0, cy - sisi // 2)
        x1, y1 = min(w, x0 + sisi), min(h, y0 + sisi)
        frames = [fr.crop((x0, y0, x1, y1)) for fr in frames]
    if frames[0].width > SISI:
        frames = [fr.resize((SISI, round(fr.height * SISI / fr.width)), Image.LANCZOS) for fr in frames]
    frames[0].save(keluar, "WEBP", save_all=True, append_images=frames[1:], duration=ms,
                   loop=0, quality=mutu, method=6, lossless=False, minimize_size=True)
    return os.path.getsize(keluar)


def main():
    a = sys.argv[1:]
    global SISI
    ms = int(a[a.index("--ms") + 1]) if "--ms" in a else 80
    SISI = int(a[a.index("--sisi") + 1]) if "--sisi" in a else SISI
    potong = "--utuh" not in a
    satu = a[a.index("--satu") + 1] if "--satu" in a else None
    mutu = int(a[a.index("--mutu") + 1]) if "--mutu" in a else 78
    src, dst = a[0], a[1]
    os.makedirs(dst, exist_ok=True)
    total = 0
    for d in sorted(glob.glob(os.path.join(src, "*"))):
        if not os.path.isdir(d) or (satu and os.path.basename(d) != satu):
            continue
        nama = os.path.basename(d)
        n = rakit(d, os.path.join(dst, nama + ".webp"), ms, mutu, potong)
        if n:
            total += n
            print("%-14s %6.1f KB" % (nama, n / 1024))
    print("total %.1f MB" % (total / 1048576))


if __name__ == "__main__":
    main()
