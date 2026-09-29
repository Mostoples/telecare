# ============================================================
#  TeleCare — video use case (Blender 5.x, Cycles)
#
#  Menggabungkan properti dari Sketchfab (lisensi CC BY, kredit di
#  assets/credits/sketchfab.json) dengan aset buatan Blender CLI:
#  TeleBand, TeleRing, ponsel porselen berlayar UI TeleCare asli,
#  meja nakas & piring prosedural.
#
#  Gaya "clay pastel": material Sketchfab dicampur ke putih agar satu
#  bahasa dengan UI neumorfik; produk TeleCare tetap berwarna penuh.
#
#  Jalankan (setelah tools/sketchfab.py unduh ... dan tangkap-layar):
#    blender -b -noaudio -P blender/build_usecase.py -- --root <web>
#            [--hanya pagi,kerja,makan,konsultasi] [--sampel 24] [--skala 100] [--langkah 1]
#
#  Keluaran: build/video/frames/uc-<adegan>/0000.png
# ============================================================
import bpy
import math
import os
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_ikon3d as BI
import build_assets as BA
import build_video as BV

arg = BI.arg
ROOT = BI.ROOT
SF = os.path.join(ROOT, "build", "sketchfab")
OUT = os.path.join(ROOT, "build", "video", "frames")
SAMPEL = int(arg("--sampel", 24))
SKALA = int(arg("--skala", 100))
LANGKAH = int(arg("--langkah", 1))
HANYA = [x for x in str(arg("--hanya", "")).split(",") if x]

# skala produk (satuan dunia = meter)
S_JAM = 0.02      # TeleBand ± 4 cm
S_CINCIN = 0.0105  # TeleRing ± 2,2 cm
S_PONSEL = 0.072   # ponsel ± 7 x 15,5 cm


# ------------------------------------------------------------
#  studio ruangan (opak, bukan transparan)
# ------------------------------------------------------------
def studio():
    BV.EMISI_LAYAR = 2.4
    BI.kosongkan()
    BI._MAT.clear()
    BV._GAMBAR.clear()
    for blk in (bpy.data.materials, bpy.data.images):
        for b in list(blk):
            if b.users == 0:
                blk.remove(b)
    sc = bpy.context.scene
    BI.pasang_gpu(sc)
    sc.cycles.samples = SAMPEL
    sc.cycles.use_denoising = True
    # denoiser di GPU + data persisten: geometri tidak dibangun ulang tiap frame
    try:
        sc.cycles.denoiser = "OPTIX"
    except Exception:
        pass
    sc.render.use_persistent_data = True
    sc.cycles.adaptive_threshold = 0.03
    sc.cycles.max_bounces = 6
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    sc.render.resolution_percentage = SKALA
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.view_settings.exposure = -0.35
    w = sc.world or bpy.data.worlds.new("dunia")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = BI.hx("#EEF3F1")
    bg.inputs["Strength"].default_value = 0.55

    # lantai & dua dinding
    lantai = kotak_ruang((12, 12, 0.02), (0, 0, -0.01), "#D9E2DE", 0.7)
    kotak_ruang((12, 0.1, 5), (0, 2.6, 2.5), "#E6EDEA", 0.9)
    kotak_ruang((0.1, 12, 5), (-3.2, 0, 2.5), "#E1E9E5", 0.9)
    # "jendela": lampu area besar dari kiri, cahaya pagi lembut
    lampu("jendela", (-2.9, -0.6, 2.2), 700, 2.4, (1.0, 0.94, 0.86), (0.6, 0.4, 0.5))
    lampu("isi", (2.5, -3.5, 2.8), 120, 5.0, (0.9, 0.97, 1.0), (0, 0.3, 0.6))
    lampu("atas", (0.3, 0.2, 3.4), 90, 3.0, (1, 1, 1), (0.3, 0.3, 0))

    cd = bpy.data.cameras.new("kam")
    cd.lens = 35
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 2.2
    cd.clip_start = 0.01
    cam = bpy.data.objects.new("kam", cd)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    return sc, cam


def lampu(nama, loc, energi, ukuran, warna, ke):
    ld = bpy.data.lights.new(nama, "AREA")
    ld.energy, ld.size, ld.color = energi, ukuran, warna
    o = bpy.data.objects.new(nama, ld)
    o.location = loc
    bpy.context.collection.objects.link(o)
    o.rotation_euler = (Vector(ke) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def mat_warna(nama, hexw, kasar=0.6, coat=0.0):
    m = bpy.data.materials.new(nama)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = BI.hx(hexw)
    b.inputs["Roughness"].default_value = kasar
    b.inputs["Coat Weight"].default_value = coat
    return m


def kotak_ruang(ukuran, loc, hexw, kasar):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = ukuran
    BI.pakai(o, mat_warna("ruang" + hexw, hexw, kasar))
    return o


# ------------------------------------------------------------
#  impor model Sketchfab + gaya clay pastel
# ------------------------------------------------------------
def pastel(mat, campur=0.5):
    """Base Color dicampur ke putih hangat: tekstur tetap terbaca, warna jadi
    lembut sehingga properti tidak bersaing dengan produk TeleCare."""
    if not mat or not mat.use_nodes or mat.get("_pastel"):
        return
    nt = mat.node_tree
    b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if b is None:
        return
    inp = b.inputs["Base Color"]
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MIX"
    mix.inputs["Factor"].default_value = campur
    putih = BI.hx("#F4F6F4")
    if inp.is_linked:
        sumber = inp.links[0].from_socket
        nt.links.new(sumber, mix.inputs["A"])
    else:
        mix.inputs["A"].default_value = inp.default_value
    mix.inputs["B"].default_value = putih
    mat["_pastel"] = 1
    nt.links.new(mix.outputs["Result"], inp)
    b.inputs["Roughness"].default_value = max(0.45, b.inputs["Roughness"].default_value)
    if "Metallic" in b.inputs and not b.inputs["Metallic"].is_linked:
        b.inputs["Metallic"].default_value = min(0.3, b.inputs["Metallic"].default_value)


def impor(nama, ukuran, loc=(0, 0, 0), rotz=0.0, ambil=None, buang=None, sumbu="tinggi", campur=0.5):
    """Impor GLB, sisakan objek bernama `ambil*`, buang `buang*`, lalu skala
    agar sumbu tertentu = `ukuran` meter, alas di z=loc.z, pusat XY di loc."""
    sebelum = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SF, nama + ".glb"))
    baru = [o for o in bpy.data.objects if o not in sebelum]
    for o in list(baru):
        if o.type == "MESH":
            hapus = (ambil and not any(o.name.startswith(a) for a in ambil)) or \
                    (buang and any(o.name.startswith(b) for b in buang))
            if hapus:
                baru.remove(o)
                bpy.data.objects.remove(o, do_unlink=True)
    r = BV.akar("sf_" + nama)
    for o in baru:
        if o.name in bpy.data.objects and o.parent is None:
            o.parent = r
    ms = [o for o in r.children_recursive if o.type == "MESH"]
    for o in ms:
        for m in o.data.materials:
            pastel(m, campur)
    r.rotation_euler = (0, 0, rotz)
    bpy.context.view_layer.update()

    def kotak():
        pts = [o.matrix_world @ Vector(c) for o in ms for c in o.bound_box]
        mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        return mn, mx

    mn, mx = kotak()
    d = mx - mn
    acuan = {"tinggi": d.z, "panjang": max(d.x, d.y)}[sumbu]
    s = ukuran / max(acuan, 1e-6)
    r.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = kotak()
    c = (mn + mx) / 2
    r.location += Vector((loc[0] - c.x, loc[1] - c.y, loc[2] - mn.z))
    bpy.context.view_layer.update()
    mn, mx = kotak()
    print(">>> impor %-10s s=%.4f ukuran=(%.2f %.2f %.2f) atas=%.3f" % (nama, s, *(mx - mn), mx.z))
    return r, mx.z


def puncak(akar_obj, awalan):
    """z tertinggi dari mesh bernama `awalan*` (mis. permukaan meja)."""
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for o in akar_obj.children_recursive
          if o.type == "MESH" and o.name.startswith(awalan) for c in o.bound_box]
    return max(zs) if zs else None


# ------------------------------------------------------------
#  aset TeleCare dalam skala dunia nyata
# ------------------------------------------------------------
def teleband(induk, loc, rot):
    o = BA.build_teleband()
    return BV.pasang(o, induk, loc, rot, S_JAM)


def telering(induk, loc, rot):
    o = BA.build_telering()
    return BV.pasang(o, induk, loc, rot, S_CINCIN)


def ponsel_datar(induk, berkas, loc, rotz=0.0, miring=0.0):
    """Ponsel tergeletak (layar menghadap atas), `miring` = sudut sandaran."""
    g, layar = BV.ponsel_ui(induk, berkas, loc, (math.radians(-90 + miring), 0, rotz), S_PONSEL)
    return g, layar


def meja_nakas(induk, loc, h=0.55):
    o = BI.kotak((0.44, 0.36, h), 0.025, 4)
    BI.pakai(o, mat_warna("nakas", "#F3F6F4", 0.45, 0.2))
    return BV.pasang(o, induk, (loc[0], loc[1], h / 2))


def piring(induk, loc, r=0.13):
    prof = [(0.0, 0.004), (r * 0.62, 0.004), (r * 0.8, 0.01), (r, 0.022), (r * 1.02, 0.024)]
    o = BI.bubut("piring", prof)
    o.modifiers["sol"].thickness = 0.004
    BI.pakai(o, mat_warna("piring", "#FAFBFA", 0.25, 0.6))
    return BV.pasang(o, induk, loc)


def ui(nama):
    f = BV.ui(nama)
    if not f:
        raise RuntimeError("tangkapan UI '%s' belum ada — jalankan tools/tangkap-layar.ps1" % nama)
    return f


# ------------------------------------------------------------
#  ADEGAN
# ------------------------------------------------------------
def adegan_pagi(sc, cam):
    r = BV.akar("pagi")
    impor("ranjang", 2.3, (-0.4, 1.3, 0), 0.0, sumbu="panjang")
    impor("tanaman", 1.0, (-2.4, 1.9, 0), ambil=["Pot_4_"])
    h = 0.55
    meja_nakas(r, (1.25, 0.3), h)
    jam = teleband(r, (1.12, 0.26, h + 0.012), (0, 0, math.radians(-25)))
    ph, layar = ponsel_datar(r, ui("pasien-home"), (1.36, 0.2, h + 0.006), math.radians(12))
    impor("mug", 0.1, (1.38, 0.44, h), sumbu="tinggi", campur=0.4)
    fokus = Vector((1.25, 0.25, h + 0.02))

    def perbarui(t, i):
        e = BV.mulus(t)
        cam.data.lens = 50
        BV.arahkan(cam, (0.88 + 0.06 * e, -0.3 + 0.12 * e, 0.92 - 0.06 * e), fokus)
        jam.rotation_euler = (0, 0, math.radians(-25))
    return 120, perbarui


def adegan_kerja(sc, cam):
    r = BV.akar("kerja")
    meja, _ = impor("meja", 0.76, (0, 0.55, 0), math.radians(90), buang=["Cell_phone"], campur=0.55)
    atas = puncak(meja, "Paper") or puncak(meja, "Desk") or 0.76
    impor("kursi", 0.85, (-1.3, -0.1, 0), math.radians(200), ambil=["Armchair_07_"])
    impor("tanaman", 1.1, (1.6, 1.3, 0), ambil=["Pot_12_"])
    ph, layar = ponsel_datar(r, ui("pasien-vital-hr"), (0.34, 0.4, atas + 0.006), math.radians(-8))
    telering(r, (0.5, 0.36, atas + 0.012), (0, 0, 0))
    tangan, _ = impor("tangan", 0.3, (0.0, 0.34, atas), math.radians(180), sumbu="panjang", campur=0.35)
    fokus = Vector((0.36, 0.38, atas))

    def perbarui(t, i):
        e = BV.mulus(t)
        cam.data.lens = 40
        BV.arahkan(cam, (0.05 + 0.2 * e, -0.2 + 0.08 * e, atas + 0.42 - 0.08 * e), fokus)
        # detak layar: berganti ke analisis di paruh kedua
        if i == int(0.55 * 120):
            BV.ganti_layar(layar, ui("pasien-analisis"))
    return 120, perbarui


def adegan_makan(sc, cam):
    r = BV.akar("makan")
    meja, atas = impor("mejamakan", 0.75, (0, 0.5, 0), 0.0, campur=0.55)
    impor("roti", 0.26, (-0.08, 0.45, atas), sumbu="panjang", campur=0.25)
    impor("sendok", 0.2, (0.17, 0.42, atas + 0.002), math.radians(90), sumbu="panjang", campur=0.3)
    impor("mug", 0.1, (-0.35, 0.62, atas), campur=0.4)
    impor("tanaman", 0.55, (0.55, 0.75, atas), ambil=["Pot_1_"])
    ph, layar = ponsel_datar(r, ui("pasien-riwayat"), (0.34, 0.33, atas + 0.006), math.radians(-18))
    jam = teleband(r, (-0.3, 0.36, atas + 0.012), (0, 0, math.radians(30)))
    fokus = Vector((0.1, 0.4, atas))

    def perbarui(t, i):
        e = BV.mulus(t)
        BV.arahkan(cam, (-0.3 + 0.55 * e, -0.35, atas + 0.52), fokus)
        if i == int(0.5 * 120):
            BV.ganti_layar(layar, ui("pasien-analisis"))
    return 120, perbarui


def adegan_konsultasi(sc, cam):
    r = BV.akar("kons")
    impor("kursi", 0.9, (0, 0.8, 0), 0.0, ambil=["Armchair_07_"])
    impor("tanaman", 1.25, (-1.0, 1.1, 0), ambil=["Pot_4_"])
    h = 0.5
    meja_nakas(r, (0.85, 0.9), h)
    impor("lampu", 0.48, (0.85, 0.95, h), campur=0.5)
    # ponsel "dipegang" di depan kamera, menampilkan panggilan video
    ph, layar = BV.ponsel_ui(r, ui("pasien-call"), (0.12, 0.02, 0.95), (math.radians(8), 0, math.radians(-14)), S_PONSEL * 1.5)
    jam = teleband(r, (0.72, 0.86, h + 0.012), (0, 0, math.radians(20)))

    def perbarui(t, i):
        e = BV.mulus(t)
        ph.location.z = 0.95 + 0.01 * math.sin(t * 6)
        BV.arahkan(cam, (-0.05 - 0.08 * e, -0.55 + 0.1 * e, 1.02), (0.1, 0.05, 0.94))
        if i == int(0.5 * 120):
            BV.ganti_layar(layar, ui("pasien-chat"))
    return 120, perbarui


ADEGAN = {"pagi": adegan_pagi, "kerja": adegan_kerja, "makan": adegan_makan,
          "konsultasi": adegan_konsultasi}


def render(nama, fn):
    BV._GAMBAR.clear()
    sc, cam = studio()
    n, perbarui = fn(sc, cam)
    folder = os.path.join(OUT, "uc-" + nama)
    os.makedirs(folder, exist_ok=True)
    if hasattr(sc.render.image_settings, "media_type"):
        sc.render.image_settings.media_type = "IMAGE"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    for i in range(n):
        perbarui(i / n, i)
        if i % LANGKAH:
            continue
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(folder, "%04d.png" % i)
        if os.path.exists(sc.render.filepath) and os.path.getsize(sc.render.filepath) > 0:
            continue
        bpy.ops.render.render(write_still=True)
    print(">>> adegan:", nama, n, "frame")


def utama():
    daftar = [(k, f) for k, f in ADEGAN.items() if not HANYA or k in HANYA]
    gagal = []
    for nama, fn in daftar:
        try:
            render(nama, fn)
        except Exception as e:
            import traceback
            traceback.print_exc()
            gagal.append((nama, str(e)))
    print(">>> SELESAI_UC total=%d gagal=%d %s" % (len(daftar), len(gagal), gagal))


if __name__ == "__main__":
    utama()
