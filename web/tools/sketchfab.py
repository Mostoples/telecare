"""
TeleCare — pembantu Sketchfab (cari, unduh, catat atribusi).

Token TIDAK disimpan di berkas ini. Baca dari variabel lingkungan:

    set SKETCHFAB_TOKEN=xxxxxxxx          (cmd)
    $env:SKETCHFAB_TOKEN = "xxxxxxxx"     (PowerShell)
    export SKETCHFAB_TOKEN=xxxxxxxx       (bash)

Pemakaian:

    python tools/sketchfab.py cari "wrist hand" --maks-muka 60000
    python tools/sketchfab.py unduh <uid> [--nama tangan]
    python tools/sketchfab.py kredit          # cetak daftar atribusi

Hanya model berlisensi CC0 dan CC-BY yang diterima, karena video yang dihasilkan
dibagikan publik: lisensi NC/ND membatasi pemakaian, dan lisensi Standard/Editorial
Sketchfab tidak mengizinkan pemakaian seperti ini. Setiap unduhan dicatat ke
assets/credits/sketchfab.json supaya atribusi tidak pernah hilang.

Berkas model mentah disimpan di build/sketchfab/ yang tidak dilacak Git.
"""
import argparse
import io
import json
import os
import sys
import urllib.parse
import urllib.request
import zipfile

API = "https://api.sketchfab.com/v3"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "build", "sketchfab")
CREDITS = os.path.join(ROOT, "assets", "credits", "sketchfab.json")

# Lisensi yang aman untuk video publik. Kunci = slug Sketchfab.
IZIN = {
    "cc0": "CC0 1.0 (domain publik)",
    "by": "CC BY 4.0 (wajib atribusi)",
}


def token():
    t = os.environ.get("SKETCHFAB_TOKEN", "").strip()
    if not t:
        sys.exit("SKETCHFAB_TOKEN belum diisi. Lihat petunjuk di awal berkas ini.")
    return t


def minta(url, auth=False):
    req = urllib.request.Request(url, headers={"User-Agent": "TeleCare/1.0"})
    if auth:
        req.add_header("Authorization", "Token " + token())
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def ukuran_glb(m):
    arc = (m.get("archives") or {}).get("glb") or {}
    return arc.get("size") or 0


# Objek lisensi Sketchfab hanya berisi {"uid", "label"} — tidak ada slug. Label dipetakan
# ke kunci IZIN; label lain (NonCommercial, NoDerivs, ShareAlike, Standard, Editorial)
# sengaja tidak dipetakan sehingga otomatis tertolak.
LABEL = {
    "cc0 public domain": "cc0",
    "cc attribution": "by",
}


def slug_lisensi(m):
    lic = m.get("license") or {}
    if isinstance(lic, str):
        lic = {"label": lic}
    return LABEL.get((lic.get("label") or "").strip().lower(), "")


def cari(q, maks_muka, maks_mb, jumlah):
    hasil = []
    params = {
        "type": "models", "q": q, "downloadable": "true",
        "sort_by": "-likeCount", "count": 24,
    }
    if maks_muka:
        params["max_face_count"] = maks_muka
    url = API + "/search?" + urllib.parse.urlencode(params)
    halaman = []
    # Filter lisensi di server tidak dapat diandalkan, jadi ambil beberapa halaman
    # lalu saring sendiri.
    for _ in range(4):
        try:
            data = minta(url)
        except Exception as e:  # noqa: BLE001
            print("  gagal mencari: %s" % e, file=sys.stderr)
            break
        halaman.extend(data.get("results", []))
        url = data.get("next")
        if not url:
            break
    if True:
        for m in halaman:
            s = slug_lisensi(m)
            if s not in IZIN:
                continue            # jaga-jaga bila filter server longgar
            mb = ukuran_glb(m) / 1048576
            if maks_mb and mb and mb > maks_mb:
                continue
            hasil.append((m, s, mb))

    hasil.sort(key=lambda x: -(x[0].get("likeCount") or 0))
    seen = set()
    n = 0
    for m, s, mb in hasil:
        if m["uid"] in seen:
            continue
        seen.add(m["uid"])
        print("%s  %-4s %6.1f MB %8s muka  %5d suka  %s — %s" % (
            m["uid"], s, mb, m.get("faceCount") or "?", m.get("likeCount") or 0,
            m["name"][:44], (m.get("user") or {}).get("username", "?")))
        n += 1
        if n >= jumlah:
            break
    if not n:
        print("(tidak ada hasil berlisensi CC0/CC-BY)")


def muat_kredit():
    if os.path.exists(CREDITS):
        with io.open(CREDITS, encoding="utf-8") as f:
            return json.load(f)
    return []


def simpan_kredit(daftar):
    os.makedirs(os.path.dirname(CREDITS), exist_ok=True)
    with io.open(CREDITS, "w", encoding="utf-8") as f:
        json.dump(daftar, f, ensure_ascii=False, indent=2)
        f.write("\n")


def unduh(uid, nama):
    info = minta("%s/models/%s" % (API, uid))
    s = slug_lisensi(info)
    if s not in IZIN:
        sys.exit("Ditolak: lisensi '%s' tidak diizinkan (hanya CC0 / CC-BY)." % s)

    links = minta("%s/models/%s/download" % (API, uid), auth=True)
    glb = links.get("glb")
    gltf = links.get("gltf")
    os.makedirs(OUT_DIR, exist_ok=True)
    nama = nama or uid

    if glb and glb.get("url"):
        tujuan = os.path.join(OUT_DIR, nama + ".glb")
        urllib.request.urlretrieve(glb["url"], tujuan)
    elif gltf and gltf.get("url"):
        # glTF datang sebagai zip berisi scene.gltf + tekstur
        folder = os.path.join(OUT_DIR, nama)
        zpath = folder + ".zip"
        urllib.request.urlretrieve(gltf["url"], zpath)
        with zipfile.ZipFile(zpath) as z:
            z.extractall(folder)
        os.remove(zpath)
        tujuan = os.path.join(folder, "scene.gltf")
    else:
        sys.exit("Model tidak menyediakan glb/gltf untuk diunduh.")

    user = info.get("user") or {}
    entri = {
        "nama": nama,
        "judul": info.get("name"),
        "uid": uid,
        "pembuat": user.get("displayName") or user.get("username"),
        "profil": user.get("profileUrl"),
        "tautan": info.get("viewerUrl"),
        "lisensi": IZIN[s],
        "lisensi_slug": s,
        "berkas": os.path.relpath(tujuan, ROOT).replace("\\", "/"),
    }
    daftar = [k for k in muat_kredit() if k["uid"] != uid]
    daftar.append(entri)
    simpan_kredit(daftar)

    mb = os.path.getsize(tujuan) / 1048576 if os.path.isfile(tujuan) else 0
    print("OK  %s  (%.1f MB)  %s — %s  [%s]" % (
        entri["berkas"], mb, entri["judul"], entri["pembuat"], entri["lisensi"]))


def kredit():
    daftar = muat_kredit()
    if not daftar:
        print("(belum ada aset Sketchfab)")
        return
    for k in daftar:
        print('"%s" oleh %s — %s — %s' % (k["judul"], k["pembuat"], k["lisensi"], k["tautan"]))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cari")
    c.add_argument("q")
    c.add_argument("--maks-muka", type=int, default=80000)
    c.add_argument("--maks-mb", type=float, default=25)
    c.add_argument("--jumlah", type=int, default=8)
    u = sub.add_parser("unduh")
    u.add_argument("uid")
    u.add_argument("--nama")
    sub.add_parser("kredit")
    a = ap.parse_args()
    if a.cmd == "cari":
        cari(a.q, a.maks_muka, a.maks_mb, a.jumlah)
    elif a.cmd == "unduh":
        unduh(a.uid, a.nama)
    else:
        kredit()


if __name__ == "__main__":
    main()
