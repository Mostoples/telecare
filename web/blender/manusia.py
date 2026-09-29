# ============================================================
#  TeleCare — manusia 3D untuk video (MPFB / MakeHuman, aset CC0)
#
#  Butuh ekstensi MPFB di Blender 5.2 (bl_ext.user_default.mpfb) dan
#  aset sistem MakeHuman. Lokasi aset dicari berurutan di:
#    env TELECARE_MH_SYS, data ekstensi MPFB, dan salinan lokal di
#    Desktop/repulse/work/assets_dl/mpfb/sys (proyek RePulse).
#  Pose dibuat lewat tulang rig bawaan: aim() mengarahkan tulang ke
#  arah tertentu (ruang armature, posisi berdiri), bend() memutar sendi.
# ============================================================
import bpy
import glob
import math
import os

import addon_utils
from mathutils import Matrix, Vector

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402

_KANDIDAT = [
    os.environ.get("TELECARE_MH_SYS", ""),
    os.path.join(os.environ.get("APPDATA", ""), "Blender Foundation", "Blender", "5.2", "extensions",
                 ".user", "user_default", "mpfb", "data"),
    r"C:/Users/mosto/Desktop/repulse/work/assets_dl/mpfb/sys",
]


def _cari(jenis, nama, ext):
    for akar in _KANDIDAT:
        if not akar:
            continue
        f = glob.glob(os.path.join(akar, jenis, nama, "*" + ext)) or \
            glob.glob(os.path.join(akar, jenis, nama, "**", "*" + ext), recursive=True)
        if f:
            return f[0]
    return None


def _kain(nama, hexw, kasar=0.85, sheen=0.5):
    m = bpy.data.materials.new(nama)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    h = hexw.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    p.inputs["Base Color"].default_value = (*[x ** 2.2 for x in c], 1)
    p.inputs["Roughness"].default_value = kasar
    p.inputs["Sheen Weight"].default_value = sheen
    return m


def buat_manusia(pakaian="male_casualsuit03", rambut="short02", kulit="young_asian_male",
                 sepatu="shoes02", gender=1.0, umur=0.5, tinggi=0.55, warna_baju=None):
    d = TargetService.get_default_macro_info_dict()
    d["gender"], d["age"], d["height"], d["muscle"], d["weight"] = gender, umur, tinggi, 0.5, 0.5
    d["race"] = {"asian": 0.85, "african": 0.1, "caucasian": 0.05}
    badan = HumanService.create_human(macro_detail_dict=d)
    rig = HumanService.add_builtin_rig(badan, "default")
    f = _cari("skins", kulit, ".mhmat")
    if f:
        HumanService.set_character_skin(f, badan, skin_type="ENHANCED_SSS")
    for jenis, nama, tipe in (("eyes", "high-poly", "Eyes"), ("eyebrows", "eyebrow001", "Eyebrows"),
                              ("eyelashes", "eyelashes01", "Eyelashes"), ("hair", rambut, "Hair"),
                              ("clothes", pakaian, "Clothes"), ("clothes", sepatu, "Clothes")):
        f = _cari(jenis, nama, ".mhclo") if nama else None
        if not f:
            print(">>> aset MakeHuman tidak ada:", jenis, nama)
            continue
        o = HumanService.add_mhclo_asset(f, badan, asset_type=tipe, subdiv_levels=1)
        if tipe == "Clothes" and nama == pakaian and warna_baju:
            o.data.materials.clear()
            o.data.materials.append(_kain("baju", warna_baju))
            for pl in o.data.polygons:
                pl.use_smooth = True
    for m in badan.modifiers:
        if m.type == "SUBSURF":
            m.levels, m.render_levels = 1, 2
    return rig, badan


# ------------------------------------------------------------
#  pose
# ------------------------------------------------------------
def aim(rig, nama, arah):
    bpy.context.view_layer.update()
    pb = rig.pose.bones[nama]
    M = pb.matrix.copy()
    y = M.col[1].xyz.normalized()
    R = y.rotation_difference(Vector(arah).normalized()).to_matrix().to_4x4()
    T = Matrix.Translation(M.translation)
    pb.matrix = T @ R @ T.inverted() @ M
    bpy.context.view_layer.update()


def bend(rig, nama, deg, sumbu="X"):
    pb = rig.pose.bones[nama]
    pb.rotation_mode = "XYZ"
    e = list(pb.rotation_euler)
    e["XYZ".index(sumbu)] += math.radians(deg)
    pb.rotation_euler = e


def nol(rig):
    for b in rig.pose.bones:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()


def jari_rileks(rig, lengkung=26):
    for s in ("L", "R"):
        for f in range(2, 6):
            for j, k in ((1, 0.8), (2, 1.1), (3, 0.9)):
                bend(rig, "finger%d-%d.%s" % (f, j, s), lengkung * k)
        bend(rig, "finger1-2.%s" % s, 12)


def pose_lihat_jam(rig, t=1.0):
    """Berdiri santai, lengan kiri terangkat melihat TeleBand. t=0 lengan turun, t=1 terangkat."""
    nol(rig)
    jari_rileks(rig)
    # lengan kanan santai di samping
    aim(rig, "upperarm01.R", (-0.12, 0.02, -1.0))
    aim(rig, "lowerarm01.R", (-0.08, -0.12, -1.0))
    # lengan kiri: interpolasi dari santai ke posisi membaca jam
    ua0, ua1 = Vector((0.12, 0.02, -1.0)), Vector((0.30, -0.55, -0.55))
    la0, la1 = Vector((0.08, -0.12, -1.0)), Vector((-0.55, -0.75, 0.35))
    aim(rig, "upperarm01.L", ua0.lerp(ua1, t))
    aim(rig, "lowerarm01.L", la0.lerp(la1, t))
    # kepala menunduk ke pergelangan
    bend(rig, "neck01", 10 * t)
    bend(rig, "head", 14 * t)
    bend(rig, "head", -10 * t, "Z")
    bpy.context.view_layer.update()


def pose_duduk_meja(rig):
    """Duduk tegak di kursi kerja, kedua tangan di atas meja."""
    nol(rig)
    jari_rileks(rig, 18)
    for s in ("L", "R"):
        k = 1 if s == "L" else -1
        aim(rig, "upperleg01." + s, (0.06 * k, -1.0, -0.08))
        aim(rig, "lowerleg01." + s, (0.02 * k, 0.05, -1.0))
        aim(rig, "upperarm01." + s, (0.12 * k, -0.35, -0.93))
        aim(rig, "lowerarm01." + s, (-0.18 * k, -1.0, 0.05))
    bend(rig, "neck01", 8)
    bend(rig, "head", 10)
    bpy.context.view_layer.update()


def titik_tulang(rig, nama, u=0.0):
    """Posisi dunia di sepanjang tulang (u=0 kepala, 1 ekor) + arah tulang."""
    bpy.context.view_layer.update()
    pb = rig.pose.bones[nama]
    h = rig.matrix_world @ pb.head
    e = rig.matrix_world @ pb.tail
    return h.lerp(e, u), (e - h).normalized()


def pasang_jam(rig, jam, skala=0.02, u=0.82, sisi="L", putar=0.0):
    """Tempelkan objek TeleBand di pergelangan: sumbu lubang tali (X lokal) sejajar lengan
    bawah, layar (Z lokal) menghadap punggung tangan. Diparent ke tulang agar ikut pose."""
    pos, arah = titik_tulang(rig, "lowerarm02." + sisi, u)
    bpy.context.view_layer.update()
    pb = rig.pose.bones["lowerarm02." + sisi]
    Mb = rig.matrix_world @ pb.matrix
    # sumbu Z tulang ≈ arah punggung tangan pada rig MakeHuman default
    atas = (Mb.to_3x3() @ Vector((0, 0, 1))).normalized()
    # sumbu lubang tali TeleBand = Y lokal model → sejajar lengan bawah
    y = arah
    z = (atas - y * atas.dot(y)).normalized()
    x = y.cross(z)
    R = Matrix((x, y, z)).transposed().to_4x4()
    R = R @ Matrix.Rotation(putar, 4, "Y")
    jam.matrix_world = Matrix.Translation(pos) @ R @ Matrix.Scale(skala, 4)
    # ikut tulang
    mw = jam.matrix_world.copy()
    jam.parent = rig
    jam.parent_type = "BONE"
    jam.parent_bone = "lowerarm02." + sisi
    jam.matrix_world = mw
    return jam


# ------------------------------------------------------------
#  TeleBand yang dipaskan ke pergelangan (geometri prosedural)
# ------------------------------------------------------------
def _pbr(nama, hexw, kasar=0.4, logam=0.0, coat=0.0, emisi=None, kuat=0.0):
    m = bpy.data.materials.new(nama)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    h = hexw.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    b.inputs["Base Color"].default_value = (*lin, 1)
    b.inputs["Roughness"].default_value = kasar
    b.inputs["Metallic"].default_value = logam
    b.inputs["Coat Weight"].default_value = coat
    if emisi:
        b.inputs["Emission Color"].default_value = (*lin, 1)
        b.inputs["Emission Strength"].default_value = kuat
    return m


def _layar_jam(nama="layar_jam"):
    """Layar jam memakai UI TeleBand dari generator aset (EKG, metrik) sebagai emisi."""
    import build_assets as BA
    m = bpy.data.materials.new(nama)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = BA.make_screen_image()
    b.inputs["Base Color"].default_value = (0.004, 0.012, 0.01, 1)
    b.inputs["Roughness"].default_value = 0.08
    b.inputs["Coat Weight"].default_value = 1.0
    nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 2.2
    return m


def jam_pergelangan(rig, sisi="L", u=0.93, rx=0.030, rz=0.024, lebar=0.022, balik=False):
    """Membuat TeleBand pas di pergelangan dan menempelkannya ke tulang lengan bawah.
    rx/rz: jari-jari elips tali (m). Punggung tangan ditentukan dari tulang jari:
    normal = arah_lengan x (kelingking - jempol), dibalik bila `balik`."""
    import bmesh
    pos, arah = titik_tulang(rig, "lowerarm02." + sisi, u)
    j1, _ = titik_tulang(rig, "finger1-1." + sisi, 0)
    j5, _ = titik_tulang(rig, "finger5-1." + sisi, 0)
    samping = (j5 - j1).normalized()
    atas = arah.cross(samping).normalized()
    if sisi == "R":
        atas = -atas
    if balik:
        atas = -atas
    samping = atas.cross(arah).normalized()
    R = Matrix((samping, arah, atas)).transposed().to_4x4()   # X samping, Y lengan, Z punggung tangan
    induk = bangun_band(Matrix.Translation(pos) @ R, rx, rz, lebar)
    mw = induk.matrix_world.copy()
    induk.parent = rig
    induk.parent_type = "BONE"
    induk.parent_bone = "lowerarm02." + sisi
    induk.matrix_world = mw
    return induk


def bangun_band(matriks, rx=0.030, rz=0.024, lebar=0.022, skala=1.0):
    """Geometri TeleBand (tali elips tertutup + casing + layar + LED) pada `matriks`.
    X lokal = samping, Y = sumbu lengan, Z = punggung tangan. `skala` untuk adegan non-meter."""
    import bmesh
    induk = bpy.data.objects.new("TeleBand_pergelangan", None)
    bpy.context.collection.objects.link(induk)
    induk.matrix_world = matriks @ Matrix.Scale(skala, 4)

    # tali: elips tertutup diekstrusi sepanjang Y, sedikit menebal
    bm = bmesh.new()
    n = 64
    ring = []
    for i in range(n):
        a = 2 * math.pi * i / n
        ring.append((rx * math.cos(a), rz * math.sin(a)))
    v0 = [bm.verts.new((x, -lebar / 2, z)) for x, z in ring]
    v1 = [bm.verts.new((x, lebar / 2, z)) for x, z in ring]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((v0[i], v0[j], v1[j], v1[i]))
    me = bpy.data.meshes.new("tali")
    bm.to_mesh(me)
    bm.free()
    tali = bpy.data.objects.new("tali", me)
    bpy.context.collection.objects.link(tali)
    sol = tali.modifiers.new("tebal", "SOLIDIFY")
    sol.thickness = 0.0035
    sol.offset = 1.0
    bv = tali.modifiers.new("bv", "BEVEL")
    bv.width = 0.0012
    bv.segments = 3
    for pl in me.polygons:
        pl.use_smooth = True
    tali.data.materials.append(_pbr("tali_jam", "#0E5B4C", 0.55, coat=0.2))
    tali.parent = induk

    # casing + layar di punggung tangan
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    cs = bpy.context.object
    cs.name = "casing"
    cs.scale = (0.034, 0.040, 0.010)
    bpy.ops.object.transform_apply(scale=True)
    b2 = cs.modifiers.new("bv", "BEVEL")
    b2.width = 0.004
    b2.segments = 6
    bpy.ops.object.shade_smooth()
    cs.data.materials.append(_pbr("casing_jam", "#B9C1C3", 0.22, logam=1.0))
    cs.parent = induk
    cs.location = (0, 0, rz + 0.007)
    bpy.ops.mesh.primitive_plane_add(size=1)
    ly = bpy.context.object
    ly.name = "layar"
    ly.scale = (0.028, 0.033, 1)
    ly.data.materials.append(_layar_jam())
    ly.parent = induk
    ly.location = (0, 0, rz + 0.0123)
    # LED sensor hijau di sisi bawah (terlihat berpendar pada kulit)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0025)
    led = bpy.context.object
    led.data.materials.append(_pbr("led_jam", "#2BE39A", 0.3, emisi=True, kuat=12))
    led.parent = induk
    led.location = (0, 0, -rz - 0.001)
    return induk
