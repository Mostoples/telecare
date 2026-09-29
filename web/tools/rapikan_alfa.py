"""
Merapikan kanal alfa render Blender (ikon & ilustrasi 3D).

Penangkap bayangan Cycles meninggalkan kabut alfa sangat tipis (1–12 dari 255)
di hampir seperempat gambar. Di latar putih tidak terlihat, tetapi di atas kartu
berwarna muncul sebagai kotak kusam. Skrip ini mengurangi alfa secara halus:

    a' = 0 bila a <= AMBANG, selain itu a apa adanya

Ambang 12/255 (± 5%) terlalu rendah untuk terlihat sebagai tepi keras, dan
karena nilai lain tidak diubah, menjalankannya berulang kali aman (idempoten). Juga memangkas margin transparan agar ukuran berkas kecil.

    python tools/rapikan_alfa.py assets/3d/ikon assets/3d/ilustrasi
    python tools/rapikan_alfa.py --bayangan assets/3d/ilustrasi/*.webp   (sekali, setelah render)
"""
import glob
import os
import sys

from PIL import Image

AMBANG = 12


def sudah_rapi(a):
    """Idempoten: berkas yang kabut tipisnya sudah hilang dilewati.

    Rumus di bawah menggeser SELURUH kurva alfa; menjalankannya dua kali pada
    berkas yang sama menggerus bayangan dan tepi objek sedikit demi sedikit.
    """
    h = a.histogram()
    return sum(h[1:AMBANG + 1]) == 0


def rapikan(path):
    im = Image.open(path).convert("RGBA")
    r, g, b, a = im.split()
    if sudah_rapi(a):
        return None
    # Ambang keras, bukan geser kurva: nilai di atas AMBANG dibiarkan apa adanya,
    # jadi menjalankan ulang tidak mengubah apa pun (idempoten). Rumus geser
    # sebelumnya memetakan 13..24 ke 1..12 sehingga kabut "muncul lagi" dan tepi
    # tergerus setiap putaran.
    a = a.point(lambda v: 0 if v <= AMBANG else v)
    im = Image.merge("RGBA", (r, g, b, a))
    kotak = a.getbbox()
    if kotak:
        pad = 12
        x0, y0, x1, y1 = kotak
        w, h = im.size
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    im.save(path, "WEBP", quality=90, method=6)
    return im.size


def lembutkan_bayangan(path, faktor=0.55):
    """Bayangan penangkap (RGB hitam, alfa sebagian) dikurangi agar tidak jadi
    noda abu-abu di halaman putih. Jalankan SEKALI tepat setelah render."""
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 250 and max(r, g, b) < 14:
                px[x, y] = (r, g, b, int(a * faktor))
    im.save(path, "WEBP", quality=90, method=6)


def main():
    if sys.argv[1:2] == ["--bayangan"]:
        for f in sys.argv[2:]:
            lembutkan_bayangan(f)
            print("bayangan dilembutkan:", f)
        return
    folder = sys.argv[1:] or ["assets/3d/ikon", "assets/3d/ilustrasi"]
    n = 0
    for d in folder:
        for f in sorted(glob.glob(os.path.join(d, "*.webp"))):
            ukuran = rapikan(f)
            if ukuran is None:
                continue
            n += 1
            print("%-48s %dx%d" % (f, ukuran[0], ukuran[1]))
    print("dirapikan: %d berkas" % n)


if __name__ == "__main__":
    main()
