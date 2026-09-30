# ============================================================
#  TeleCare — showreel APLIKASI dengan mockup Android (Blender 5.x, Cycles)
#
#  Ponsel Android generik (tanpa merek): bodi grafit, kaca depan, lubang
#  kamera di tengah atas, tombol daya & volume di sisi kanan. Layarnya
#  memutar urutan tekstur dari tools/layar_ponsel.py (gulir, ketukan,
#  transisi) sehingga UI TeleCare terlihat hidup.
#
#  Jalankan (setelah python tools/layar_ponsel.py):
#    blender -b -noaudio -P blender/build_showreel_app.py -- --root <web>
#            [--hanya buka,beranda,...] [--sampel 32] [--skala 100] [--langkah 1]
#  Keluaran: build/video/frames/ap-<shot>/0000.png  (RGB, opak)
# ============================================================
import bpy
import math
import os
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_ikon3d as BI      # noqa: E402
import build_assets as BA      # noqa: E402
import build_video as BV       # noqa: E402
import build_usecase as BU     # noqa: E402

arg = BI.arg
ROOT = BI.ROOT
OUT = os.path.join(ROOT, "build", "video", "frames")
LAYAR = os.path.join(ROOT, "build", "video", "layar")
SAMPEL = int(arg("--sampel", 32))
SKALA = int(arg("--skala", 100))
LANGKAH = int(arg("--langkah", 1))
HANYA = [x for x in str(arg("--hanya", "")).split(",") if x]
FPS = 24
mulus, arahkan = BV.mulus, BV.arahkan


# ------------------------------------------------------------
#  studio
# ------------------------------------------------------------
def studio():
    BI.kosongkan()
    BI._MAT.clear()
    for blk in (bpy.data.materials, bpy.data.images, bpy.data.meshes):
        for b in list(blk):
            if b.users == 0:
                blk.remove(b)
    sc = bpy.context.scene
    BI.pasang_gpu(sc)
    sc.cycles.samples = SAMPEL
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPTIX"
    except Exception:
        pass
    sc.cycles.adaptive_threshold = 0.02
    sc.render.use_persistent_data = True
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    sc.render.resolution_percentage = SKALA
    # Standard: warna UI di layar tampil persis (resep AQUENT); lampu disetel lebih lembut
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = -1.15
    w = sc.world or bpy.data.worlds.new("dunia")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = BI.hx("#E4ECF1")
    bg.inputs["Strength"].default_value = 0.8
    BU.lampu("kunci", (-4.5, -5.0, 6.5), 1300, 6.0, (1.0, 0.98, 0.95), (0, 0.5, 1.2))
    BU.lampu("tepi", (5.0, 4.0, 4.5), 900, 5.0, (0.85, 0.97, 0.92), (0, 0.5, 1.2))
    BU.lampu("isi", (4.0, -6.0, 1.8), 350, 7.0, (1, 1, 1), (0, 0.5, 1.2))
    cyclorama("#E9EFF3")
    cd = bpy.data.cameras.new("kam")
    cd.lens = 50
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 4.0
    cam = bpy.data.objects.new("kam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return sc, cam


def cyclorama(warna):
    import bmesh
    bm = bmesh.new()
    prof = [(-8.0, 0.0), (2.5, 0.0)]
    R = 3.0
    for d in range(10, 91, 10):
        a = math.radians(d)
        prof.append((2.5 + R * math.sin(a), R * (1 - math.cos(a))))
    prof.append((2.5 + R, 12.0))
    ki = [bm.verts.new((-25, y, z)) for y, z in prof]
    ka = [bm.verts.new((25, y, z)) for y, z in prof]
    for i in range(len(prof) - 1):
        bm.faces.new((ki[i], ka[i], ka[i + 1], ki[i + 1]))
    me = bpy.data.meshes.new("cyc")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new("cyc", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(BU.mat_warna("cyc", warna, 0.8))


# ------------------------------------------------------------
#  ponsel Android generik
# ------------------------------------------------------------
LW, LH = 0.70, 0.70 * 962 / 430        # layar (rasio tekstur 430x962)
PW, PH = LW + 0.045, LH + 0.06          # bodi


def _pbr(nama, hexw, kasar=0.3, logam=0.0, coat=0.0):
    m = bpy.data.materials.new(nama)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = BI.hx(hexw)
    b.inputs["Roughness"].default_value = kasar
    b.inputs["Metallic"].default_value = logam
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.03
    return m


class Android:
    """Satu ponsel; .layar_ke(urutan, i) mengganti tekstur layar sesuai frame."""

    def __init__(self, induk, urutan, loc=(0, 0, 0), rot=(0, 0, 0), skala=1.0, warna="#2F3A3D"):
        self.akar = BV.akar("android")
        self.akar.parent = induk
        t = 0.042
        badan = BI.bentuk("bodi", BI.pola_rrect(PW, PH, 0.11, 12), t, 0.03, 6)
        BI.pakai(badan, _pbr("bodi", warna, 0.28, 0.9))
        badan.parent = self.akar
        y = -t - 0.001
        kaca = BI.bentuk("kaca", BI.pola_rrect(PW - 0.012, PH - 0.012, 0.105, 12), 0.003, 0.002, 2)
        BI.pakai(kaca, _pbr("kaca", "#050708", 0.05, 0.0, 1.0))
        kaca.parent = self.akar
        kaca.location = (0, y, 0)
        # layar
        bpy.ops.mesh.primitive_plane_add(size=1)
        ly = bpy.context.object
        ly.scale = (LW, LH, 1)
        bpy.ops.object.transform_apply(scale=True)
        ly.rotation_euler = (math.radians(90), 0, 0)
        ly.location = (0, y - 0.0045, 0)
        m = bpy.data.materials.new("layar")
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes["Principled BSDF"]
        self.tex = nt.nodes.new("ShaderNodeTexImage")
        self.tex.interpolation = "Cubic"
        self.tex.extension = "EXTEND"
        b.inputs["Base Color"].default_value = (0.01, 0.01, 0.01, 1)
        b.inputs["Roughness"].default_value = 0.06
        b.inputs["Coat Weight"].default_value = 1.0
        b.inputs["Coat Roughness"].default_value = 0.02
        b.inputs["Emission Strength"].default_value = 2.2
        nt.links.new(self.tex.outputs["Color"], b.inputs["Emission Color"])
        ly.data.materials.append(m)
        ly.parent = self.akar
        # lubang kamera depan
        lubang = BI.silinder(0.0135, 0.004, 0, 32)
        BI.pakai(lubang, _pbr("lubang", "#000000", 0.2, 0.0, 1.0))
        lubang.rotation_euler = (math.radians(90), 0, 0)
        lubang.location = (0, y - 0.006, LH / 2 - 0.028)
        lubang.parent = self.akar
        # tombol daya & volume (sisi kanan)
        for zc, panjang in ((0.28, 0.16), (0.05, 0.1)):
            tb = BI.kotak((0.012, 0.03, panjang), 0.005, 3)
            BI.pakai(tb, _pbr("tombol", warna, 0.3, 0.9))
            tb.location = (PW / 2 + 0.003, 0, zc)
            tb.parent = self.akar
        self.akar.location = loc
        self.akar.rotation_euler = rot
        self.akar.scale = (skala,) * 3
        self.urutan = urutan
        self.layar_ke(urutan, 0)

    def layar_ke(self, urutan, i):
        folder = os.path.join(LAYAR, urutan)
        fs = sorted(x for x in os.listdir(folder) if x.endswith(".png"))
        f = os.path.join(folder, fs[min(i, len(fs) - 1)])
        self.tex.image = bpy.data.images.load(f, check_existing=True)

    def titik_layar(self):
        bpy.context.view_layer.update()
        return self.akar.matrix_world @ Vector((0, -0.05, 0))


def ikon_apung(induk, nama, loc, skala=0.34):
    # ikon asli ± 2,4 satuan; faktor 0.55 agar sebanding dengan ponsel setinggi 1,6
    return BV.ikon(nama, induk, loc, skala * 0.55)


def apung(o, dasar, d, amp=0.06, per=3.2, fase=0.0, putar=10):
    o.location.z = dasar + amp * math.sin(2 * math.pi * d / per + fase)
    o.rotation_euler = (0, 0, math.radians(putar) * math.sin(2 * math.pi * d / (per * 1.3) + fase))


# ------------------------------------------------------------
#  SHOT
# ------------------------------------------------------------
def ap_buka(sc, cam):
    r = BV.akar("buka")
    r.location.x = 0.85          # subjek di kanan, judul di kiri-bawah
    hp = Android(r, "buka", (0, 0, 1.2))
    ik = [(ikon_apung(r, "jantung", (-1.05, 0.3, 1.9)), 1.9, 0.0), (ikon_apung(r, "oksigen", (1.05, 0.3, 1.7), 0.3), 1.7, 1.3),
          (ikon_apung(r, "jam", (-1.0, 0.4, 0.55), 0.3), 0.55, 2.2), (ikon_apung(r, "chat", (1.0, 0.4, 0.6), 0.3), 0.6, 0.7)]

    def perbarui(t, i):
        d = i / FPS
        e = mulus(min(1.0, t * 1.4))
        hp.akar.rotation_euler = (math.radians(12) * (1 - e), 0, math.radians(200) * (1 - e) + math.radians(-8) * e)
        hp.akar.location.z = 0.7 + 0.5 * e
        for k, (o, z, fs) in enumerate(ik):
            s = BV.muncul(t, 0.35 + 0.08 * k, 0.4)
            o.scale = (0.32 * 0.55 * s,) * 3
            apung(o, z, d, fase=fs)
        arahkan(cam, (0.0, -6.4 + 0.5 * mulus(t), 1.35), (0, 0, 1.2))
    return 96, perbarui


def ap_beranda(sc, cam):
    r = BV.akar("beranda")
    r.location.x = 0.95          # subjek di kanan, judul di kiri-bawah
    hp = Android(r, "beranda", (0, 0, 1.2), (0, 0, math.radians(-14)))
    ik = [(ikon_apung(r, "jantung", (-0.95, 0.5, 1.75), 0.3), 1.75, 0.0), (ikon_apung(r, "oksigen", (0.95, 0.6, 1.55), 0.26), 1.55, 1.1),
          (ikon_apung(r, "suhu", (1.05, 0.7, 0.7), 0.26), 0.7, 2.0)]

    def perbarui(t, i):
        d = i / FPS
        hp.layar_ke("beranda", i)
        e = mulus(t)
        hp.akar.rotation_euler = (math.radians(4), 0, math.radians(-14 + 10 * e))
        for o, z, fs in ik:
            apung(o, z, d, fase=fs)
        arahkan(cam, (0.35 - 0.3 * e, -6.5 + 0.5 * e, 1.4 - 0.05 * e), (0.05, 0, 1.2))
    return 144, perbarui


def ap_vital(sc, cam):
    r = BV.akar("vital")
    r.location.x = 0.75          # subjek di kanan, judul di kiri-bawah
    hp = Android(r, "vital", (-0.45, 0, 1.2), (0, 0, math.radians(16)))
    jtg = ikon_apung(r, "jantung", (0.75, 0.2, 1.25), 0.62)
    BV.alas(r, (0.75, 0.2), 0.5, 0.1)

    def perbarui(t, i):
        d = i / FPS
        hp.layar_ke("vital", i)
        denyut = max(0.0, math.sin(2 * math.pi * d * 1.2)) ** 6
        jtg.scale = (0.62 * 0.55 * (1 + 0.07 * denyut),) * 3
        jtg.rotation_euler = (0, 0, math.radians(-20 + 12 * math.sin(d)))
        e = mulus(t)
        arahkan(cam, (0.5 - 0.6 * e, -6.0 + 0.5 * e, 1.5), (0.1, 0, 1.2))
    return 108, perbarui


def ap_konsultasi(sc, cam):
    r = BV.akar("konsultasi")
    r.location.x = 0.7          # subjek di kanan, judul di kiri-bawah
    kiri = Android(r, "konsultasi", (-0.46, 0.15, 1.2), (0, 0, math.radians(10)))
    kanan = Android(r, "chat", (0.46, -0.1, 1.2), (0, 0, math.radians(-10)))
    ch = ikon_apung(r, "chat", (1.25, 0.4, 1.85), 0.3)
    st = ikon_apung(r, "stetoskop", (-1.25, 0.5, 0.55), 0.32)

    def perbarui(t, i):
        d = i / FPS
        kiri.layar_ke("konsultasi", i)
        apung(ch, 1.85, d, fase=0.3)
        apung(st, 0.55, d, fase=1.6)
        e = mulus(t)
        arahkan(cam, (-0.4 + 0.8 * e, -6.2 + 0.3 * e, 1.45), (0, 0, 1.2))
    return 120, perbarui


def ap_panggilan(sc, cam):
    r = BV.akar("panggilan")
    r.location.x = 0.95          # subjek di kanan, judul di kiri-bawah
    hp = Android(r, "panggilan", (0, 0, 1.2), (0, 0, math.radians(-6)))
    vd = ikon_apung(r, "video", (-0.9, 0.4, 1.7), 0.32)
    dk = ikon_apung(r, "dokter", (0.95, 0.4, 0.6), 0.4)

    def perbarui(t, i):
        d = i / FPS
        apung(vd, 1.7, d, fase=0.2)
        apung(dk, 0.6, d, fase=1.2, amp=0.03)
        e = mulus(t)
        cam.data.lens = 50 + 10 * e
        arahkan(cam, (0.2, -6.3, 1.4), (0, 0, 1.2))
    return 96, perbarui


def ap_perangkat(sc, cam):
    r = BV.akar("perangkat")
    r.location.x = 0.85          # subjek di kanan, judul di kiri-bawah
    hp = Android(r, "perangkat", (-0.2, 0, 1.2), (0, 0, math.radians(8)))
    BV.alas(r, (-1.25, 0.1), 0.45, 0.12)
    BV.alas(r, (1.1, 0.1), 0.38, 0.1)
    jam = BA.build_teleband()
    BV.pasang(jam, r, (-1.25, 0.1, 0.5), (math.radians(64), 0, 0), 0.17)
    cin = BA.build_telering()
    BV.pasang(cin, r, (1.1, 0.1, 0.36), (math.radians(70), 0, 0), 0.16)

    def perbarui(t, i):
        d = i / FPS
        hp.layar_ke("perangkat", i)
        jam.rotation_euler = (math.radians(64), 0, math.radians(-20) + math.radians(18) * math.sin(d * 0.9))
        cin.rotation_euler = (math.radians(70), 0, d * 0.9)
        e = mulus(t)
        arahkan(cam, (0.6 - 0.9 * e, -7.0 + 0.4 * e, 1.4), (-0.1, 0, 1.12))
    return 108, perbarui


def ap_peran(sc, cam):
    r = BV.akar("peran")
    daftar = ["p-pasien", "p-dokter", "p-faskes", "p-admin"]
    hps = []
    for k, u in enumerate(daftar):
        a = math.radians(-27 + 18 * k)
        hps.append(Android(r, u, (3.2 * math.sin(a), -3.2 * math.cos(a) + 3.2, 1.2), (0, 0, a), 0.9))

    def perbarui(t, i):
        e = mulus(t)
        for k, h in enumerate(hps):
            h.akar.location.z = 1.2 + 0.04 * math.sin(i / FPS * 1.6 + k)
        arahkan(cam, (-1.2 + 2.4 * e, -6.6, 1.6), (0.0, 0.3, 1.55))
    return 120, perbarui


def ap_tutup(sc, cam):
    r = BV.akar("tutup")
    hp = Android(r, "masuk", (0.75, 0.2, 1.15), (0, 0, math.radians(-16)), 0.85)
    g, nadi = BV.logo_tile(r)
    g.location = (-0.85, 0.3, 1.62)
    g.scale = (0.4,) * 3
    nadi.data.bevel_factor_end = 1.0

    def perbarui(t, i):
        d = i / FPS
        g.rotation_euler = (0, 0, math.radians(8) * math.sin(d * 1.3))
        apung(g, 1.62, d, amp=0.04, putar=0)
        e = mulus(t)
        arahkan(cam, (0, -6.2 + 0.4 * e, 1.4), (0, 0.2, 1.2))
    return 84, perbarui


SHOTS = {
    "buka": ap_buka, "beranda": ap_beranda, "vital": ap_vital, "konsultasi": ap_konsultasi,
    "panggilan": ap_panggilan, "perangkat": ap_perangkat, "peran": ap_peran, "tutup": ap_tutup,
}


def render(nama, fn):
    sc, cam = studio()
    n, perbarui = fn(sc, cam)
    folder = os.path.join(OUT, "ap-" + nama)
    os.makedirs(folder, exist_ok=True)
    if hasattr(sc.render.image_settings, "media_type"):
        sc.render.image_settings.media_type = "IMAGE"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    for i in range(n):
        if i % LANGKAH:
            continue
        sc.render.filepath = os.path.join(folder, "%04d.png" % i)
        if os.path.exists(sc.render.filepath) and os.path.getsize(sc.render.filepath) > 0:
            continue
        perbarui(i / n, i)
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)
    print(">>> shot:", nama, n)


def utama():
    daftar = [(k, f) for k, f in SHOTS.items() if not HANYA or k in HANYA]
    gagal = []
    for nama, fn in daftar:
        try:
            render(nama, fn)
        except Exception as e:
            import traceback
            traceback.print_exc()
            gagal.append((nama, str(e)))
    print(">>> SELESAI_AP total=%d gagal=%d %s" % (len(daftar), len(gagal), gagal))


if __name__ == "__main__":
    utama()
