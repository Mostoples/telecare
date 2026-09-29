# ============================================================
#  TeleCare — generator shot video 3D (Blender 5.x, Cycles)
#
#  Gaya sama dengan ikon: porselen putih + satu aksen, studio lembut,
#  latar transparan (dikomposit ke warna halaman #EEF3F1 oleh ffmpeg
#  agar warnanya persis sama dengan UI neumorfik).
#
#  Tiap shot dirender frame demi frame dari Python (tanpa keyframe):
#  hasilnya deterministik dan loop bisa dibuat mulus secara matematis.
#
#  Jalankan:
#    blender -b -noaudio -P blender/build_video.py -- --root <web>
#            [--hanya hero,logo,...] [--sampel 20] [--skala 100] [--langkah 1]
#
#  Keluaran: build/video/frames/<shot>/0000.png  (RGBA)
# ============================================================
import bpy
import math
import os
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_ikon3d as BI          # material, bentuk, ikon, ponsel
import build_assets as BA          # TeleBand & TeleRing

arg = BI.arg
ROOT = BI.ROOT
OUT = os.path.join(ROOT, "build", "video", "frames")
SHOTS_UI = os.path.join(ROOT, "build", "shots", "ponsel")
SAMPEL = int(arg("--sampel", 20))
SKALA = int(arg("--skala", 100))
LANGKAH = int(arg("--langkah", 1))
HANYA = [x for x in str(arg("--hanya", "")).split(",") if x]
FPS = 24


# ------------------------------------------------------------
#  studio perspektif
# ------------------------------------------------------------
def studio(lebar, tinggi):
    BI.kosongkan()
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
    sc.render.film_transparent = True
    sc.render.resolution_x = lebar
    sc.render.resolution_y = tinggi
    sc.render.resolution_percentage = SKALA
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Punchy"
    except Exception:
        pass
    sc.view_settings.exposure = 0.15
    w = sc.world or bpy.data.worlds.new("dunia")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.84, 0.89, 0.87, 1)
    bg.inputs["Strength"].default_value = 0.6

    def lampu(nama, loc, energi, ukuran, warna=(1, 1, 1)):
        ld = bpy.data.lights.new(nama, "AREA")
        ld.energy, ld.size, ld.color = energi, ukuran, warna
        o = bpy.data.objects.new(nama, ld)
        o.location = loc
        bpy.context.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 0.8)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return o

    lampu("kunci", (-5.0, -6.0, 7.5), 1700, 6.0, (1.0, 0.98, 0.95))
    lampu("isi", (6.5, -4.5, 3.5), 520, 7.0, (0.9, 0.97, 1.0))
    lampu("tepi", (1.5, 7.0, 5.5), 1000, 5.0, (0.82, 1.0, 0.93))

    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    lantai = bpy.context.object
    lantai.name = "penangkap_bayangan"
    lantai.is_shadow_catcher = True

    cd = bpy.data.cameras.new("kam")
    cd.lens = 50
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 4.0
    cam = bpy.data.objects.new("kam", cd)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    return sc, cam


def arahkan(cam, dari, ke, fokus=None):
    cam.location = Vector(dari)
    cam.rotation_euler = (Vector(ke) - Vector(dari)).to_track_quat("-Z", "Y").to_euler()
    cam.data.dof.focus_distance = fokus or (Vector(ke) - Vector(dari)).length


def orbit(pusat, r, sudut, tinggi):
    a = math.radians(sudut)
    return (pusat[0] + r * math.sin(a), pusat[1] - r * math.cos(a), pusat[2] + tinggi)


def mulus(t):
    return t * t * (3 - 2 * t)


def keluar_elastis(t):
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    return 2 ** (-9 * t) * math.sin((t * 9 - 0.75) * (2 * math.pi) / 3.2) + 1


def muncul(t, mulai, durasi=0.35):
    return keluar_elastis(max(0.0, min(1.0, (t - mulai) / durasi)))


def akar(nama):
    o = bpy.data.objects.new(nama, None)
    bpy.context.collection.objects.link(o)
    return o


def pasang(obj, induk, loc=(0, 0, 0), rot=(0, 0, 0), skala=1.0):
    obj.parent = induk
    obj.location = loc
    obj.rotation_euler = rot
    obj.scale = (skala,) * 3
    return obj


def ikon(nama, induk, loc, skala=0.5, rot=(0, 0, 0)):
    BI.PETA.clear()
    BI.PETA.update(BI.PETA_IKON.get(nama, {}))
    S = BI.Susun(nama)
    BI.IKON[nama](S)
    BI.PETA.clear()
    return pasang(S.akar, induk, loc, rot, skala)


def alas(induk, loc, r=1.3, h=0.35):
    """Podium porselen — elemen neumorfik di dunia 3D."""
    o = BI.silinder(r, h, 0.12, 96)
    BI.pakai(o, BI.plastik("podium", "porselen", 0.3, 0.4))
    return pasang(o, induk, (loc[0], loc[1], h / 2))


def cincin(induk, r, loc=(0, 0, 0), rot=(0, 0, 0), tebal=0.014, warna="sage"):
    o = BI.torus(r, tebal, 180, 12)
    BI.pakai(o, BI.plastik("orbit" + warna, warna, 0.3))
    return pasang(o, induk, loc, rot)


# ------------------------------------------------------------
#  ponsel dengan tangkapan UI asli sebagai layar
# ------------------------------------------------------------
_GAMBAR = {}
EMISI_LAYAR = 1.3


def mat_layar(berkas):
    if berkas in _GAMBAR:
        return _GAMBAR[berkas]
    m = bpy.data.materials.new("layar_" + os.path.basename(berkas))
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(berkas, check_existing=True)
    tex.interpolation = "Cubic"
    tex.extension = "EXTEND"
    b.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
    b.inputs["Roughness"].default_value = 0.12
    b.inputs["Coat Weight"].default_value = 0.6
    b.inputs["Coat Roughness"].default_value = 0.04
    b.inputs["Emission Strength"].default_value = EMISI_LAYAR
    nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
    _GAMBAR[berkas] = m
    return m


def ponsel_ui(induk, berkas, loc=(0, 0, 0), rot=(0, 0, 0), skala=1.0):
    """Ponsel porselen 1.0 x 2.16; layar = tangkapan UI 430x932."""
    g = akar("ponsel")
    W, H, T = 1.0, 2.16, 0.1
    badan = BI.bentuk("badan", BI.pola_rrect(W, H, 0.17, 10), T, 0.06, 5)
    BI.pakai(badan, BI.plastik("porselenP", "porselen", 0.22, 0.6))
    badan.parent = g
    lw, lh = W - 0.08, H - 0.08
    bpy.ops.mesh.primitive_plane_add(size=1)
    layar = bpy.context.object
    layar.scale = (lw, lh, 1)
    bpy.ops.object.transform_apply(scale=True)
    layar.rotation_euler = (math.radians(90), 0, 0)
    layar.location = (0, -T - 0.012, 0)
    # sudut membulat lewat bevel pada tepi layar tidak mungkin di plane;
    # cukup dengan rasio 430:932 yang pas dan bingkai porselen tipis.
    BI.pakai(layar, mat_layar(berkas))
    layar.parent = g
    return pasang(g, induk, loc, rot, skala), layar


def ganti_layar(layar, berkas):
    layar.data.materials.clear()
    layar.data.materials.append(mat_layar(berkas))


def ui(nama):
    """Berkas tangkapan ponsel berdasarkan potongan nama (mis. 'pasien-home')."""
    if not os.path.isdir(SHOTS_UI):
        return None
    for f in sorted(os.listdir(SHOTS_UI)):
        if nama in f and f.endswith(".png"):
            return os.path.join(SHOTS_UI, f)
    return None


# ------------------------------------------------------------
#  SHOT — tiap fungsi mengembalikan (frame, ukuran, perbarui(t, i))
# ------------------------------------------------------------
def shot_hero(sc, cam):
    """Loop sempurna 8 detik (persegi) untuk hero situs."""
    r = akar("hero")
    alas(r, (-1.15, 0), 1.25, 0.3)
    alas(r, (1.35, 0.3), 0.95, 0.22)
    jam = BA.build_teleband()
    pasang(jam, r, (-1.15, 0, 1.25), (math.radians(62), 0, 0), 0.62)
    cin = BA.build_telering()
    pasang(cin, r, (1.35, 0.3, 0.95), (math.radians(70), 0, 0), 0.5)
    o1 = cincin(r, 3.1, (0, 0.6, 1.3), (math.radians(80), 0, 0))
    o2 = cincin(r, 3.6, (0, 0.6, 1.3), (math.radians(80), 0, 0), 0.009, "abu")
    ik = [ikon("jantung", r, (-2.2, -0.4, 2.6), 0.34), ikon("oksigen", r, (2.3, 0.2, 2.5), 0.3),
          ikon("stres", r, (0.2, 1.2, 3.1), 0.3)]
    arahkan(cam, (0, -9.6, 3.8), (0.05, 0, 1.25))
    cam.data.lens = 58

    def perbarui(t, i):
        a = 2 * math.pi * t
        jam.rotation_euler = (math.radians(62), 0, math.radians(-18) + math.radians(22) * math.sin(a))
        jam.location.z = 1.25 + 0.08 * math.sin(a)
        cin.rotation_euler = (math.radians(70), 0, a)
        cin.location.z = 0.95 + 0.07 * math.sin(a + 2)
        o1.rotation_euler = (math.radians(80), math.radians(8) * math.sin(a), 0)
        o2.rotation_euler = (math.radians(80), -math.radians(6) * math.sin(a), 0)
        for k, o in enumerate(ik):
            o.location.z = [2.6, 2.5, 3.1][k] + 0.12 * math.sin(a + k * 2.1)
            o.rotation_euler = (0, 0, math.radians(14) * math.sin(a + k))
    return 192, (1080, 1080), perbarui


def logo_tile(induk):
    g = akar("logo")
    t = BI.bentuk("ubin", BI.pola_rrect(2.4, 2.4, 0.72, 12), 0.34, 0.26)
    BI.pakai(t, BI.plastik("ubinhijau", "hijau", 0.28, 0.5))
    t.parent = g
    y = -0.36
    pts = [(-0.82, y, -0.02), (-0.36, y, -0.02), (-0.18, y, 0.5), (0.1, y, -0.62),
           (0.34, y, 0.28), (0.5, y, -0.02), (0.84, y, -0.02)]
    nadi = BI.garis("nadilogo", pts, 0.085)
    nadi.data.bevel_factor_mapping_end = "SPLINE"
    BI.pakai(nadi, BI.plastik("nadiputih", "putih", 0.22))
    nadi.parent = g
    g.parent = induk
    return g, nadi


def shot_logo(sc, cam):
    r = akar("s_logo")
    g, nadi = logo_tile(r)
    g.location = (0, 0, 1.6)
    cincin(r, 2.4, (0, 0.8, 1.6), (math.radians(90), 0, 0))
    arahkan(cam, (0, -8.5, 1.9), (0, 0, 1.6))

    def perbarui(t, i):
        s = muncul(t, 0.0, 0.45)
        g.scale = (s,) * 3
        g.rotation_euler = (0, 0, math.radians(-35) * (1 - mulus(min(1, t * 1.6))) + math.radians(6) * math.sin(t * 3))
        nadi.data.bevel_factor_end = mulus(max(0.0, min(1.0, (t - 0.3) / 0.45)))
        g.location.z = 1.6 + 0.06 * math.sin(t * 6)
    return 84, (1920, 1080), perbarui


def shot_band(sc, cam):
    r = akar("s_band")
    alas(r, (0, 0), 1.6, 0.36)
    jam = BA.build_teleband()
    pasang(jam, r, (0, 0, 1.45), (math.radians(64), 0, 0), 0.85)
    cincin(r, 2.6, (0, 1.0, 1.4), (math.radians(90), 0, 0))

    def perbarui(t, i):
        e = mulus(t)
        arahkan(cam, orbit((0, 0, 0), 9.4 - 1.2 * e, -38 + 60 * e, 2.6 - 0.5 * e), (0, 0, 1.75))
        jam.rotation_euler = (math.radians(64), 0, math.radians(20) * math.sin(t * math.pi * 2))
        jam.location.z = 1.45 + 0.07 * math.sin(t * math.pi * 2)
    return 120, (1920, 1080), perbarui


def shot_ring(sc, cam):
    r = akar("s_ring")
    alas(r, (0, 0), 1.3, 0.3)
    cin = BA.build_telering()
    pasang(cin, r, (0, 0, 1.25), (math.radians(72), 0, 0), 0.9)
    cincin(r, 2.2, (0, 0.9, 1.2), (math.radians(90), 0, 0))
    ikon("oksigen", r, (1.9, 0.4, 2.2), 0.32)
    ikon("jantung", r, (-1.9, 0.4, 2.0), 0.32)

    def perbarui(t, i):
        e = mulus(t)
        arahkan(cam, orbit((0, 0, 0), 6.6 - 0.8 * e, 30 - 50 * e, 1.9 + 0.5 * e), (0, 0, 1.2))
        cin.rotation_euler = (math.radians(72), 0, math.radians(160) * e)
    return 120, (1920, 1080), perbarui


def shot_ikon(sc, cam):
    r = akar("s_ikon")
    nama = ["jantung", "oksigen", "suhu", "tensi", "ekg", "stres", "chat", "video",
            "kalender", "perisai", "makan", "grafik"]
    objs = []
    for k, n in enumerate(nama):
        c, b = k % 6, k // 6
        loc = (-3.2 + c * 1.28, 0.5 * b, 2.3 - b * 1.5)
        objs.append((ikon(n, r, loc, 0.48), loc, k))
    arahkan(cam, (0, -13.5, 2.6), (0, 0.2, 1.55))
    cam.data.lens = 50

    def perbarui(t, i):
        for o, loc, k in objs:
            s = muncul(t, 0.03 * k, 0.4)
            o.scale = (0.48 * s,) * 3
            o.rotation_euler = (0, 0, math.radians(-24) + math.radians(18) * math.sin(t * 5 + k))
            o.location.z = loc[2] + 0.06 * math.sin(t * 6 + k * 0.8)
    return 120, (1920, 1080), perbarui


def shot_ponsel(sc, cam):
    r = akar("s_ponsel")
    layar_ui = [ui("pasien-home"), ui("pasien-vital-hr"), ui("pasien-analisis")]
    layar_ui = [x for x in layar_ui if x]
    ph, layar = ponsel_ui(r, layar_ui[0], (0, 0, 1.55), (0, 0, 0), 1.25)
    ikon_ = [ikon("jantung", r, (-1.75, 0.3, 2.5), 0.36), ikon("oksigen", r, (1.8, 0.4, 2.3), 0.32),
             ikon("grafik", r, (1.6, 0.6, 0.55), 0.34)]
    jam = BA.build_teleband()
    pasang(jam, r, (-1.7, -0.2, 0.62), (math.radians(64), 0, math.radians(20)), 0.42)
    arahkan(cam, (0, -8.6, 2.1), (0, 0, 1.55))

    def perbarui(t, i):
        e = mulus(t)
        ph.rotation_euler = (math.radians(4), 0, math.radians(-32) * (1 - e) + math.radians(6) * math.sin(t * 4))
        idx = min(len(layar_ui) - 1, int(t * len(layar_ui)))
        ganti_layar(layar, layar_ui[idx])
        for k, o in enumerate(ikon_):
            o.location.z = [2.5, 2.3, 0.55][k] + 0.08 * math.sin(t * 6 + k)
            o.rotation_euler = (0, 0, math.radians(15) * math.sin(t * 4 + k))
    return 144, (1920, 1080), perbarui


def shot_hub(sc, cam):
    r = akar("s_hub")
    S = BI.Susun("hub")
    BI.il_hub(S)
    S.akar.parent = r
    S.akar.location = (0, 0, 0.3)

    def perbarui(t, i):
        e = mulus(t)
        arahkan(cam, orbit((0, 0, 0), 10.5, -25 + 45 * e, 3.3), (0, 0, 1.5))
    return 120, (1920, 1080), perbarui


def shot_konsultasi(sc, cam):
    r = akar("s_kons")
    layar_ui = [x for x in (ui("pasien-chat"), ui("pasien-dokter"), ui("pasien-call")) if x]
    ph, layar = ponsel_ui(r, layar_ui[0], (-0.4, 0, 1.55), (0, 0, math.radians(12)), 1.2)
    dok = ikon("dokter", r, (1.75, 0.4, 0.3), 0.7)
    ch = ikon("chat", r, (1.55, 0.1, 2.5), 0.42)
    vd = ikon("video", r, (-2.2, 0.3, 2.3), 0.36)
    ikon("stetoskop", r, (-2.1, -0.1, 0.35), 0.44)
    arahkan(cam, (0.3, -8.8, 2.3), (0, 0, 1.45))

    def perbarui(t, i):
        idx = min(len(layar_ui) - 1, int(t * len(layar_ui)))
        ganti_layar(layar, layar_ui[idx])
        ph.rotation_euler = (0, 0, math.radians(12) - math.radians(18) * mulus(t))
        ch.scale = (0.42 * muncul(t, 0.15, 0.4),) * 3
        vd.scale = (0.36 * muncul(t, 0.4, 0.4),) * 3
        ch.location.z = 2.5 + 0.08 * math.sin(t * 7)
        dok.rotation_euler = (0, 0, math.radians(-20) + math.radians(8) * math.sin(t * 5))
    return 120, (1920, 1080), perbarui


def shot_akhir(sc, cam):
    r = akar("s_akhir")
    g, nadi = logo_tile(r)
    g.location = (0, 1.6, 2.2)
    g.scale = (0.62,) * 3
    alas(r, (-2.3, -0.4), 1.0, 0.26)
    alas(r, (2.3, -0.4), 0.85, 0.2)
    jam = BA.build_teleband()
    pasang(jam, r, (-2.3, -0.4, 0.98), (math.radians(62), 0, 0), 0.5)
    cin = BA.build_telering()
    pasang(cin, r, (2.3, -0.4, 0.78), (math.radians(70), 0, 0), 0.42)
    cincin(r, 3.4, (0, 1.2, 1.6), (math.radians(90), 0, 0))
    arahkan(cam, (0, -11.5, 2.8), (0, 0, 1.55))

    def perbarui(t, i):
        e = mulus(t)
        nadi.data.bevel_factor_end = 1.0
        g.rotation_euler = (0, 0, math.radians(8) * math.sin(t * 4))
        jam.rotation_euler = (math.radians(62), 0, math.radians(-30) + math.radians(40) * e)
        cin.rotation_euler = (math.radians(70), 0, math.radians(200) * e)
        cam.location.y = -11.5 + 0.9 * e
    return 96, (1920, 1080), perbarui


def kapsul(panjang=1.4, r=0.32, warna=("porselen", "hijau")):
    """Kapsul obat dua warna (dua silinder + dua bola)."""
    g = akar("kapsul")
    for k, (w, arah) in enumerate(((warna[0], 1), (warna[1], -1))):
        c = BI.silinder(r, panjang / 2, 0, 64)
        BI.pakai(c, BI.plastik("kap" + w, w, 0.22, 0.6))
        pasang(c, g, (0, 0, arah * panjang / 4))
        b = BI.bola(r)
        BI.pakai(b, BI.plastik("kap" + w, w, 0.22, 0.6))
        pasang(b, g, (0, 0, arah * panjang / 2))
    return g


def salib(r=0.5, warna="porselen"):
    o = BI.bentuk("salib", BI.pola_salib(0.3 * r, r), 0.16 * r, 0.12 * r)
    BI.pakai(o, BI.plastik("sal" + warna, warna, 0.22, 0.6))
    return o


def shot_dekor(sc, cam):
    """Loop 4 dtk: benda porselen melayang mengitari pusat (untuk latar)."""
    r = akar("s_dekor")
    benda = []
    bpy.data.objects["penangkap_bayangan"].hide_render = True   # tanpa bayangan lantai (terpotong di tepi)
    rencana = [("kapsul", 2.2, 0.0, 2.3, 0.0), ("salib", 2.2, 1.05, 1.2, 0.7), ("torus", 2.3, 2.1, 3.0, 1.9),
               ("bola", 1.6, 3.15, 1.6, 2.8), ("salibh", 2.3, 4.2, 2.6, 3.6), ("kapsul2", 1.9, 5.25, 1.3, 4.4)]
    for nama, rad, fase, tinggi, rotf in rencana:
        if nama.startswith("kapsul"):
            o = kapsul(1.3, 0.3, ("porselen", "hijau") if nama == "kapsul" else ("sage", "porselen"))
            o.parent = r
        elif nama.startswith("salib"):
            o = salib(0.55, "hijau" if nama == "salibh" else "porselen")
            o.parent = r
        elif nama == "torus":
            o = BI.torus(0.42, 0.14)
            BI.pakai(o, BI.plastik("dtor", "porselen", 0.22, 0.6))
            o.parent = r
        else:
            o = BI.bola(0.28)
            BI.pakai(o, BI.plastik("dbola", "sage", 0.25, 0.5))
            o.parent = r
        benda.append((o, rad, fase, tinggi, rotf))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 7.2
    cam.data.dof.use_dof = False
    arahkan(cam, (0, -20, 12), (0, 0, 1.9))

    def perbarui(t, i):
        a = 2 * math.pi * t
        for o, rad, fase, tinggi, rotf in benda:
            o.location = (rad * math.cos(a + fase), rad * math.sin(a + fase) * 0.5, tinggi + 0.25 * math.sin(2 * a + fase))
            o.rotation_euler = (a + rotf, 0.6 * math.sin(a + rotf), a * 0 + rotf)
    return 48, (720, 720), perbarui


def shot_pola(sc, cam):
    """Ubin mulus 4x4: salib & titik porselen berputar bergelombang, dilihat dari atas."""
    r = akar("s_pola")
    sel = 1.0
    isi = []
    for gx in range(4):
        for gy in range(4):
            x, y = (gx - 1.5) * sel, (gy - 1.5) * sel
            if (gx + gy) % 2 == 0:
                o = salib(0.2, "porselen")
                o.rotation_euler = (math.radians(-90), 0, 0)
            else:
                o = BI.bola(0.07)
                BI.pakai(o, BI.plastik("pbola", "sage", 0.25, 0.5))
            o.parent = r
            o.location = (x, y, 0.18)
            isi.append((o, gx, gy))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 4 * sel
    cam.data.dof.use_dof = False
    cam.location = (0, 0, 20)
    cam.rotation_euler = (0, 0, 0)
    # cahaya dari atas agar bayangan pendek dan tidak melewati batas ubin
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.name == "kunci":
            o.location = (-1.0, -1.2, 9.0)
            o.rotation_euler = (Vector((0, 0, 0)) - o.location).to_track_quat("-Z", "Y").to_euler()

    def perbarui(t, i):
        a = 2 * math.pi * t
        for o, gx, gy in isi:
            fase = (gx + gy) * math.pi / 4
            o.location.z = 0.18 + 0.08 * math.sin(a + fase)
            if o.name.startswith("salib"):
                o.rotation_euler = (math.radians(-90), 0, math.radians(90) * t + 0.15 * math.sin(a + fase))
    return 48, (480, 480), perbarui


SHOTS = {
    "hero": shot_hero, "logo": shot_logo, "band": shot_band, "ring": shot_ring,
    "ikon": shot_ikon, "ponsel": shot_ponsel, "hub": shot_hub,
    "konsultasi": shot_konsultasi, "akhir": shot_akhir,
    "dekor": shot_dekor, "pola": shot_pola,
}


def render_shot(nama, fn):
    sc, cam = studio(1920, 1080)
    n, (w, h), perbarui = fn(sc, cam)
    sc.render.resolution_x, sc.render.resolution_y = w, h
    folder = os.path.join(OUT, nama)
    os.makedirs(folder, exist_ok=True)
    if hasattr(sc.render.image_settings, "media_type"):
        sc.render.image_settings.media_type = "IMAGE"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    for i in range(0, n, LANGKAH):
        perbarui(i / n, i)
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(folder, "%04d.png" % i)
        if os.path.exists(sc.render.filepath) and os.path.getsize(sc.render.filepath) > 0:
            continue
        bpy.ops.render.render(write_still=True)
    print(">>> shot:", nama, n, "frame", w, "x", h)


def utama():
    daftar = [(k, f) for k, f in SHOTS.items() if not HANYA or k in HANYA]
    gagal = []
    for nama, fn in daftar:
        try:
            render_shot(nama, fn)
        except Exception as e:
            import traceback
            traceback.print_exc()
            gagal.append((nama, str(e)))
    print(">>> SELESAI_VIDEO total=%d gagal=%d %s" % (len(daftar), len(gagal), gagal))


if __name__ == "__main__":
    utama()
