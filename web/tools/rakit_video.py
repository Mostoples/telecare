"""
Merakit video TeleCare dari frame render Blender (build/video/frames/*)
dan tangkapan layar aplikasi (build/shots/*).

    python tools/rakit_video.py [showreel|promo|usecase|hero|semua]

Keluaran (assets/video/):
    hero-loop.mp4 / hero-loop.webm   loop 8 dtk untuk hero situs (900x900)
    telecare-showreel.mp4            ± 40 dtk, shot 3D Blender + judul
    telecare-promo.mp4               ± 45 dtk, 3D + layar aplikasi + ajakan
    telecare-usecase.mp4             ± 30 dtk, adegan sehari-hari (Sketchfab + Blender)

Judul & keterangan digambar dengan Pillow (Instrument Serif + Plus Jakarta
Sans, OFL, diunduh ke build/fonts) lalu ditumpuk oleh ffmpeg dengan fade.
Latar shot transparan dikomposit ke #EEF3F1 — warna yang sama dengan UI
neumorfik. Bantalan suara disintesis ffmpeg (tanpa aset musik berlisensi).
"""
import json
import shutil
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = os.path.join(AKAR, "build", "video", "frames")
KERJA = os.path.join(AKAR, "build", "video", "rakit")
SHOTS = os.path.join(AKAR, "build", "shots")
FONT = os.path.join(AKAR, "build", "fonts")
KELUAR = os.path.join(AKAR, "assets", "video")
FPS = 24
LATAR = "0xE9EFF3"
W, H = 1920, 1080
os.makedirs(KERJA, exist_ok=True)

# ffmpeg dari winget tidak selalu ada di PATH proses Python (mis. Python Store)
_WINGET = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages",
                       "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe", "ffmpeg-9.0-full_build", "bin")
FFMPEG = shutil.which("ffmpeg") or os.path.join(_WINGET, "ffmpeg.exe")
FFPROBE = shutil.which("ffprobe") or os.path.join(_WINGET, "ffprobe.exe")

INK = (12, 31, 26)
MUTED = (108, 132, 126)
HIJAU = (4, 154, 91)


def ff(*a):
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y"] + [str(x) for x in a]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(" ".join(cmd))
        print(r.stderr[-2000:])
        raise SystemExit("ffmpeg gagal")


def durasi(path):
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", path], capture_output=True, text=True)
    return float(r.stdout.strip())


# ------------------------------------------------------------
#  tipografi
# ------------------------------------------------------------
def f_serif(n, miring=False):
    return ImageFont.truetype(os.path.join(FONT, "InstrumentSerif-Italic.ttf" if miring else
                                           "InstrumentSerif-Regular.ttf"), n)


def f_sans(n, bobot="Regular"):
    f = ImageFont.truetype(os.path.join(FONT, "PlusJakartaSans.ttf"), n)
    f.set_variation_by_name(bobot)
    return f


def bungkus(d, teks, font, lebar):
    kata, baris, kini = teks.split(), [], ""
    for k in kata:
        uji = (kini + " " + k).strip()
        if d.textlength(uji, font=font) <= lebar:
            kini = uji
        else:
            baris.append(kini)
            kini = k
    if kini:
        baris.append(kini)
    return baris


def spasi_lebar(d, xy, teks, font, isi, jarak=3):
    x, y = xy
    for ch in teks:
        d.text((x, y), ch, font=font, fill=isi)
        x += d.textlength(ch, font=font) + jarak


def kartu(nama, eyebrow="", judul="", sub="", posisi="kiri-bawah", pil=False, lebar=820):
    """PNG RGBA 1920x1080 berisi blok teks. `pil` = latar kapsul neumorfik."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fe, fj, fs = f_sans(24, "Bold"), f_serif(96), f_sans(32)
    jb = bungkus(d, judul, fj, lebar) if judul else []
    sb = bungkus(d, sub, fs, lebar) if sub else []
    tinggi = (40 if eyebrow else 0) + len(jb) * 94 + (18 if sb else 0) + len(sb) * 44
    lebar_isi = max([d.textlength(b, font=fj) for b in jb] + [d.textlength(b, font=fs) for b in sb] +
                    [len(eyebrow) * 17])
    if posisi == "tengah":
        x0, y0 = (W - lebar_isi) / 2, (H - tinggi) / 2 - 20
    elif posisi == "kiri-atas":
        x0, y0 = 120, 110
    elif posisi == "kanan-bawah":
        x0, y0 = W - 120 - lebar_isi, H - 110 - tinggi
    else:
        x0, y0 = 120, H - 110 - tinggi
    if pil:
        pad = 44
        kotak = [x0 - pad, y0 - pad, x0 + lebar_isi + pad, y0 + tinggi + pad]
        bay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        db = ImageDraw.Draw(bay)
        db.rounded_rectangle([kotak[0] + 14, kotak[1] + 18, kotak[2] + 14, kotak[3] + 18], 44, fill=(120, 145, 136, 90))
        bay = bay.filter(ImageFilter.GaussianBlur(22))
        im.alpha_composite(bay)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle(kotak, 44, fill=(242, 246, 244, 235))
    y = y0
    if eyebrow:
        cx = x0 if posisi != "tengah" else (W - len(eyebrow) * 17) / 2
        d.ellipse([cx, y + 9, cx + 12, y + 21], fill=HIJAU)
        spasi_lebar(d, (cx + 24, y), eyebrow.upper(), fe, HIJAU, 3)
        y += 40
    for b in jb:
        x = x0 if posisi != "tengah" else (W - d.textlength(b, font=fj)) / 2
        d.text((x, y - 6), b, font=fj, fill=INK)
        y += 94
    if sb:
        y += 18
    for b in sb:
        x = x0 if posisi != "tengah" else (W - d.textlength(b, font=fs)) / 2
        d.text((x, y), b, font=fs, fill=MUTED)
        y += 44
    p = os.path.join(KERJA, "kartu-" + nama + ".png")
    im.save(p)
    return p


# ------------------------------------------------------------
#  klip
# ------------------------------------------------------------
def klip_render(shot, keluar, transparan=True, ukuran=(W, H)):
    """Frame PNG → mp4 (dikomposit ke latar bila transparan)."""
    src = os.path.join(FR, shot, "%04d.png")
    w, h = ukuran
    if transparan:
        ff("-f", "lavfi", "-i", "color=c=%s:s=%dx%d:r=%d" % (LATAR, w, h, FPS),
           "-framerate", FPS, "-i", src,
           "-filter_complex", "[1:v]scale=%d:%d:flags=lanczos,format=rgba[f];[0:v][f]overlay=shortest=1,format=yuv420p" % (w, h),
           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-r", FPS, keluar)
    else:
        ff("-framerate", FPS, "-i", src, "-vf", "scale=%d:%d:flags=lanczos,format=yuv420p" % (w, h),
           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-r", FPS, keluar)
    return keluar


def beri_kartu(klip, png, keluar, mulai=0.35, dur_fade=0.5, akhir_sebelum=0.45):
    d = durasi(klip)
    ff("-i", klip, "-loop", "1", "-t", "%.3f" % d, "-i", png,
       "-filter_complex",
       "[1:v]format=rgba,fade=t=in:st=%.2f:d=%.2f:alpha=1,fade=t=out:st=%.2f:d=%.2f:alpha=1[t];"
       "[0:v][t]overlay=0:0:shortest=1,format=yuv420p" % (mulai, dur_fade, max(0.1, d - akhir_sebelum - dur_fade), dur_fade),
       "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-r", FPS, keluar)
    return keluar


def klip_layar(png, keluar, dur=3.6, ukuran_panel=1180, perangkat="desktop"):
    """Tangkapan layar aplikasi di dalam panel neumorfik, zoom pelan."""
    bingkai = os.path.join(KERJA, "panel-" + os.path.basename(png))
    im = Image.open(png).convert("RGB")
    if perangkat == "desktop":
        im = im.resize((ukuran_panel, round(im.height * ukuran_panel / im.width)), Image.LANCZOS)
        r = 26
    else:
        tinggi = 860
        im = im.resize((round(im.width * tinggi / im.height), tinggi), Image.LANCZOS)
        r = 46
    pad = 18
    kanvas = Image.new("RGBA", (W, H), (233, 239, 243, 255))
    x0, y0 = (W - im.width) // 2, (H - im.height) // 2
    # bayangan ganda neumorfik
    for dx, dy, warna in ((22, 22, (150, 170, 162, 150)), (-22, -22, (255, 255, 255, 240))):
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(b).rounded_rectangle([x0 - pad + dx, y0 - pad + dy, x0 + im.width + pad + dx,
                                             y0 + im.height + pad + dy], r + pad, fill=warna)
        kanvas.alpha_composite(b.filter(ImageFilter.GaussianBlur(26)))
    d = ImageDraw.Draw(kanvas)
    d.rounded_rectangle([x0 - pad, y0 - pad, x0 + im.width + pad, y0 + im.height + pad], r + pad, fill=(233, 239, 243, 255))
    topeng = Image.new("L", im.size, 0)
    ImageDraw.Draw(topeng).rounded_rectangle([0, 0, im.width, im.height], r, fill=255)
    kanvas.paste(im, (x0, y0), topeng)
    kanvas.convert("RGB").save(bingkai)
    n = int(dur * FPS)
    ff("-loop", "1", "-i", bingkai, "-vf",
       "scale=3840:-1,zoompan=z='1+0.045*on/%d':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=%d:s=%dx%d:fps=%d,format=yuv420p"
       % (n, n, W, H, FPS),
       "-frames:v", n, "-c:v", "libx264", "-preset", "slow", "-crf", "17", keluar)
    return keluar


def sambung(klips, keluar, transisi=0.5, audio=True, jenis="fade"):
    """Rangkai klip dengan xfade + bantalan suara lembut."""
    ds = [durasi(k) for k in klips]
    args = []
    for k in klips:
        args += ["-i", k]
    f, prev, off = [], "[0:v]", 0.0
    for i in range(1, len(klips)):
        off += ds[i - 1] - transisi
        lab = "[v%d]" % i
        j = jenis if isinstance(jenis, str) else jenis[(i - 1) % len(jenis)]
        f.append("%s[%d:v]xfade=transition=%s:duration=%.2f:offset=%.3f%s" % (prev, i, j, transisi, off, lab))
        prev = lab
    total = sum(ds) - transisi * (len(klips) - 1)
    f.append("%sformat=yuv420p[vout]" % prev)
    if audio:
        n = len(klips)
        # akord mayor lembut (A–C#–E–A) + denyut halus ala monitor jantung
        pad = ("aevalsrc='0.035*sin(2*PI*220*t)*(0.7+0.3*sin(2*PI*0.11*t))"
               "+0.028*sin(2*PI*277.18*t)*(0.7+0.3*sin(2*PI*0.07*t+1))"
               "+0.026*sin(2*PI*329.63*t)*(0.7+0.3*sin(2*PI*0.09*t+2))"
               "+0.018*sin(2*PI*440*t)*(0.6+0.4*sin(2*PI*0.05*t))"
               "+0.05*sin(2*PI*880*t)*exp(-40*mod(t,1.05))':s=48000:d=%.2f" % total)
        args += ["-f", "lavfi", "-i", pad]
        f.append("[%d:a]lowpass=f=2400,aecho=0.8:0.7:80|160:0.25|0.18,afade=t=in:d=1.5,"
                 "afade=t=out:st=%.2f:d=2,volume=0.9[aout]" % (n, max(0, total - 2)))
    cmd = args + ["-filter_complex", ";".join(f), "-map", "[vout]"]
    if audio:
        cmd += ["-map", "[aout]", "-c:a", "aac", "-b:a", "160k"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-r", FPS, keluar]
    ff(*cmd)
    print("  ->", os.path.relpath(keluar, AKAR), "%.1f dtk" % durasi(keluar))
    return keluar


def k(nama):
    return os.path.join(KERJA, nama)


# ------------------------------------------------------------
#  VIDEO
# ------------------------------------------------------------
def hero():
    mp4 = klip_render("hero", k("hero-1080.mp4"), True, (1080, 1080))
    ff("-i", mp4, "-vf", "scale=900:900:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow",
       "-crf", "22", "-an", "-movflags", "+faststart", os.path.join(KELUAR, "hero-loop.mp4"))
    ff("-i", mp4, "-vf", "scale=900:900:flags=lanczos", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
       "-row-mt", "1", "-an", os.path.join(KELUAR, "hero-loop.webm"))
    print("  -> hero-loop.mp4/webm")


# Showreel sinematik (blender/build_showreel.py): narasi sehari-hari, ritme & tipografi
# ala film RePulse — eyebrow kecil, judul serif, anak judul — tetapi terang.
SHOWREEL = [
    ("sr-pembuka", "", "TeleCare", "Rawat lebih awal, bukan lebih lambat.", "tengah-bawah"),
    ("sr-pagi", "Pagi · di kamar", "Hari dimulai dengan satu pandangan.", "TeleBand sudah merekam semalaman — detak jantung, SpO₂, suhu.", "kiri-bawah"),
    ("sr-pergelangan", "TeleBand", "Lima tanda vital, satu pergelangan.", "PPG empat kanal · EKG lead-I · termistor kontak kulit", "kiri-bawah"),
    ("sr-aplikasi", "Aplikasi TeleCare", "Semua vital, jelas sekilas.", "Sinkron lewat Bluetooth, tersimpan dalam satu riwayat.", "kiri-bawah"),
    ("sr-kerja", "Siang · di meja kerja", "Stres naik, TeleCare memberi tanda.", "Variabilitas detak jantung turun — Anda diingatkan sebelum jadi keluhan.", "kiri-bawah"),
    ("sr-sistem", "Sistem", "Tiga perangkat, satu riwayat.", "TeleBand · TeleRing · aplikasi — terhubung ke dokter dan faskes.", "kiri-atas"),
    ("sr-konsultasi", "Malam · konsultasi", "Dokter melihat data yang sama.", "Chat dan video call dengan vital terbaru terlampir otomatis.", "kiri-bawah"),
    ("sr-penutup", "", "TeleCare", "telecare-id.web.app · Fisika FMIPA UNS", "tengah-bawah"),
]


def klip_shot(nama, eyebrow, judul, sub, pos, opak=False):
    base = klip_render(nama, k("r-" + nama + ".mp4"), not opak)
    if not (eyebrow or judul or sub):
        return base
    if pos == "tengah-bawah":
        png = kartu(nama, eyebrow, judul, sub, "tengah")
        # judul besar di bawah objek: geser kartu ke bawah
        im = Image.open(png)
        geser = Image.new("RGBA", im.size, (0, 0, 0, 0))
        geser.alpha_composite(im, (0, 330))
        geser.save(png)
    else:
        png = kartu(nama, eyebrow, judul, sub, pos)
    return beri_kartu(base, png, k("t-" + nama + ".mp4"))


def showreel():
    klips = [klip_shot(*s, opak=True) for s in SHOWREEL]
    sambung(klips, os.path.join(KELUAR, "telecare-showreel.mp4"), 0.7,
            jenis=["fadewhite", "fade", "fade", "fade", "fadewhite", "fade", "fadewhite"])


def promo():
    """Promo ± 40 dtk: shot sinematik (build_showreel) diselingi layar aplikasi ponsel asli."""
    pon = os.path.join(SHOTS, "ponsel")

    def cari(potongan):
        for f in sorted(os.listdir(pon)):
            if potongan in f:
                return os.path.join(pon, f)
        raise SystemExit("tangkapan tidak ada: " + potongan)

    urutan = [
        ("sr-pembuka", None, "", "TeleCare", "Rawat lebih awal, bukan lebih lambat."),
        ("sr-pergelangan", None, "Wearable", "Dipakai seharian, tanpa repot.", "TeleBand & TeleRing mengukur vital secara kontinu."),
        (None, "pasien-home", "Beranda", "Semua vital dalam satu pandang.", "Detak jantung, SpO₂, suhu, tekanan darah, EKG."),
        (None, "pasien-analisis", "Analisis", "Tren, bukan sekadar angka.", "TeleCare AI menandai pola sebelum menjadi keluhan."),
        ("sr-kerja", None, "Peringatan dini", "Stres naik, Anda diberi tanda.", "Variabilitas detak jantung dipantau sepanjang hari."),
        (None, "pasien-konsultasi", "Telemedisin", "Dokter dan psikolog, satu ketukan.", "Chat dan video call dengan vital terlampir."),
        ("sr-konsultasi", None, "Konsultasi", "Dokter melihat data yang sama.", ""),
        (None, "dokter-klinik", "Untuk dokter", "Papan jaga yang tenang.", "Antrean, pasien berisiko, catatan klinis."),
        (None, "faskes-home", "Untuk institusi", "Pantau populasi, bukan hanya individu.", "Perusahaan, pesantren, sekolah berasrama, panti wreda."),
        ("sr-sistem", None, "Sistem", "Tiga perangkat, satu riwayat.", ""),
        ("sr-penutup", None, "Coba sekarang", "telecare-id.web.app", "Masuk sebagai tamu — tanpa daftar."),
    ]
    klips = []
    for i, (shot, layar, e, j, sub) in enumerate(urutan):
        if shot:
            pos = "tengah-bawah" if shot in ("sr-pembuka", "sr-penutup") else ("kiri-atas" if shot == "sr-sistem" else "kiri-bawah")
            klips.append(klip_shot(shot, e, j, sub, pos, opak=True))
        else:
            base = klip_layar(cari(layar), k("l-%d.mp4" % i), 3.6, 0, "ponsel")
            png = kartu("p%d" % i, e, j, sub, "kiri-bawah", pil=False, lebar=620)
            klips.append(beri_kartu(base, png, k("pt-%d.mp4" % i)))
    sambung(klips, os.path.join(KELUAR, "telecare-promo.mp4"), 0.5,
            jenis=["fadewhite", "fade", "smoothleft", "fade", "fade", "smoothleft", "fade", "smoothleft", "fade", "fadewhite"])


def usecase():
    adegan = [
        ("uc-pagi", "06.30 · Pagi", "Bangun dengan ringkasan malam.", "TeleBand merekam detak jantung dan SpO₂ selama tidur, lalu sinkron otomatis."),
        ("uc-kerja", "10.15 · Kerja", "Stres naik, TeleCare memberi tanda.", "Variabilitas detak jantung turun saat rapat — Anda diingatkan untuk jeda."),
        ("uc-makan", "12.30 · Makan siang", "Potret piring, lihat respons tubuh.", "Estimasi nutrisi dan puncak gula darah tercatat per sesi."),
        ("uc-konsultasi", "19.00 · Konsultasi", "Tanya dokter dengan data di tangan.", "Video call, vital terbaru ikut terlampir otomatis."),
    ]
    klips = []
    for nama, e, j, s in adegan:
        base = klip_render(nama, k("r-" + nama + ".mp4"), False)
        png = kartu(nama, e, j, s, "kiri-bawah", pil=True, lebar=720)
        klips.append(beri_kartu(base, png, k("t-" + nama + ".mp4")))
    klips.append(klip_shot("sr-penutup", "Sehari bersama", "TeleCare", "Rawat lebih awal, bukan lebih lambat.", "tengah-bawah", opak=True))
    sambung(klips, os.path.join(KELUAR, "telecare-usecase.mp4"), 0.6,
            jenis=["fade", "fade", "fade", "fadewhite"])



# Showreel aplikasi (blender/build_showreel_app.py): mockup Android, UI TeleCare bergerak.
APLIKASI = [
    ("ap-buka", "", "Aplikasi TeleCare", "Pantau kesehatan dan hubungi dokter dari satu aplikasi.", "tengah-bawah"),
    ("ap-beranda", "Beranda", "Semua vital, sekilas.", "Detak jantung, SpO₂, suhu, tekanan darah, dan EKG langsung dari perangkat.", "kiri-bawah"),
    ("ap-vital", "Detail vital", "Satu ketukan ke riwayat lengkap.", "Tren 60 pembacaan terakhir dengan rentang acuan.", "kiri-bawah"),
    ("ap-konsultasi", "Telemedisin", "Pilih dokter, mulai chat.", "Dokter umum, spesialis, dan psikolog — data vital ikut terlampir.", "kiri-bawah"),
    ("ap-panggilan", "Video call", "Bertatap muka tanpa antre.", "Panggilan WebRTC langsung dari aplikasi.", "kiri-bawah"),
    ("ap-perangkat", "Perangkat", "TeleBand & TeleRing tersambung.", "Pasangkan lewat Bluetooth, sinkron otomatis.", "kiri-bawah"),
    ("ap-peran", "Empat peran", "Pasien · dokter · faskes · admin.", "Satu aplikasi, layar yang disesuaikan untuk tiap tugas.", "kiri-atas"),
    ("ap-tutup", "Coba sekarang", "telecare-id.web.app", "Masuk sebagai tamu — tanpa daftar.", "kiri-bawah"),
]


def aplikasi():
    klips = [klip_shot(*s, opak=True) for s in APLIKASI]
    sambung(klips, os.path.join(KELUAR, "telecare-aplikasi.mp4"), 0.6,
            jenis=["fadewhite", "smoothleft", "fade", "smoothleft", "fade", "smoothleft", "fade"])

def main():
    pilih = sys.argv[1] if len(sys.argv) > 1 else "semua"
    for nama, fn in (("hero", hero), ("showreel", showreel), ("promo", promo), ("usecase", usecase),
                     ("aplikasi", aplikasi)):
        if pilih in (nama, "semua"):
            print("==", nama)
            fn()


if __name__ == "__main__":
    main()
