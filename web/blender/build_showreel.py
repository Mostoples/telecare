# ============================================================
#  TeleCare — showreel sinematik (Blender 5.x, Cycles)
#
#  Bahasa sinematik mengikuti film RePulse (narasi sehari-hari, manusia
#  3D MakeHuman, kamera dolly pelan, DOF dangkal, cahaya praktis) tetapi
#  TERANG: pagi/siang, sinar matahari lewat jendela (gobo), putih bersih.
#
#  Jalankan:
#    blender -b -noaudio -P blender/build_showreel.py -- --root <web>
#            [--hanya pembuka,pagi,...] [--sampel 48] [--skala 100] [--langkah 1]
#  Keluaran: build/video/frames/sr-<shot>/0000.png  (RGB, opak)
# ============================================================
import bpy
import math
import os
import sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_ikon3d as BI      # noqa: E402
import build_assets as BA      # noqa: E402
import build_video as BV       # noqa: E402
import build_usecase as BU     # noqa: E402
import manusia as MN           # noqa: E402

arg = BI.arg
ROOT = BI.ROOT
OUT = os.path.join(ROOT, "build", "video", "frames")
SAMPEL = int(arg("--sampel", 48))
SKALA = int(arg("--skala", 100))
LANGKAH = int(arg("--langkah", 1))
HANYA = [x for x in str(arg("--hanya", "")).split(",") if x]
mulus, arahkan = BV.mulus, BV.arahkan


# ------------------------------------------------------------
#  studio sinematik terang
# ------------------------------------------------------------
ARAH_MATAHARI = Vector((0.85, 0.25, -0.30)).normalized()   # cahaya masuk dari jendela di dinding kiri


def studio(ruangan=True, matahari=None, kekuatan=5.0):
    BI.kosongkan()
    BI._MAT.clear()
    BV._GAMBAR.clear()
    for blk in (bpy.data.materials, bpy.data.images, bpy.data.meshes, bpy.data.armatures):
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
    sc.cycles.max_bounces = 8
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    sc.render.resolution_percentage = SKALA
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 0.0
    BV.EMISI_LAYAR = 1.9

    w = sc.world or bpy.data.worlds.new("dunia")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = BI.hx("#DCE8F0")
    bg.inputs["Strength"].default_value = 0.45

    # matahari pagi yang hangat, bayangan tegas
    ld = bpy.data.lights.new("matahari", "SUN")
    ld.energy = kekuatan
    ld.angle = math.radians(1.2)
    ld.color = (1.0, 0.9, 0.78)
    sun = bpy.data.objects.new("matahari", ld)
    sc.collection.objects.link(sun)
    sun.rotation_euler = ARAH_MATAHARI.to_track_quat("-Z", "Y").to_euler()
    # isian lembut dari sisi kamera
    BU.lampu("isi", (1.5, -4.5, 2.6), 180, 6.0, (0.92, 0.97, 1.0), (0, 0.5, 1.0))

    if ruangan:
        BU.kotak_ruang((14, 14, 0.02), (0, 0, -0.01), "#D8CFC4", 0.55)        # lantai kayu muda
        BU.kotak_ruang((14, 0.1, 6), (0, 3.2, 3.0), "#EEF1EE", 0.9)           # dinding belakang
        dinding_berjendela(-3.4)

    cd = bpy.data.cameras.new("kam")
    cd.lens = 40
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 2.0
    cd.clip_start = 0.01
    cam = bpy.data.objects.new("kam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return sc, cam


def dinding_berjendela(x, y0=-0.6, y1=2.2, z0=1.05, z1=2.85, kol=3, t=0.06):
    """Dinding kiri dengan bukaan jendela + palang; matahari masuk lewat sini sehingga
    pola jendela jatuh ke lantai, ranjang, dan tokoh."""
    warna = "#E9EEEB"
    L, T = 14.0, 6.0

    def blok(y_a, y_b, z_a, z_b, hexw=warna, tebal=0.12):
        BU.kotak_ruang((tebal, y_b - y_a, z_b - z_a), (x, (y_a + y_b) / 2, (z_a + z_b) / 2), hexw, 0.9)

    blok(-L / 2, y0, 0, T)          # kiri bukaan
    blok(y1, L / 2, 0, T)           # kanan bukaan
    blok(y0, y1, 0, z0)             # bawah (ambang)
    blok(y0, y1, z1, T)             # atas
    for i in range(1, kol):         # palang vertikal
        yy = y0 + i * (y1 - y0) / kol
        blok(yy - t / 2, yy + t / 2, z0, z1, "#F4F6F5", 0.08)
    zm = (z0 + z1) / 2              # palang horizontal
    blok(y0, y1, zm - t / 2, zm + t / 2, "#F4F6F5", 0.08)


def seamless(warna="#EEF2F4"):
    """Latar studio lengkung tanpa sambungan (cyclorama) untuk reveal produk."""
    import bmesh
    bm = bmesh.new()
    prof = [(-6.0, 0.0), (2.0, 0.0)]
    R = 2.5
    for d in range(10, 91, 10):
        a = math.radians(d)
        prof.append((2.0 + R * math.sin(a), R * (1 - math.cos(a))))
    prof.append((2.0 + R, 9.0))
    kiri = [bm.verts.new((-20, y, z)) for y, z in prof]
    kanan = [bm.verts.new((20, y, z)) for y, z in prof]
    for i in range(len(prof) - 1):
        bm.faces.new((kiri[i], kanan[i], kanan[i + 1], kiri[i + 1]))
    me = bpy.data.meshes.new("cyc")
    bm.to_mesh(me)
    bm.free()
    for pl in me.polygons:
        pl.use_smooth = True
    o = bpy.data.objects.new("cyc", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(BU.mat_warna("cyc", warna, 0.75))
    return o


def ui(nama):
    return BU.ui(nama)


def tinggi_panggul(rig):
    p, _ = MN.titik_tulang(rig, "upperleg01.L", 0)
    return p.z


def layar_menurut(layar, i, batas, a, b):
    """Pilih tekstur layar dari nomor frame (aman bila render dilanjutkan dari tengah)."""
    BV.ganti_layar(layar, ui(b) if i >= batas else ui(a))


# ------------------------------------------------------------
#  SHOT
# ------------------------------------------------------------
def sh_pembuka(sc, cam):
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    seamless()
    r = BV.akar("pembuka")
    g, nadi = BV.logo_tile(r)
    g.location = (0, 0.6, 1.6)
    cam.data.dof.aperture_fstop = 4
    cam.data.lens = 50

    def perbarui(t, i):
        s = BV.muncul(t, 0.0, 0.5) * 0.62
        g.scale = (s,) * 3
        arahkan(cam, (0, -10.5 + 0.8 * mulus(t), 1.9), (0, 0.6, 1.55))
        g.rotation_euler = (0, 0, math.radians(-40) * (1 - mulus(min(1, t * 1.5))))
        nadi.data.bevel_factor_end = mulus(max(0.0, min(1.0, (t - 0.28) / 0.45)))
    return 84, perbarui


def kamar(r):
    BU.impor("ranjang", 2.2, (-1.1, 1.6, 0), 0.0, sumbu="panjang", campur=0.45)
    BU.impor("tanaman", 1.1, (1.9, 2.4, 0), ambil=["Pot_4_"])
    BU.meja_nakas(r, (0.55, 2.2), 0.55)
    BU.impor("lampu", 0.46, (0.55, 2.25, 0.55), campur=0.4)
    BU.ponsel_datar(r, ui("pasien-home"), (0.42, 2.05, 0.556), math.radians(15))


def sh_pagi(sc, cam):
    """Berdiri di samping ranjang: diam bernapas → mengangkat pergelangan → membaca TeleBand
    (fokus berpindah dari wajah ke layar jam) → kepala kembali terangkat."""
    r = BV.akar("pagi")
    kamar(r)
    rig, badan = MN.buat_manusia(pakaian="male_casualsuit04", warna_baju="#E8EEEC")
    rig.location = (0.05, 0.9, 0)
    rig.rotation_euler = (0, 0, math.radians(-20))
    MN.pose_lihat_jam(rig, 0.0)
    band = MN.jam_pergelangan(rig, "L", 0.93)
    cam.data.dof.aperture_fstop = 2.4

    def perbarui(t, i):
        d = i / BV.FPS
        angkat = mulus(max(0.0, min(1.0, (d - 0.9) / 1.5)))
        lihat = angkat * (1 - 0.55 * mulus(max(0.0, min(1.0, (d - 4.1) / 0.7))))
        MN.pose_lihat_jam(rig, angkat, lihat)
        MN.hidup(rig, d)
        e = mulus(t)
        dari = Vector((1.7 - 0.5 * e, -1.9 + 0.7 * e, 1.45 - 0.05 * e))
        kepala, _ = MN.titik_tulang(rig, "head", 0.5)
        layar = MN.titik_layar(band)
        tuju = kepala.lerp(layar, 0.35 + 0.4 * angkat)
        fokus = kepala.lerp(layar, mulus(max(0.0, min(1.0, (d - 2.0) / 0.8))) * (1 - 0.6 * mulus(max(0.0, min(1.0, (d - 4.2) / 0.6)))))
        cam.data.lens = 40 + 18 * e
        arahkan(cam, dari, tuju, (fokus - dari).length)
    return 120, perbarui


def sh_pergelangan(sc, cam):
    """Makro TeleBand: pergelangan bergerak halus (napas, sedikit memutar), fokus TERKUNCI
    ke layar jam setiap frame sehingga layar selalu tajam."""
    r = BV.akar("pergelangan")
    kamar(r)
    rig, badan = MN.buat_manusia(pakaian="male_casualsuit04", warna_baju="#E8EEEC")
    rig.location = (0.05, 0.9, 0)
    rig.rotation_euler = (0, 0, math.radians(-20))
    MN.pose_lihat_jam(rig, 1.0)
    band = MN.jam_pergelangan(rig, "L", 0.93)
    cam.data.dof.aperture_fstop = 2.8
    cam.data.lens = 85
    MN.pose_lihat_jam(rig, 1.0)
    pusat0 = MN.titik_layar(band)

    def perbarui(t, i):
        d = i / BV.FPS
        MN.pose_lihat_jam(rig, 1.0)
        MN.bend(rig, "lowerarm02.L", 7 * math.sin(2 * math.pi * d / 3.2), "Y")   # memutar pergelangan pelan
        MN.bend(rig, "wrist.L", 4 * math.sin(2 * math.pi * d / 2.6 + 0.8))
        MN.hidup(rig, d, kuat=0.7)
        layar = MN.titik_layar(band)
        e = mulus(t)
        a = math.radians(-60 + 55 * e)
        dari = pusat0 + Vector((0.40 * math.cos(a), 0.40 * math.sin(a) - 0.1, 0.17 - 0.04 * e))
        arahkan(cam, dari, layar, (layar - dari).length)
    return 96, perbarui


def sh_aplikasi(sc, cam):
    r = BV.akar("aplikasi")
    meja, _ = BU.impor("meja", 0.76, (0, 0.8, 0), math.radians(90), buang=["Cell_phone"], campur=0.5)
    atas = BU.puncak(meja, "Paper") or 0.76
    BU.impor("mug", 0.1, (0.62, 0.62, atas), campur=0.35)
    BU.impor("tanaman", 0.5, (-0.7, 0.95, atas), ambil=["Pot_1_"])
    ph, layar = BU.ponsel_datar(r, ui("pasien-home"), (0.22, 0.6, atas + 0.006), math.radians(-12))
    telr = BU.telering(r, (0.46, 0.52, atas + 0.011), (0, 0, 0))
    fokus = Vector((0.22, 0.6, atas))
    cam.data.dof.aperture_fstop = 2.2

    def perbarui(t, i):
        e = mulus(t)
        cam.data.lens = 45 + 10 * e
        arahkan(cam, (0.05 + 0.1 * e, 0.12 + 0.12 * e, atas + 0.62 - 0.12 * e), fokus)
        layar_menurut(layar, i, 60, "pasien-home", "pasien-vital-hr")
    return 108, perbarui


def sh_kerja(sc, cam):
    """Duduk mengetik; di tengah shot melirik ke ponsel (peringatan stres)."""
    r = BV.akar("kerja")
    meja, _ = BU.impor("meja", 0.76, (0, 0.8, 0), math.radians(90), buang=["Cell_phone"], campur=0.5)
    atas = BU.puncak(meja, "Paper") or 0.76
    ph, layar = BU.ponsel_datar(r, ui("pasien-analisis"), (0.42, 0.62, atas + 0.006), math.radians(-18))
    rig, badan = MN.buat_manusia(pakaian="male_casualsuit04", warna_baju="#DCE6EA")
    rig.rotation_euler = (0, 0, math.radians(180))       # menghadap meja (+Y)
    MN.pose_duduk_meja(rig)
    band = MN.jam_pergelangan(rig, "L", 0.93)
    bpy.context.view_layer.update()
    rig.location.z += 0.50 - tinggi_panggul(rig)
    rig.location.y = 0.05
    duduk = BI.kotak((0.46, 0.44, 0.06), 0.02, 3)
    BI.pakai(duduk, BU.mat_warna("kursi", "#F2F4F3", 0.5))
    duduk.location = (0, 0.02, 0.44)
    kaki = BI.silinder(0.03, 0.44, 0, 24)
    BI.pakai(kaki, BU.mat_warna("kaki", "#B9C1C3", 0.3))
    kaki.location = (0, 0.02, 0.22)
    cam.data.dof.aperture_fstop = 2.8

    def perbarui(t, i):
        d = i / BV.FPS
        lirik = mulus(max(0.0, min(1.0, (d - 1.9) / 0.5))) * (1 - mulus(max(0.0, min(1.0, (d - 3.6) / 0.5))))
        MN.pose_duduk_meja(rig)
        MN.mengetik(rig, d * (1 - 0.8 * lirik), lirik)
        MN.hidup(rig, d, kuat=0.8)
        e = mulus(t)
        cam.data.lens = 35 + 8 * e
        kepala, _ = MN.titik_tulang(rig, "head", 0.3)
        hp = Vector((0.42, 0.62, atas))
        tuju = kepala.lerp(hp, 0.55)
        dari = Vector((1.55 - 0.35 * e, -0.9 + 0.35 * e, 1.35))
        fokus = kepala.lerp(hp, 0.3 + 0.5 * lirik)
        arahkan(cam, dari, tuju, (fokus - dari).length)
    return 108, perbarui


def sh_sistem(sc, cam):
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    seamless()
    r = BV.akar("sistem")
    # TeleBand di atas "pergelangan" porselen
    lengan = BI.silinder(0.34, 1.3, 0.1, 64)
    BI.pakai(lengan, BI.plastik("porselen", "porselen", 0.3, 0.4))
    lengan.rotation_euler = (0, math.radians(90), 0)
    lengan.scale = (1, 0.8, 1)
    lengan.location = (-1.75, 0.4, 0.3)
    band = MN.bangun_band(Matrix.Translation((-1.75, 0.4, 0.3)) @ Matrix.Rotation(math.radians(-90), 4, "Z"),
                          rx=0.036, rz=0.029, lebar=0.024, skala=10.0)
    cin = BA.build_telering()
    BV.pasang(cin, r, (0.0, 0.4, 0.62), (math.radians(70), 0, 0), 0.55)
    BV.alas(r, (0.0, 0.4), 0.8, 0.12)
    ph, layar = BV.ponsel_ui(r, ui("pasien-home"), (1.7, 0.4, 1.12), (0, 0, math.radians(-10)), 1.0)
    objs = [lengan, band, cin, ph]
    cam.data.dof.aperture_fstop = 5.6
    cam.data.lens = 50

    def perbarui(t, i):
        e = mulus(t)
        for k, o in enumerate(objs):
            s = BV.muncul(t, 0.08 + 0.12 * k, 0.4)
            o.hide_render = s <= 0.001
        cin.rotation_euler = (math.radians(70), 0, math.radians(120) * e)
        arahkan(cam, (0.5 - 0.9 * e, -7.2 + 0.9 * e, 2.1), (0, 0.4, 0.75))
    return 120, perbarui


def sh_konsultasi(sc, cam):
    """Duduk di kursi, video call di ponsel; mengangguk dan bergestur mendengarkan dokter."""
    r = BV.akar("konsultasi")
    BU.impor("kursi", 0.9, (0, 1.0, 0), 0.0, ambil=["Armchair_07_"])
    BU.impor("tanaman", 1.3, (-1.1, 1.6, 0), ambil=["Pot_4_"])
    BU.meja_nakas(r, (0.0, 0.25), 0.5)
    ph, layar = BV.ponsel_ui(r, ui("pasien-call"), (0.0, 0.2, 0.5 + 0.09), (math.radians(-12), 0, math.radians(180)),
                             BU.S_PONSEL)
    rig, badan = MN.buat_manusia(pakaian="male_casualsuit04", warna_baju="#E8EEEC")
    MN.pose_duduk_meja(rig)
    MN.jam_pergelangan(rig, "L", 0.93)
    bpy.context.view_layer.update()
    rig.location = (0, 0.95, 0)
    rig.location.z += 0.48 - tinggi_panggul(rig)
    cam.data.dof.aperture_fstop = 2.2
    cam.data.lens = 50

    def perbarui(t, i):
        d = i / BV.FPS
        MN.pose_duduk_meja(rig)
        MN.mengangguk(rig, d)
        MN.hidup(rig, d, kuat=0.9)
        e = mulus(t)
        tuju = Vector((0.0, 0.2, 0.6))
        dari = Vector((0.45 - 0.08 * e, 1.38 - 0.1 * e, 1.78 - 0.08 * e))
        arahkan(cam, dari, tuju, (tuju - dari).length)
        layar_menurut(layar, i, 60, "pasien-call", "pasien-chat")
    return 108, perbarui


def sh_penutup(sc, cam):
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    seamless()
    r = BV.akar("penutup")
    g, nadi = BV.logo_tile(r)
    g.location = (0, 0.6, 1.9)
    g.scale = (0.55,) * 3
    nadi.data.bevel_factor_end = 1.0
    cam.data.dof.aperture_fstop = 4
    cam.data.lens = 55

    def perbarui(t, i):
        e = mulus(t)
        g.rotation_euler = (0, 0, math.radians(10) * math.sin(t * 3))
        arahkan(cam, (0, -9.0 + 0.7 * e, 2.0), (0, 0.6, 1.45))
    return 84, perbarui


SHOTS = {
    "pembuka": sh_pembuka, "pagi": sh_pagi, "pergelangan": sh_pergelangan,
    "aplikasi": sh_aplikasi, "kerja": sh_kerja, "sistem": sh_sistem,
    "konsultasi": sh_konsultasi, "penutup": sh_penutup,
}


def render(nama, fn):
    ruang = nama not in ("pembuka", "sistem", "penutup")
    sc, cam = studio(ruangan=ruang)
    n, perbarui = fn(sc, cam)
    folder = os.path.join(OUT, "sr-" + nama)
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
    print(">>> SELESAI_SR total=%d gagal=%d %s" % (len(daftar), len(gagal), gagal))


if __name__ == "__main__":
    utama()
