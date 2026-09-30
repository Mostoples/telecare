# ============================================================
#  TeleCare — generator ikon & ilustrasi 3D (Blender 5.x, Cycles)
#
#  Gaya: "soft plastic" — bentuk bervolume dengan tepi membulat, material
#  plastik lembut ber-clear-coat, cahaya studio, bayangan kontak halus di
#  atas penangkap bayangan transparan. Semua dirender dengan kamera
#  ortografis yang dibingkai otomatis sehingga ukuran dan sudut konsisten.
#
#  Jalankan:
#    blender -b -noaudio -P blender/build_ikon3d.py -- --root <web> [--hanya jantung,oksigen]
#                                                     [--ilustrasi] [--sampel 96]
#                                                     [--anim --frame 32]  (loop ikon → build/anim-ikon)
#
#  Keluaran: assets/3d/ikon/<nama>.webp  (512 px, transparan)
#            assets/3d/ilustrasi/<nama>.webp
# ============================================================
import bpy
import math
import os
import sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(nama, bawaan=None):
    if nama in ARGS:
        i = ARGS.index(nama)
        if i + 1 < len(ARGS) and not ARGS[i + 1].startswith("--"):
            return ARGS[i + 1]
        return True
    return bawaan


ROOT = arg("--root", os.path.dirname(HERE))
# --aksen biru: set warna biru (tema bawaan aplikasi) ke assets/3d/biru/...;
# tanpa flag (hijau) tetap di assets/3d/... seperti sebelumnya.
AKSEN = str(arg("--aksen", "hijau"))
_BASIS3D = os.path.join(ROOT, "assets", "3d") if AKSEN == "hijau" else os.path.join(ROOT, "assets", "3d", AKSEN)
OUT_IKON = os.path.join(_BASIS3D, "ikon")
OUT_ILUS = os.path.join(_BASIS3D, "ilustrasi")
SAMPEL = int(arg("--sampel", 96))
HANYA = [x for x in str(arg("--hanya", "")).split(",") if x]
for d in (OUT_IKON, OUT_ILUS):
    os.makedirs(d, exist_ok=True)


# ------------------------------------------------------------
#  warna (sRGB → linear)
# ------------------------------------------------------------
def hx(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (lin[0], lin[1], lin[2], a)


P = {
    "hijau": "#049A5B", "hijau2": "#28B87A", "mint": "#6FD3A6", "mintpucat": "#D6F2E3",
    "biru": "#0E7FB8", "biru2": "#5FB4E6", "koral": "#E8574A", "koral2": "#FF8A7A",
    "amber": "#EDA31E", "kuning": "#F6C552", "ungu": "#7465EA", "ungu2": "#A99BFF",
    "putih": "#F4F8F6", "abu": "#D9E3DF", "tinta": "#15302A", "gelap": "#0E2520",
    "logam": "#B8C2C0",
    # gaya "elegan": porselen putih + satu aksen per ikon
    "porselen": "#F6F8F7", "grafit": "#3A4845", "emas": "#D8B067", "sage": "#A8D9C1",
}

# Peta warna per ikon (gaya elegan). Badan berwarna diganti porselen putih dan
# detail putih mengambil warna aksen, sehingga seluruh set terasa satu keluarga:
# bersih, putih, dengan satu sentuhan warna. Ikon yang tidak tercantum dipakai
# apa adanya (produk TeleBand/TeleRing tetap berwarna aslinya).
PETA_IKON = {
    "jantung": {"koral": "porselen", "putih": "koral"},
    "oksigen": {"biru2": "porselen", "putih": "biru"},
    "tensi": {"ungu": "porselen", "putih": "porselen"},
    "ekg": {"gelap": "porselen", "mint": "hijau"},
    "stres": {"ungu2": "porselen", "putih": "ungu2"},
    "stetoskop": {"biru": "grafit"},
    "chat": {"hijau2": "porselen", "putih": "hijau"},
    "video": {"biru": "porselen", "biru2": "hijau"},
    "kalender": {"koral": "hijau", "putih": "porselen"},
    "perisai": {"hijau": "porselen", "putih": "hijau"},
    "lonceng": {"kuning": "porselen", "amber": "emas"},
    "grafik": {"mint": "porselen", "biru2": "sage", "putih": "porselen"},
    "tujuan": {"koral": "hijau", "putih": "porselen"},
    "gedung": {"putih": "porselen"},
    "pengguna": {"mint": "sage", "mintpucat": "porselen"},
    "dokter": {"putih": "porselen", "biru": "grafit"},
    "gerigi": {"amber": "porselen", "putih": "hijau"},
    "awan": {"putih": "porselen"},
    "bluetooth": {"biru": "porselen", "putih": "biru"},
    "suhu": {"putih": "porselen"},
    "makan": {"putih": "porselen"},
}
PETA = {}
# Gaya bawaan kini "warna" (plastik mengilap berwarna, selaras UI AQUENT-style);
# "--gaya porselen" memakai PETA_IKON di atas.
GAYA = str(arg("--gaya", "aqua"))
if GAYA != "porselen":
    PETA_IKON = {}

_MAT = {}


# gaya "aqua" (resep AQUENT): duotone merek + putih, sangat mengilap
AQ_MEREK = {"hijau", "hijau2", "mint", "biru", "biru2", "koral", "koral2", "ungu", "ungu2",
            "amber", "kuning", "sage"}
AQ_PUTIH = {"putih", "porselen", "mintpucat", "abu"}
AQ = {"dalam": "#02714A", "merek": "#0FAE72", "muda": "#2FD99A", "es": "#DDF5EA",
      "putih": "#F4F8F6", "tinta": "#0B3B2C"}
if AKSEN == "biru":
    AQ = {"dalam": "#1646D6", "merek": "#2F7BFF", "muda": "#8CC6FF", "es": "#DDEBFF",
          "putih": "#F4F7FC", "tinta": "#0D1B3E"}


def _aqua(nama, warna):
    """Material gaya aqua; None bila warna tidak dipetakan (dipakai apa adanya)."""
    if warna in AQ_MEREK:
        return mat_gradien("aq_merek", AQ["dalam"], AQ["muda"], 0.16, 1.0)
    if warna in AQ_PUTIH:
        key = ("aq_putih",)
        if key not in _MAT:
            _MAT[key] = plastik_dasar("aq_putih", AQ["putih"], 0.28, 0.4)
        return _MAT[key]
    if warna in ("tinta", "gelap"):
        key = ("aq_tinta",)
        if key not in _MAT:
            _MAT[key] = plastik_dasar("aq_tinta", AQ["tinta"], 0.14, 1.0)
        return _MAT[key]
    return None


def plastik_dasar(nama, hexw, kasar, coat, logam=0.0):
    m = bpy.data.materials.new("ik_" + nama)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hx(hexw)
    b.inputs["Roughness"].default_value = kasar
    b.inputs["Metallic"].default_value = logam
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.04
    return m


def mat_gradien(nama, bawah, atas, kasar, coat):
    key = ("grad", nama)
    if key in _MAT:
        return _MAT[key]
    m = plastik_dasar(nama, atas, kasar, coat)
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hx(bawah)
    ramp.color_ramp.elements[1].color = hx(atas)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    _MAT[key] = m
    return m


def plastik(nama, warna, kasar=0.36, coat=0.28, logam=0.0):
    warna = PETA.get(warna, warna)
    if GAYA == "aqua" and warna != "logam":
        m = _aqua(nama, warna)
        if m is not None:
            return m
    if warna == "porselen":
        # porselen: lebih licin dan ber-clear-coat tebal agar terbaca di latar putih
        kasar, coat = min(kasar, 0.24), max(coat, 0.55)
    key = (nama, warna, kasar, coat, logam)
    if key in _MAT:
        return _MAT[key]
    m = bpy.data.materials.new("ik_" + nama)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")

    def s(n, v):
        if n in b.inputs:
            b.inputs[n].default_value = v
    s("Base Color", hx(P.get(warna, warna)))
    s("Roughness", kasar)
    s("Metallic", logam)
    s("Coat Weight", coat)
    s("Coat Roughness", 0.12)
    s("Specular IOR Level", 0.55)
    _MAT[key] = m
    return m


def cahaya(nama, warna, kuat=4.0):
    warna = PETA.get(warna, warna)
    if GAYA == "aqua" and warna in AQ_MEREK:
        warna = AQ["muda"]
    key = ("emisi", nama, warna, kuat)
    if key in _MAT:
        return _MAT[key]
    m = bpy.data.materials.new("ik_" + nama)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hx(P.get(warna, warna))
    b.inputs["Emission Color"].default_value = hx(P.get(warna, warna))
    b.inputs["Emission Strength"].default_value = kuat
    b.inputs["Roughness"].default_value = 0.3
    _MAT[key] = m
    return m


def pakai(obj, mat):
    if obj.data is not None and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    return obj


# ------------------------------------------------------------
#  koleksi kerja: setiap ikon dibangun di bawah satu "akar"
# ------------------------------------------------------------
class Susun:
    """Mengumpulkan objek satu ikon di bawah empty akar."""

    def __init__(self, nama):
        self.akar = bpy.data.objects.new("akar_" + nama, None)
        bpy.context.collection.objects.link(self.akar)
        self.objs = []

    def tambah(self, obj, loc=(0, 0, 0), rot=None, skala=None):
        obj.location = loc
        # rot=None mempertahankan rotasi bawaan objek — bentuk() sudah berdiri
        # (X 90°); menimpanya dengan (0,0,0) membuat ikon siluet terbaring rata.
        if rot is not None:
            obj.rotation_euler = rot
        if skala is not None:
            obj.scale = skala if isinstance(skala, (tuple, list)) else (skala,) * 3
        obj.parent = self.akar
        self.objs.append(obj)
        return obj


def aktif(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)


def halus(obj, sudut=40):
    aktif(obj)
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(sudut))
    except Exception:
        pass
    return obj


def bevel_mod(obj, lebar, seg=6, sudut=55):
    m = obj.modifiers.new("bv", "BEVEL")
    m.width = lebar
    m.segments = seg
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(sudut)
    return obj


def subsurf(obj, lvl=2):
    m = obj.modifiers.new("ss", "SUBSURF")
    m.levels = lvl
    m.render_levels = lvl
    return obj


# ------------------------------------------------------------
#  primitif
# ------------------------------------------------------------
def kotak(ukuran, bv=0.12, seg=6):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.scale = ukuran
    bpy.ops.object.transform_apply(scale=True)
    bevel_mod(o, bv, seg)
    return halus(o)


def silinder(r, h, bv=0.06, n=64, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=n)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, vertices=n)
    o = bpy.context.object
    if bv:
        bevel_mod(o, bv, 5)
    return halus(o)


def bola(r, seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2)
    return halus(bpy.context.object)


def torus(R, r, n=96, m=24):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=n, minor_segments=m)
    return halus(bpy.context.object)


def bentuk(nama, titik, tebal=0.22, bevel=0.16, res=6):
    """Siluet 2D diekstrusi dengan tepi membulat — gaya ikon 3D.

    Dibangun sebagai MESH (bukan kurva ber-bevel): bevel kurva Blender memakai
    offset miter yang memunculkan paku panjang di sudut tajam (ekor chat, lekuk
    jantung, sudut perisai). Modifier Bevel dengan clamp_overlap membulatkan
    sudut yang sama tanpa meluap. Siluet langsung dibuat tegak di bidang XZ,
    menghadap kamera (sumbu -Y).
    """
    import bmesh
    bersih = []
    for x, y in titik:
        if not bersih or (abs(bersih[-1][0] - x) + abs(bersih[-1][1] - y)) > 1e-4:
            bersih.append((x, y))
    if (abs(bersih[0][0] - bersih[-1][0]) + abs(bersih[0][1] - bersih[-1][1])) < 1e-4:
        bersih.pop()

    bm = bmesh.new()
    vs = [bm.verts.new((x, tebal, y)) for x, y in bersih]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    baru_v = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=baru_v, vec=(0, -2 * tebal, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(nama)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nama, me)
    bpy.context.collection.objects.link(o)

    m = o.modifiers.new("bv", "BEVEL")
    m.width = min(bevel, tebal * 0.95)
    m.segments = res + 2
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(60)
    m.use_clamp_overlap = True
    m.harden_normals = False
    wn = o.modifiers.new("wn", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    return halus(o, 30)


def garis(nama, titik, tebal=0.04, nurbs=False):
    """Garis/tabung 3D di sepanjang titik (x, y, z)."""
    cu = bpy.data.curves.new(nama, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = tebal
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    cu.resolution_u = 24
    sp = cu.splines.new("NURBS" if nurbs else "POLY")
    sp.points.add(len(titik) - 1)
    for p, c in zip(sp.points, titik):
        p.co = (c[0], c[1], c[2], 1)
    if nurbs:
        # Orde WAJIB diset setelah titik ada: Blender menjepit order_u ke jumlah
        # titik saat itu, jadi mengesetnya pada spline kosong menghasilkan orde
        # 1–2 — tabung bersegi, bukan kurva halus.
        sp.order_u = min(4, len(titik))
        sp.use_endpoint_u = True
    o = bpy.data.objects.new(nama, cu)
    bpy.context.collection.objects.link(o)
    return o


def bubut(nama, profil, langkah=96):
    """Profil (r, z) diputar pada sumbu Z — mangkuk, lonceng, piring."""
    verts = [(r, 0, z) for r, z in profil]
    edges = [(i, i + 1) for i in range(len(verts) - 1)]
    me = bpy.data.meshes.new(nama)
    me.from_pydata(verts, edges, [])
    o = bpy.data.objects.new(nama, me)
    bpy.context.collection.objects.link(o)
    m = o.modifiers.new("scr", "SCREW")
    m.axis = "Z"
    m.steps = langkah
    m.render_steps = langkah
    m.use_merge_vertices = True
    m.use_smooth_shade = True
    s = o.modifiers.new("sol", "SOLIDIFY")
    s.thickness = 0.05
    subsurf(o, 1)
    return o


def metabola(nama, unsur, res=0.06):
    mb = bpy.data.metaballs.new(nama)
    mb.resolution = res
    mb.render_resolution = res * 0.6
    for (x, y, z), r in unsur:
        e = mb.elements.new()
        e.co = (x, y, z)
        e.radius = r
    o = bpy.data.objects.new(nama, mb)
    bpy.context.collection.objects.link(o)
    return o


# ------------------------------------------------------------
#  siluet
# ------------------------------------------------------------
def pola_jantung(n=90, s=1.0):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x / 17 * s, y / 17 * s))
    return pts


def pola_tetes(n=70, d=2.1):
    """Tetesan: lingkaran r=1 + dua garis singgung ke puncak (0, d)."""
    yt = 1 / d
    xt = math.sqrt(1 - yt * yt)
    a0 = math.atan2(yt, xt)
    a1 = math.pi - a0
    pts = []
    for i in range(n + 1):
        a = a0 - (a0 - (a1 - 2 * math.pi)) * i / n
        pts.append((math.cos(a), math.sin(a)))
    pts.append((0, d))
    return pts


def pola_rrect(w, h, r, n=8, ekor=None):
    """Persegi panjang membulat; ekor=(x, kedalaman) menambah ekor gelembung chat."""
    pts = []
    cx, cy = w / 2 - r, h / 2 - r
    for (px, py, a0) in ((cx, cy, 0), (-cx, cy, 90), (-cx, -cy, 180), (cx, -cy, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((px + r * math.cos(a), py + r * math.sin(a)))
        if ekor and a0 == 180:
            ex, dd = ekor
            pts.append((ex - 0.15, -h / 2))
            pts.append((ex - 0.35, -h / 2 - dd))
            pts.append((ex + 0.28, -h / 2))
    return pts


def pola_perisai(n=24):
    kanan = [(1.0, 1.05), (1.0, 0.25)]
    for i in range(1, n + 1):
        t = i / n
        # kurva kuadrat (1,0.25) → (0.95,-0.7) → (0,-1.25)
        x = (1 - t) ** 2 * 1.0 + 2 * (1 - t) * t * 0.95 + t * t * 0.0
        y = (1 - t) ** 2 * 0.25 + 2 * (1 - t) * t * -0.7 + t * t * -1.25
        kanan.append((x, y))
    kiri = [(-x, y) for (x, y) in reversed(kanan[:-1])]
    atas = [(-0.5, 1.12), (0.0, 1.2), (0.5, 1.12)]
    return kanan + kiri + atas


def pola_salib(a=0.34, b=1.0):
    return [(a, b), (-a, b), (-a, a), (-b, a), (-b, -a), (-a, -a), (-a, -b),
            (a, -b), (a, -a), (b, -a), (b, a), (a, a)]


def depan(obj_tebal, tebal, bevel):
    """Koordinat Y permukaan depan sebuah bentuk() (menghadap kamera)."""
    return -tebal - 0.01


# ------------------------------------------------------------
#  IKON
# ------------------------------------------------------------
def ik_jantung(S):
    t, b = 0.26, 0.2
    S.tambah(pakai(bentuk("jantung", pola_jantung(s=1.25), t, b), plastik("koral", "koral")))
    y = depan(None, t, b)
    ekg = [(-0.85, y, 0.1), (-0.35, y, 0.1), (-0.18, y, 0.42), (0.02, y, -0.38),
           (0.2, y, 0.25), (0.32, y, 0.1), (0.85, y, 0.1)]
    S.tambah(pakai(garis("ekg", ekg, 0.055), plastik("putih", "putih", 0.25)))


def ik_oksigen(S):
    t, b = 0.26, 0.2
    o = bentuk("tetes", pola_tetes(), t, b)
    S.tambah(pakai(o, plastik("biru", "biru2")), skala=(0.9, 1, 0.9))
    y = depan(None, t, b)
    for (x, z, r) in ((-0.28, 0.45, 0.2), (0.22, 0.2, 0.13), (0.05, 0.75, 0.09)):
        S.tambah(pakai(bola(r), plastik("putih", "putih", 0.2)), loc=(x, y + 0.02, z), skala=(1, 0.45, 1))


def ik_suhu(S):
    S.tambah(pakai(silinder(0.32, 2.0, 0.14), plastik("putih", "putih")), loc=(0, 0, 1.35))
    S.tambah(pakai(bola(0.32), plastik("putih", "putih")), loc=(0, 0, 2.35))
    S.tambah(pakai(bola(0.55), plastik("amber", "amber")), loc=(0, 0, 0.25))
    S.tambah(pakai(silinder(0.14, 1.3, 0.05), plastik("amber", "amber")), loc=(0, -0.2, 1.05))
    for i in range(4):
        S.tambah(pakai(kotak((0.22, 0.05, 0.05), 0.02), plastik("abu", "abu")),
                 loc=(0.42, -0.1, 1.2 + i * 0.3))


def ik_tensi(S):
    rot = (math.radians(90), 0, 0)
    S.tambah(pakai(silinder(1.15, 0.36, 0.14), plastik("ungu", "ungu")), rot=rot)
    S.tambah(pakai(silinder(0.9, 0.1, 0.03), plastik("putih", "putih", 0.3)), loc=(0, -0.2, 0), rot=rot)
    for i in range(9):
        a = math.radians(210 - i * 30)
        S.tambah(pakai(kotak((0.08, 0.04, 0.16), 0.015), plastik("tinta", "tinta")),
                 loc=(0.68 * math.cos(a), -0.27, 0.68 * math.sin(a)), rot=(0, -a + math.pi / 2, 0))
    jarum = kotak((0.07, 0.05, 0.62), 0.02)
    S.tambah(pakai(jarum, plastik("koral", "koral")), loc=(0.16, -0.3, 0.2), rot=(0, math.radians(-35), 0))
    S.tambah(pakai(silinder(0.12, 0.12, 0.03), plastik("tinta", "tinta")), loc=(0, -0.32, 0), rot=rot)


def ik_ekg(S):
    t, b = 0.14, 0.14
    S.tambah(pakai(bentuk("layar", pola_rrect(2.4, 1.7, 0.42), t, b), plastik("tinta", "gelap", 0.28)))
    y = depan(None, t, b)
    pts = [(-0.95, y, -0.05), (-0.45, y, -0.05), (-0.3, y, 0.35), (-0.1, y, -0.45),
           (0.1, y, 0.2), (0.25, y, -0.05), (0.95, y, -0.05)]
    S.tambah(pakai(garis("nadi", pts, 0.05), cahaya("nadi", "mint", 3.5)))


def pola_otak(n=140):
    """Elips dengan tepi bergelombang — siluet otak bergaya ikon."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        r = 1.0 + 0.075 * math.sin(9 * t) + 0.03 * math.sin(17 * t + 0.6)
        pts.append((1.18 * r * math.cos(t), 0.92 * r * math.sin(t)))
    return pts


def ik_stres(S):
    t, b = 0.3, 0.22
    S.tambah(pakai(bentuk("otak", pola_otak(), t, b), plastik("ungu2", "ungu2", 0.32)))
    y = depan(None, t, b)
    tengah = [(0.0, y, 0.82), (0.07, y, 0.4), (-0.06, y, 0.0), (0.06, y, -0.42), (0.0, y, -0.82)]
    S.tambah(pakai(garis("alur", tengah, 0.045, nurbs=True), plastik("ungu", "ungu", 0.3)))
    for sisi in (-1, 1):
        lip = [(sisi * 0.3, y, 0.45), (sisi * 0.62, y, 0.52), (sisi * 0.7, y, 0.2),
               (sisi * 0.45, y, 0.02), (sisi * 0.72, y, -0.28), (sisi * 0.5, y, -0.5)]
        S.tambah(pakai(garis("lipat%d" % sisi, lip, 0.04, nurbs=True), plastik("putih", "putih", 0.3)))


def ik_jam(S):
    import build_assets as BA
    o = BA.build_teleband()
    S.tambah(o, rot=(math.radians(18), 0, math.radians(-14)))


def ik_cincin(S):
    import build_assets as BA
    o = BA.build_telering()
    S.tambah(o, rot=(math.radians(62), 0, math.radians(20)))


def ik_stetoskop(S):
    lengan = [(-0.7, 0, 2.2), (-0.78, 0, 1.6), (-0.7, 0, 1.0), (-0.35, 0, 0.55), (0, 0, 0.45),
              (0.35, 0, 0.55), (0.7, 0, 1.0), (0.78, 0, 1.6), (0.7, 0, 2.2)]
    S.tambah(pakai(garis("lengan", lengan, 0.085, nurbs=True), plastik("tinta", "biru", 0.4)))
    batang = [(0, 0, 0.45), (0.05, 0, 0.1), (0.35, 0, -0.25), (0.8, 0, -0.3), (1.05, 0, 0.05)]
    S.tambah(pakai(garis("batang", batang, 0.075, nurbs=True), plastik("tinta", "biru", 0.4)))
    for x in (-0.7, 0.7):
        S.tambah(pakai(bola(0.13), plastik("logam", "logam", 0.2, 0.3, 1.0)), loc=(x, 0, 2.25))
    S.tambah(pakai(silinder(0.42, 0.2, 0.07), plastik("logam", "logam", 0.18, 0.4, 1.0)),
             loc=(1.08, 0, 0.3), rot=(math.radians(90), 0, math.radians(25)))
    S.tambah(pakai(silinder(0.3, 0.06, 0.02), plastik("hijau", "hijau2")),
             loc=(1.0, -0.13, 0.33), rot=(math.radians(90), 0, math.radians(25)))


def ik_chat(S):
    t, b = 0.22, 0.2
    S.tambah(pakai(bentuk("gelembung", pola_rrect(2.4, 1.7, 0.62, ekor=(-0.2, 0.42)), t, b),
                   plastik("hijau", "hijau2")))
    y = depan(None, t, b)
    for x in (-0.55, 0, 0.55):
        S.tambah(pakai(bola(0.16), plastik("putih", "putih", 0.25)), loc=(x, y, 0.05), skala=(1, 0.5, 1))


def ik_video(S):
    S.tambah(pakai(kotak((1.7, 1.0, 1.25), 0.22), plastik("biru", "biru")), loc=(-0.3, 0, 0))
    lensa = silinder(0.62, 0.8, 0.08, 4, r2=0.28)
    S.tambah(pakai(lensa, plastik("biru", "biru2")), loc=(0.85, 0, 0),
             rot=(math.radians(45), math.radians(-90), 0))
    S.tambah(pakai(bola(0.16), cahaya("rec", "koral", 2.0)), loc=(-0.85, -0.52, 0.35), skala=(1, 0.5, 1))


def ik_kalender(S):
    t, b = 0.16, 0.16
    S.tambah(pakai(bentuk("kal", pola_rrect(2.2, 2.2, 0.4), t, b), plastik("putih", "putih")))
    y = depan(None, t, b)
    atas = bentuk("kalatas", pola_rrect(2.2, 0.62, 0.3), 0.05, 0.08)
    S.tambah(pakai(atas, plastik("koral", "koral")), loc=(0, y + 0.02, 0.8))
    for x in (-0.55, 0.55):
        S.tambah(pakai(torus(0.2, 0.06), plastik("logam", "logam", 0.2, 0.3, 1.0)),
                 loc=(x, y + 0.05, 1.12), rot=(0, math.radians(90), 0))
    for r in range(3):
        for c in range(4):
            sorot = (r == 1 and c == 2)
            S.tambah(pakai(kotak((0.26, 0.06, 0.22), 0.04),
                           plastik("hijau" if sorot else "abu", "hijau" if sorot else "abu")),
                     loc=(-0.6 + c * 0.4, y + 0.02, 0.18 - r * 0.38))


def ik_perisai(S):
    t, b = 0.24, 0.2
    S.tambah(pakai(bentuk("perisai", pola_perisai(), t, b), plastik("hijau", "hijau")))
    y = depan(None, t, b)
    cek = [(-0.42, y, 0.05), (-0.1, y, -0.3), (0.45, y, 0.38)]
    S.tambah(pakai(garis("cek", cek, 0.09), plastik("putih", "putih", 0.25)))


def ik_lonceng(S):
    profil = [(0.0, 2.05), (0.14, 2.03), (0.2, 1.92), (0.16, 1.82), (0.38, 1.75), (0.62, 1.55),
              (0.72, 1.2), (0.78, 0.8), (0.9, 0.5), (1.12, 0.32), (1.18, 0.25), (1.1, 0.2), (0.0, 0.2)]
    S.tambah(pakai(bubut("lonceng", profil), plastik("amber", "kuning")))
    S.tambah(pakai(bola(0.24), plastik("amber", "amber")), loc=(0, 0, 0.05))


def ik_makan(S):
    profil = [(0.0, 0.05), (0.5, 0.05), (0.62, 0.1), (1.05, 0.45), (1.25, 0.85), (1.3, 0.9)]
    S.tambah(pakai(bubut("mangkuk", profil), plastik("putih", "putih", 0.28)))
    import random
    rng = random.Random(7)
    warna = ["hijau2", "mint", "hijau", "koral2", "kuning"]
    for i in range(16):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0, 0.85)
        S.tambah(pakai(bola(rng.uniform(0.16, 0.28), 24), plastik("sayur%d" % (i % 5), warna[i % 5], 0.45)),
                 loc=(rr * math.cos(a), rr * math.sin(a), 0.72 + rng.uniform(0, 0.25)))


def ik_grafik(S):
    S.tambah(pakai(kotak((2.4, 0.9, 0.14), 0.06), plastik("putih", "putih")), loc=(0, 0, 0))
    for i, (h, w) in enumerate(((0.9, "mint"), (1.5, "biru2"), (2.2, "hijau"))):
        S.tambah(pakai(kotak((0.52, 0.52, h), 0.18), plastik("bar" + w, w)),
                 loc=(-0.72 + i * 0.72, 0, 0.07 + h / 2))


def ik_tujuan(S):
    rot = (math.radians(90), 0, 0)
    for i, (r, w) in enumerate(((1.2, "putih"), (0.9, "koral"), (0.6, "putih"), (0.3, "koral"))):
        S.tambah(pakai(silinder(r, 0.22, 0.06), plastik("tj" + w, w)), loc=(0, -0.05 * i, 0), rot=rot)
    ujung = Vector((0.0, -0.3, 0.02))
    pangkal = Vector((-0.62, -1.55, 0.62))
    S.tambah(pakai(garis("batang", [tuple(ujung), tuple(pangkal)], 0.055), plastik("tinta", "tinta", 0.35)))
    arah = (pangkal - ujung).normalized()
    for k in range(3):
        p0 = pangkal - arah * (0.12 + k * 0.14)
        S.tambah(pakai(garis("bulu%d" % k, [tuple(p0), tuple(p0 - arah * 0.12)], 0.13),
                       plastik("hijau", "hijau")))


def ik_gedung(S):
    S.tambah(pakai(kotak((1.7, 1.2, 2.1), 0.14), plastik("putih", "putih")), loc=(0, 0, 1.05))
    S.tambah(pakai(kotak((2.3, 1.3, 0.2), 0.08), plastik("abu", "abu")), loc=(0, 0, 0.1))
    for r in range(3):
        for c in range(3):
            if r == 0 and c == 1:
                continue
            S.tambah(pakai(kotak((0.3, 0.06, 0.34), 0.05), plastik("jendela", "biru2", 0.2)),
                     loc=(-0.5 + c * 0.5, -0.6, 0.55 + r * 0.55))
    salib = bentuk("salib", pola_salib(0.12, 0.34), 0.05, 0.05)
    S.tambah(pakai(salib, plastik("hijau", "hijau")), loc=(0, -0.62, 1.62))
    S.tambah(pakai(kotak((0.5, 0.06, 0.55), 0.05), plastik("hijau2", "hijau2")), loc=(0, -0.6, 0.45))


def ik_pengguna(S, badan="mint", kepala="mintpucat"):
    S.tambah(pakai(bola(0.55), plastik("kp" + kepala, kepala)), loc=(0, 0, 1.75))
    tubuh = silinder(0.98, 1.1, 0.46)
    S.tambah(pakai(tubuh, plastik("bd" + badan, badan)), loc=(0, 0, 0.55), skala=(1, 0.62, 1))


def ik_dokter(S):
    ik_pengguna(S, badan="putih", kepala="mintpucat")
    salib = bentuk("salibd", pola_salib(0.08, 0.22), 0.04, 0.04)
    S.tambah(pakai(salib, plastik("hijau", "hijau")), loc=(0.42, -0.6, 0.78))
    kalung = [(-0.42, -0.4, 1.12), (-0.5, -0.55, 0.7), (-0.2, -0.64, 0.35), (0.1, -0.64, 0.4)]
    S.tambah(pakai(garis("kalung", kalung, 0.05, nurbs=True), plastik("tinta", "biru", 0.4)))
    S.tambah(pakai(silinder(0.14, 0.08, 0.02), plastik("logam", "logam", 0.2, 0.3, 1.0)),
             loc=(0.14, -0.68, 0.42), rot=(math.radians(90), 0, 0))


def ik_gerigi(S):
    rot = (math.radians(90), 0, 0)
    S.tambah(pakai(silinder(0.95, 0.42, 0.1), plastik("amber", "amber")), rot=rot)
    for i in range(8):
        a = 2 * math.pi * i / 8
        S.tambah(pakai(kotak((0.42, 0.42, 0.36), 0.1), plastik("amber", "amber")),
                 loc=(1.02 * math.cos(a), 0, 1.02 * math.sin(a)), rot=(0, -a, 0))
    S.tambah(pakai(silinder(0.38, 0.46, 0.08), plastik("putih", "putih")), rot=rot)


def ik_awan(S):
    unsur = [((-0.7, 0, 0.0), 0.62), ((0.0, 0, 0.3), 0.8), ((0.75, 0, 0.05), 0.62),
             ((-0.3, 0, -0.2), 0.6), ((0.35, 0, -0.2), 0.6)]
    S.tambah(pakai(metabola("awan", unsur), plastik("putih", "putih", 0.3)), skala=(1, 0.7, 1))
    y = -0.62
    panah = [(-0.35, y, -0.05), (0.0, y, -0.4), (0.4, y, 0.12)]
    S.tambah(pakai(garis("cekawan", panah, 0.08), plastik("hijau", "hijau2")))


def ik_rumah(S):
    t, b = 0.24, 0.18
    atap = [(-1.25, 0.2), (0.0, 1.35), (1.25, 0.2), (1.0, 0.2), (0.0, 1.02), (-1.0, 0.2)]
    S.tambah(pakai(bentuk("dinding", pola_rrect(1.8, 1.45, 0.22), t, b), plastik("putih", "putih")),
             loc=(0, 0, -0.38))
    S.tambah(pakai(bentuk("atap", atap, t + 0.04, 0.1, 4), plastik("hijau", "hijau2")), loc=(0, 0, 0.05))
    y = depan(None, t, b)
    S.tambah(pakai(bentuk("pintu", pola_rrect(0.46, 0.7, 0.18), 0.05, 0.05), plastik("biru", "biru2")),
             loc=(0, y + 0.02, -0.72))
    S.tambah(pakai(bola(0.07), plastik("kuning", "kuning", 0.3)), loc=(0.12, y - 0.06, -0.72))


def ik_bluetooth(S):
    t, b = 0.2, 0.18
    S.tambah(pakai(bentuk("btbg", pola_rrect(1.8, 2.3, 0.85), t, b), plastik("biru", "biru")))
    y = depan(None, t, b)
    bt = [(-0.35, y, -0.35), (0.35, y, 0.35), (0.0, y, 0.72), (0.0, y, -0.72), (0.35, y, -0.35), (-0.35, y, 0.35)]
    S.tambah(pakai(garis("bt", bt, 0.07), plastik("putih", "putih", 0.25)))


IKON = {
    "jantung": ik_jantung, "oksigen": ik_oksigen, "suhu": ik_suhu, "tensi": ik_tensi,
    "ekg": ik_ekg, "stres": ik_stres, "jam": ik_jam, "cincin": ik_cincin,
    "stetoskop": ik_stetoskop, "chat": ik_chat, "video": ik_video, "kalender": ik_kalender,
    "perisai": ik_perisai, "lonceng": ik_lonceng, "makan": ik_makan, "grafik": ik_grafik,
    "tujuan": ik_tujuan, "gedung": ik_gedung, "pengguna": ik_pengguna, "dokter": ik_dokter,
    "gerigi": ik_gerigi, "awan": ik_awan, "bluetooth": ik_bluetooth, "rumah": ik_rumah,
}


# ------------------------------------------------------------
#  studio
# ------------------------------------------------------------
def kosongkan():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.curves, bpy.data.metaballs, bpy.data.lights,
                bpy.data.cameras):
        for b in list(blk):
            if b.users == 0:
                blk.remove(b)


def pasang_gpu(sc):
    sc.render.engine = "CYCLES"
    try:
        pref = bpy.context.preferences.addons["cycles"].preferences
        for jenis in ("OPTIX", "CUDA", "HIP"):
            try:
                pref.compute_device_type = jenis
                pref.get_devices()
                gpu = [d for d in pref.devices if d.type == jenis]
                if gpu:
                    for d in pref.devices:
                        d.use = d.type == jenis
                    sc.cycles.device = "GPU"
                    print(">>> Cycles memakai", jenis, [d.name for d in gpu])
                    return jenis
            except Exception:
                continue
    except Exception as e:
        print(">>> GPU tidak tersedia:", e)
    sc.cycles.device = "CPU"
    print(">>> Cycles memakai CPU")
    return "CPU"


def studio(lebar=512, tinggi=512):
    sc = bpy.context.scene
    pasang_gpu(sc)
    sc.cycles.samples = SAMPEL
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.cycles.max_bounces = 6
    sc.render.film_transparent = True
    sc.render.resolution_x = lebar
    sc.render.resolution_y = tinggi
    sc.render.resolution_percentage = 100
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Punchy"
    except Exception:
        try:
            sc.view_settings.look = "None"
        except Exception:
            pass
    sc.view_settings.exposure = 0.1
    if GAYA == "aqua":
        sc.view_settings.view_transform = "Standard"
        try:
            sc.view_settings.look = "None"
        except Exception:
            pass
        sc.view_settings.exposure = -0.35

    w = sc.world or bpy.data.worlds.new("dunia")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.86, 0.9, 0.89, 1)
    bg.inputs["Strength"].default_value = 0.55

    def lampu(nama, loc, energi, ukuran, warna=(1, 1, 1)):
        ld = bpy.data.lights.new(nama, "AREA")
        ld.energy = energi
        ld.size = ukuran
        ld.color = warna
        o = bpy.data.objects.new(nama, ld)
        o.location = loc
        bpy.context.collection.objects.link(o)
        arah = Vector((0, 0, 0.8)) - Vector(loc)
        o.rotation_euler = arah.to_track_quat("-Z", "Y").to_euler()
        return o

    if GAYA == "aqua":
        # dunia bergradien (bawah hijau-es → atas putih) untuk pantulan mengilap
        nt = w.node_tree
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = hx("#B9CFEE" if AKSEN == "biru" else "#B9E6D2")
        ramp.color_ramp.elements[1].position = 0.75
        ramp.color_ramp.elements[1].color = hx("#FFFFFF")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], ramp.inputs[0])
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 0.9
        lampu("kunci", (4.5, -5.0, 7.0), 900, 6.0, (1, 1, 1))
        lampu("tepi", (-6.0, 5.0, 4.0), 700, 5.0, (0.81, 0.89, 1.0) if AKSEN == "biru" else (0.82, 0.95, 0.9))
        lampu("isi", (-5.0, -6.0, 1.5), 260, 7.0, (1, 1, 1))
        lampu("atas", (0.0, 0.0, 9.0), 300, 8.0, (1, 1, 1))
    else:
        lampu("kunci", (-4.5, -5.5, 7.0), 1400, 5.0, (1.0, 0.98, 0.95))
        lampu("isi", (6.0, -4.0, 3.0), 420, 6.0, (0.88, 0.96, 1.0))
        lampu("tepi", (1.5, 6.0, 5.0), 900, 4.0, (0.8, 1.0, 0.92))

    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    lantai = bpy.context.object
    lantai.name = "penangkap_bayangan"
    lantai.is_shadow_catcher = True
    if GAYA == "aqua":
        lantai.hide_render = True   # gaya aqua: tanpa bayangan lantai, bayangan dari CSS

    cd = bpy.data.cameras.new("kam")
    cd.type = "ORTHO"
    cam = bpy.data.objects.new("kam", cd)
    bpy.context.collection.objects.link(cam)
    cam.rotation_euler = (math.radians(72), 0, 0)
    sc.camera = cam
    return cam, lantai


def objek_bisa_diukur(akar):
    hasil = []
    for o in akar.children_recursive:
        if o.type in ("MESH", "CURVE", "META", "SURFACE", "FONT"):
            hasil.append(o)
    return hasil


def bingkai(cam, objs, margin=1.28, aspek=1.0):
    """Menggeser kamera ortografis agar objek tepat di tengah dan terisi rata."""
    bpy.context.view_layer.update()
    arah = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    pusat = Vector((0, 0, 0))
    titik = []
    for o in objs:
        for c in o.bound_box:
            titik.append(o.matrix_world @ Vector(c))
    for p in titik:
        pusat += p
    pusat /= max(1, len(titik))
    cam.location = pusat - arah * 30
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    lok = [inv @ p for p in titik]
    xs = [p.x for p in lok]
    ys = [p.y for p in lok]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    lebar, tinggi = max(xs) - min(xs), max(ys) - min(ys)
    cam.location = cam.matrix_world @ Vector((cx, cy, 0))
    cam.data.ortho_scale = max(lebar, tinggi * aspek) * margin
    bpy.context.view_layer.update()


def turunkan_ke_lantai(akar, celah=0.18):
    """Ikon melayang sedikit di atas lantai supaya bayangannya lembut."""
    bpy.context.view_layer.update()
    objs = objek_bisa_diukur(akar)
    zmin = min((o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box)
    akar.location.z += celah - zmin
    bpy.context.view_layer.update()


def simpan(sc, path):
    if hasattr(sc.render.image_settings, "media_type"):
        sc.render.image_settings.media_type = "IMAGE"
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 90
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_ikon(nama, fn, cam, sc):
    PETA.clear()
    PETA.update(PETA_IKON.get(nama, {}))
    S = Susun(nama)
    fn(S)
    # sudut 3/4 seragam untuk semua ikon
    S.akar.rotation_euler = (0, 0, math.radians(-24))
    turunkan_ke_lantai(S.akar)
    bingkai(cam, objek_bisa_diukur(S.akar))
    path = os.path.join(OUT_IKON, nama + ".webp")
    simpan(sc, path)
    print(">>> ikon:", nama, "->", path)
    for o in list(S.akar.children_recursive) + [S.akar]:
        bpy.data.objects.remove(o, do_unlink=True)


# ------------------------------------------------------------
#  ILUSTRASI — komposisi beberapa objek (4:3, 1200x900)
# ------------------------------------------------------------
def bagian(S, fn, loc=(0, 0, 0), rot=(0, 0, 0), skala=1.0, peta=None):
    """Menyusun satu ikon sebagai sub-grup di dalam ilustrasi."""
    lama = dict(PETA)
    PETA.clear()
    PETA.update(peta if peta is not None else PETA_IKON.get(fn.__name__[3:], {}))
    sub = Susun(fn.__name__)
    fn(sub)
    sub.akar.parent = S.akar
    sub.akar.location = loc
    sub.akar.rotation_euler = rot
    sub.akar.scale = (skala,) * 3
    PETA.clear()
    PETA.update(lama)
    return sub.akar


def ponsel(S, loc=(0, 0, 0), rot=(0, 0, 0), skala=1.0, layar="beranda"):
    """Ponsel generik porselen dengan layar aplikasi TeleCare bergaya."""
    g = Susun("ponsel")
    g.akar.parent = S.akar
    W, H, T = 1.05, 2.15, 0.11
    g.tambah(pakai(bentuk("badan", pola_rrect(W, H, 0.2, 10), T, 0.07, 5),
                   plastik("porselen", "porselen")))
    y = depan(None, T, 0.07)
    g.tambah(pakai(bentuk("kaca", pola_rrect(W - 0.1, H - 0.1, 0.15, 10), 0.012, 0.01, 2),
                   plastik("kaca", "tinta", 0.12, 0.8)), loc=(0, y + 0.004, 0))
    yl = y - 0.02
    g.tambah(pakai(bentuk("layar", pola_rrect(W - 0.16, H - 0.16, 0.12, 10), 0.01, 0.008, 2),
                   cahaya("layar", "#FBFDFC", 0.9)), loc=(0, yl, 0))
    yu = yl - 0.018
    blok = []
    if layar == "beranda":
        blok = [((0, 0.78), (0.72, 0.2), "hijau"),
                ((-0.19, 0.38), (0.34, 0.42), "sage"), ((0.19, 0.38), (0.34, 0.42), "mintpucat"),
                ((-0.19, -0.1), (0.34, 0.42), "mintpucat"), ((0.19, -0.1), (0.34, 0.42), "sage"),
                ((0, -0.55), (0.72, 0.34), "abu"), ((0, -0.9), (0.72, 0.1), "hijau")]
    elif layar == "chat":
        blok = [((0, 0.86), (0.76, 0.14), "hijau"),
                ((-0.14, 0.5), (0.5, 0.16), "abu"), ((0.14, 0.24), (0.5, 0.16), "hijau2"),
                ((-0.1, -0.02), (0.58, 0.2), "abu"), ((0.16, -0.3), (0.44, 0.16), "hijau2"),
                ((0, -0.86), (0.76, 0.14), "mintpucat")]
    for (x, z), (w, h), wn in blok:
        g.tambah(pakai(kotak((w, 0.02, h), 0.04, 4), plastik("ui" + wn, wn, 0.4, 0.1)),
                 loc=(x, yu, z))
    if layar == "beranda":
        nadi = [(-0.3, yu - 0.02, -0.55), (-0.1, yu - 0.02, -0.55), (-0.02, yu - 0.02, -0.42),
                (0.06, yu - 0.02, -0.68), (0.14, yu - 0.02, -0.55), (0.3, yu - 0.02, -0.55)]
        g.tambah(pakai(garis("nadi", nadi, 0.018), plastik("koral", "koral", 0.3)))
    g.akar.location = loc
    g.akar.rotation_euler = rot
    g.akar.scale = (skala,) * 3
    return g.akar


def cincin_orbit(S, r, loc=(0, 0, 0), rot=(0, 0, 0), tebal=0.012, warna="sage"):
    # selalu jauh di belakang (sumbu +Y) agar tidak memotong objek di depan
    loc = (loc[0], 1.6, loc[2])
    o = torus(r, tebal, 160, 12)
    S.tambah(pakai(o, plastik("orbit" + warna, warna, 0.3)), loc=loc, rot=rot)


def il_hub(S):
    import build_assets as BA
    ponsel(S, loc=(0, 0, 1.25), rot=(0, 0, math.radians(8)))
    jam = BA.build_teleband()
    S.tambah(jam, loc=(-1.75, -0.4, 0.55), rot=(math.radians(62), 0, math.radians(24)), skala=0.55)
    cin = BA.build_telering()
    S.tambah(cin, loc=(1.7, -0.3, 0.5), rot=(math.radians(66), 0, math.radians(-28)), skala=0.5)
    cincin_orbit(S, 2.35, loc=(0, 0.2, 1.2), rot=(math.radians(76), 0, 0))
    cincin_orbit(S, 2.9, loc=(0, 0.2, 1.2), rot=(math.radians(76), 0, 0), tebal=0.008, warna="abu")
    bagian(S, ik_jantung, loc=(-1.25, -0.2, 2.35), rot=(0, 0, math.radians(18)), skala=0.36)
    bagian(S, ik_oksigen, loc=(1.3, -0.2, 2.25), rot=(0, 0, math.radians(-18)), skala=0.3)


def il_konsultasi(S):
    ponsel(S, loc=(-0.2, 0, 1.2), rot=(0, 0, math.radians(10)), layar="chat")
    bagian(S, ik_dokter, loc=(1.55, 0.3, 0.0), rot=(0, 0, math.radians(-18)), skala=0.62)
    bagian(S, ik_chat, loc=(1.35, -0.3, 2.2), rot=(0, 0, math.radians(-12)), skala=0.42)
    bagian(S, ik_stetoskop, loc=(-1.8, -0.2, 0.3), rot=(0, 0, math.radians(20)), skala=0.5)
    cincin_orbit(S, 2.5, loc=(0, 0.3, 1.1), rot=(math.radians(78), 0, 0))


def il_analisis(S):
    bagian(S, ik_grafik, loc=(0, 0.2, 0), skala=0.95)
    bagian(S, ik_jantung, loc=(-1.6, -0.3, 1.5), rot=(0, 0, math.radians(16)), skala=0.42)
    bagian(S, ik_ekg, loc=(1.55, -0.2, 1.85), rot=(0, 0, math.radians(-14)), skala=0.4)
    cincin_orbit(S, 2.3, loc=(0, 0.2, 0.9), rot=(math.radians(78), 0, 0))


def il_aman(S):
    bagian(S, ik_perisai, loc=(0, 0, 0.1), skala=1.0)
    bagian(S, ik_awan, loc=(-1.55, 0.3, 1.9), skala=0.42)
    bagian(S, ik_bluetooth, loc=(1.55, 0.2, 1.7), rot=(0, 0, math.radians(-14)), skala=0.36)
    cincin_orbit(S, 2.0, loc=(0, 0.2, 1.1), rot=(math.radians(78), 0, 0))


def il_kosong(S):
    profil = [(0.0, 0.05), (1.2, 0.05), (1.4, 0.12), (1.55, 0.35), (1.6, 0.4)]
    S.tambah(pakai(bubut("nampan", profil), plastik("porselen", "porselen")))
    bagian(S, ik_awan, loc=(0.1, 0, 0.9), skala=0.5, peta={"putih": "porselen", "hijau2": "sage"})
    for (x, z, r) in ((-0.9, 1.6, 0.1), (0.95, 1.9, 0.08), (0.5, 2.3, 0.06)):
        S.tambah(pakai(bola(r), plastik("sage", "sage", 0.3)), loc=(x, -0.3, z))


def il_produk(S):
    import build_assets as BA
    jam = BA.build_teleband()
    S.tambah(jam, loc=(-0.95, 0, 0.6), rot=(math.radians(58), 0, math.radians(18)), skala=0.9)
    cin = BA.build_telering()
    S.tambah(cin, loc=(1.25, -0.2, 0.55), rot=(math.radians(64), 0, math.radians(-24)), skala=0.8)
    cincin_orbit(S, 2.4, loc=(0, 0.2, 0.9), rot=(math.radians(80), 0, 0))


ILUSTRASI = {
    "hub": il_hub, "konsultasi": il_konsultasi, "analisis": il_analisis,
    "aman": il_aman, "kosong": il_kosong, "produk": il_produk,
}


def render_ilustrasi(nama, fn, cam, sc):
    PETA.clear()
    S = Susun(nama)
    fn(S)
    S.akar.rotation_euler = (0, 0, math.radians(-10))
    turunkan_ke_lantai(S.akar, 0.12)
    bingkai(cam, objek_bisa_diukur(S.akar), margin=1.16, aspek=4 / 3)
    path = os.path.join(OUT_ILUS, nama + ".webp")
    simpan(sc, path)
    print(">>> ilustrasi:", nama, "->", path)
    for o in list(S.akar.children_recursive) + [S.akar]:
        bpy.data.objects.remove(o, do_unlink=True)


ANIM_FRAME = int(arg("--frame", 32))
OUT_ANIM = os.path.join(ROOT, "build", "anim-ikon" if AKSEN == "hijau" else "anim-ikon-" + AKSEN)


def render_ikon_anim(nama, fn, cam, sc):
    """Loop mulus: ayunan sudut Z + naik-turun kecil. Kamera dibingkai sekali
    pada pose netral dengan margin lebih lebar supaya gerakan tidak terpotong."""
    folder = os.path.join(OUT_ANIM, nama)
    if os.path.isdir(folder) and len([f for f in os.listdir(folder) if f.endswith(".png")]) >= ANIM_FRAME:
        print(">>> anim sudah ada, dilewati:", nama)
        return
    PETA.clear()
    PETA.update(PETA_IKON.get(nama, {}))
    S = Susun(nama)
    fn(S)
    dasar = math.radians(-24)
    S.akar.rotation_euler = (0, 0, dasar)
    turunkan_ke_lantai(S.akar, 0.26)
    z0 = S.akar.location.z
    bingkai(cam, objek_bisa_diukur(S.akar), margin=1.5)
    folder = os.path.join(OUT_ANIM, nama)
    os.makedirs(folder, exist_ok=True)
    if hasattr(sc.render.image_settings, "media_type"):
        sc.render.image_settings.media_type = "IMAGE"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    for i in range(ANIM_FRAME):
        t = 2 * math.pi * i / ANIM_FRAME
        S.akar.rotation_euler = (0, 0, dasar + math.radians(20) * math.sin(t))
        S.akar.location.z = z0 + 0.1 * math.sin(t + math.pi / 2)
        sc.render.filepath = os.path.join(folder, "%03d.png" % i)
        bpy.ops.render.render(write_still=True)
    print(">>> anim:", nama, ANIM_FRAME, "frame")
    for o in list(S.akar.children_recursive) + [S.akar]:
        bpy.data.objects.remove(o, do_unlink=True)


def utama():
    kosongkan()
    ilus = bool(arg("--ilustrasi", False))
    anim = bool(arg("--anim", False))
    cam, lantai = studio(1200, 900) if ilus else studio(224, 224) if anim else studio(512, 512)
    sc = bpy.context.scene
    if anim:
        # bayangan lantai terpotong kotak di tepi frame saat objek bergerak;
        # pada ikon animasi bayangan diberikan CSS (drop-shadow)
        lantai.hide_render = True
    tabel, fungsi = (ILUSTRASI, render_ilustrasi) if ilus else         (IKON, render_ikon_anim) if anim else (IKON, render_ikon)
    daftar = [(n, f) for n, f in tabel.items() if not HANYA or n in HANYA]
    gagal = []
    for nama, fn in daftar:
        try:
            fungsi(nama, fn, cam, sc)
        except Exception as e:
            import traceback
            traceback.print_exc()
            gagal.append((nama, str(e)))
    print(">>> SELESAI total=%d gagal=%d %s" % (len(daftar), len(gagal), gagal))


if __name__ == "__main__":
    utama()
