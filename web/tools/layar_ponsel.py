"""
Menyusun urutan tekstur layar ponsel Android untuk showreel aplikasi.

    python tools/layar_ponsel.py

Masukan : build/shots/ponsel/*.png (430x932) dan build/shots/panjang/*.png (430xH)
Keluaran: build/video/layar/<urutan>/0000.png ... (430x960, rasio ±20:9)

Setiap frame = status bar Android (jam, sinyal, Wi-Fi, baterai) + isi aplikasi,
sudut membulat (hitam, menyatu dengan bezel). Urutan bisa berisi:
  - gulir  : tangkapan panjang digulir dengan easing, dock bawah tetap diam
  - ketuk  : riak lingkaran di titik ketukan
  - silang : transisi silang ke layar berikutnya
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PON = os.path.join(AKAR, "build", "shots", "ponsel")
PAN = os.path.join(AKAR, "build", "shots", "panjang")
OUT = os.path.join(AKAR, "build", "video", "layar")
FONT = os.path.join(AKAR, "build", "fonts", "PlusJakartaSans.ttf")
W, H, SB = 430, 932, 30          # lebar, tinggi isi, tinggi status bar
LATAR = (233, 239, 243)
INK = (21, 42, 46)
HIJAU = (11, 154, 98)
DOCK_Y = 820                     # dock + FAB mulai kira-kira di sini pada tangkapan 932


def f(n, bobot="SemiBold"):
    x = ImageFont.truetype(FONT, n)
    x.set_variation_by_name(bobot)
    return x


def ponsel(pot):
    for n in sorted(os.listdir(PON)):
        if pot in n:
            return Image.open(os.path.join(PON, n)).convert("RGB")
    raise SystemExit("tangkapan ponsel tidak ada: " + pot)


def panjang(nama):
    return Image.open(os.path.join(PAN, nama + ".png")).convert("RGB")


def status_bar(img):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, SB], fill=LATAR)
    d.text((24, 7), "09.41", font=f(14, "Bold"), fill=INK)
    x = W - 26
    # baterai
    d.rounded_rectangle([x - 22, 10, x, 21], 3, outline=INK, width=2)
    d.rectangle([x - 19, 13, x - 6, 18], fill=INK)
    d.rectangle([x + 1, 13, x + 3, 18], fill=INK)
    # wi-fi (tiga busur)
    cx, cy = x - 36, 22
    for r in (4, 8, 12):
        d.arc([cx - r, cy - r, cx + r, cy + r], 225, 315, fill=INK, width=2)
    # sinyal
    for k in range(4):
        h = 4 + k * 3
        d.rectangle([x - 68 + k * 5, 21 - h, x - 65 + k * 5, 21], fill=INK)


def sudut(img, r=38):
    topeng = Image.new("L", img.size, 0)
    ImageDraw.Draw(topeng).rounded_rectangle([0, 0, img.width - 1, img.height - 1], r, fill=255)
    hitam = Image.new("RGB", img.size, (0, 0, 0))
    return Image.composite(img, hitam, topeng)


def bingkai(isi):
    """isi 430x932 → tekstur 430x962 lengkap status bar & sudut membulat."""
    img = Image.new("RGB", (W, H + SB), LATAR)
    img.paste(isi, (0, SB))
    status_bar(img)
    return sudut(img)


def mulus(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def gulir(tall, dock_dari, n, mulai=0.15, akhir=0.85, jarak=None):
    """Frame gulir: potongan tall[y:y+932], dock (bawah) dari tangkapan diam."""
    maks = tall.height - H
    jarak = maks if jarak is None else min(jarak, maks)
    dock = dock_dari.crop((0, DOCK_Y, W, H))
    out = []
    for i in range(n):
        y = round(jarak * mulus((i / max(1, n - 1) - mulai) / (akhir - mulai)))
        isi = tall.crop((0, y, W, y + H)).copy()
        isi.paste(dock, (0, DOCK_Y))
        out.append(isi)
    return out


def riak(isi, x, y, u):
    """Riak ketukan (u 0..1) di titik (x, y) pada isi 430x932."""
    img = isi.convert("RGBA")
    lap = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lap)
    r = 14 + 46 * u
    a = int(120 * (1 - u))
    d.ellipse([x - r, y - r, x + r, y + r], fill=(11, 154, 98, a // 2), outline=(11, 154, 98, a), width=3)
    if u < 0.5:
        d.ellipse([x - 13, y - 13, x + 13, y + 13], fill=(255, 255, 255, 170))
    img.alpha_composite(lap)
    return img.convert("RGB")


def simpan(nama, frames):
    folder = os.path.join(OUT, nama)
    os.makedirs(folder, exist_ok=True)
    for i, fr in enumerate(frames):
        bingkai(fr).save(os.path.join(folder, "%04d.png" % i))
    print("%-12s %d frame" % (nama, len(frames)))


def main():
    home = ponsel("pasien-home")
    # 1 buka: onboarding
    simpan("buka", [panjang("onboarding")])
    # 2 beranda: gulir pelan ke bawah lalu sedikit kembali
    fr = gulir(panjang("beranda"), home, 144, 0.12, 0.8, 1150)
    simpan("beranda", fr)
    # 3 vital: ketuk kartu detak jantung → silang ke layar detail
    hr = ponsel("pasien-vital-hr")
    fr = []
    for i in range(108):
        d = i / 24.0
        if d < 1.2:
            fr.append(home)
        elif d < 1.75:
            fr.append(riak(home, 110, 420, (d - 1.2) / 0.55))
        elif d < 2.15:
            fr.append(Image.blend(home, hr, mulus((d - 1.75) / 0.4)))
        else:
            fr.append(hr)
    simpan("vital", fr)
    # 4 konsultasi (gulir daftar dokter) + chat
    # dock dari tangkapan yang dock-nya terbaca (tangkapan headless kadang kehilangan dock)
    kons = Image.open(os.path.join(PAN, "kons-dock.png")).convert("RGB").crop((0, 0, W, H))
    simpan("konsultasi", gulir(panjang("konsultasi"), kons, 120, 0.2, 0.85, 700))
    simpan("chat", [panjang("chat")])
    # 5 panggilan video
    simpan("panggilan", [ponsel("pasien-call")])
    # 6 perangkat: gulir ke daftar perangkat yang didukung
    per = ponsel("pasien-profil")        # Perangkat dibuka dari Profil → tab Profil aktif
    simpan("perangkat", gulir(panjang("perangkat"), per, 108, 0.25, 0.85, 520))
    # 7 empat peran
    simpan("p-pasien", [home])
    simpan("p-dokter", [ponsel("dokter-klinik")])
    simpan("p-faskes", [ponsel("faskes-home")])
    simpan("p-admin", [ponsel("admin-sistem")])
    # 8 masuk (untuk penutup)
    simpan("masuk", [panjang("masuk")])


if __name__ == "__main__":
    main()
