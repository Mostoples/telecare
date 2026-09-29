# ============================================================
#  TeleCare - Procedural product asset builder (Blender 5.x)
#  Builds  : TeleBand (wearable band) + TeleRing (smart ring)
#  Outputs : GLB models, turntable MP4, transparent PNG stills
#
#  Run: blender -b -noaudio -P build_assets.py -- --root <project dir>
# ============================================================
import bpy, math, os, sys, glob, shutil
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(bpy.data.filepath or __file__), ".."))
if "--root" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--root") + 1]
STILLS_ONLY = "--stills-only" in sys.argv
OUT_MODELS = os.path.join(ROOT, "assets", "models")
OUT_VIDEO  = os.path.join(ROOT, "assets", "video")
OUT_IMG    = os.path.join(ROOT, "assets", "img")
for p in (OUT_MODELS, OUT_VIDEO, OUT_IMG):
    os.makedirs(p, exist_ok=True)

# ---------- brand palette ----------
C_GREEN = (0.02, 0.62, 0.33, 1.0)
C_MINT  = (0.35, 0.95, 0.72, 1.0)
C_TITAN = (0.66, 0.69, 0.70, 1.0)
C_DARK  = (0.028, 0.040, 0.045, 1.0)
C_STRAP = (0.016, 0.135, 0.115, 1.0)


# ============================================================
#  HELPERS
# ============================================================
def wipe():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                  bpy.data.lights, bpy.data.cameras, bpy.data.images,
                  bpy.data.node_groups):
        for b in list(block):
            if b.users == 0:
                try:
                    block.remove(b)
                except Exception:
                    pass


def setv(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def mat_pbr(name, base, metallic=0.0, rough=0.4, emis=None, emis_str=0.0,
            alpha=1.0, transmission=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    setv(bsdf, "Base Color", base)
    setv(bsdf, "Metallic", metallic)
    setv(bsdf, "Roughness", rough)
    setv(bsdf, "Alpha", alpha)
    setv(bsdf, "Transmission Weight", transmission)
    setv(bsdf, "Coat Weight", coat)
    setv(bsdf, "IOR", 1.48)
    if emis:
        setv(bsdf, "Emission Color", emis)
        setv(bsdf, "Emission Strength", emis_str)
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def bevel(obj, width=0.03, segments=4, angle=50):
    mod = obj.modifiers.new("Bevel", 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    return obj


def smooth(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(38))
    except Exception:
        pass
    return obj


def apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    for m in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception:
            pass
    return obj


def iter_fcurves(obj):
    """F-curve access valid for both legacy and slotted (4.4+/5.x) Actions."""
    ad = obj.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    out = []
    slot = getattr(ad, "action_slot", None)
    for layer in getattr(act, "layers", []):
        for strip in getattr(layer, "strips", []):
            cb = None
            try:
                cb = strip.channelbag(slot) if slot else None
            except Exception:
                cb = None
            if cb is None:
                for cb2 in getattr(strip, "channelbags", []):
                    out.extend(cb2.fcurves)
            else:
                out.extend(cb.fcurves)
    return out


def join(objs, name):
    objs = [o for o in objs if o and o.name in bpy.data.objects]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = name
    return j


def revolve_profile(name, profile, segments=180):
    """Revolves a closed (r, z) profile around the Z axis into a solid band."""
    verts, faces = [], []
    P = len(profile)
    for i in range(segments):
        a = 2.0 * math.pi * i / segments
        ca, sa = math.cos(a), math.sin(a)
        for (r, z) in profile:
            verts.append((r * ca, r * sa, z))
    for i in range(segments):
        i2 = (i + 1) % segments
        for j in range(P):
            j2 = (j + 1) % P
            faces.append((i * P + j, i * P + j2, i2 * P + j2, i2 * P + j))
    ob = mesh_from(name, verts, faces)
    ob.data.validate()
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


# ============================================================
#  SCREEN UI — rasterised procedurally with numpy
# ============================================================
def make_screen_image(name="TC_ScreenUI_TEX", S=640):
    """Draws a plausible wearable health UI: status bar, ECG trace, metric bars."""
    import numpy as np

    # row 0 = bottom, matching Blender's pixel ordering
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    x = xx / (S - 1.0)
    y = yy / (S - 1.0)

    img = np.zeros((S, S, 4), np.float32)
    img[..., 3] = 1.0

    bot = np.array([0.012, 0.055, 0.048], np.float32)
    top = np.array([0.020, 0.115, 0.092], np.float32)
    for c in range(3):
        img[..., c] = bot[c] + (top[c] - bot[c]) * y
    vig = 1.0 - 0.45 * np.clip(((x - .5) ** 2 + (y - .5) ** 2) * 3.4, 0, 1)
    img[..., :3] *= vig[..., None]

    def seg_dist(ax, ay, bx, by):
        vx, vy = bx - ax, by - ay
        wx, wy = x - ax, y - ay
        L2 = vx * vx + vy * vy
        t = np.clip((wx * vx + wy * vy) / max(L2, 1e-9), 0.0, 1.0)
        dx = wx - t * vx
        dy = wy - t * vy
        return np.sqrt(dx * dx + dy * dy)

    def poly_dist(points):
        d = np.full((S, S), 1e9, np.float32)
        for i in range(len(points) - 1):
            ax, ay = points[i]
            bx, by = points[i + 1]
            d = np.minimum(d, seg_dist(ax, ay, bx, by))
        return d

    def paint(mask, color, strength=1.0):
        m = np.clip(mask * strength, 0, 1)[..., None]
        img[..., :3] = img[..., :3] * (1 - m) + np.array(color, np.float32) * m

    def bar(x0, x1, yc, h, color, strength=1.0):
        d = seg_dist(x0, yc, x1, yc)
        paint(np.clip((h - d) / (0.35 * h), 0, 1), color, strength)

    def dot(cx, cy, r, color, strength=1.0):
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        paint(np.clip((r - d) / (0.4 * r), 0, 1), color, strength)

    MINT  = (0.42, 0.97, 0.74)
    MINT2 = (0.24, 0.80, 0.60)
    PALE  = (0.72, 0.95, 0.87)
    DIM   = (0.10, 0.32, 0.28)

    # top status bar
    bar(0.15, 0.44, 0.885, 0.010, DIM, 0.9)
    bar(0.63, 0.86, 0.885, 0.010, DIM, 0.7)
    dot(0.110, 0.885, 0.016, MINT, 0.95)

    # ECG trace, three beats
    def ecg(p):
        def g(c, w, a):
            return a * math.exp(-((p - c) / w) ** 2)
        return (g(0.18, 0.035, 0.13) - g(0.36, 0.012, 0.11) + g(0.40, 0.011, 1.0)
                - g(0.44, 0.016, 0.24) + g(0.66, 0.062, 0.29))

    pts = []
    N = 300
    for i in range(N):
        t = i / (N - 1.0)
        pts.append((0.10 + t * 0.80, 0.585 + ecg((t * 3.0) % 1.0) * 0.150))
    d = poly_dist(pts)
    paint(np.exp(-(d / 0.030) ** 2), MINT2, 0.40)
    paint(np.clip((0.0055 - d) / 0.0035, 0, 1), MINT, 1.0)

    # baseline
    d = poly_dist([(0.10, 0.452), (0.90, 0.452)])
    paint(np.clip((0.0022 - d) / 0.0018, 0, 1), DIM, 0.85)

    # value blocks
    bar(0.12, 0.31, 0.345, 0.028, PALE, 0.92)
    bar(0.12, 0.23, 0.283, 0.011, DIM, 0.85)
    bar(0.60, 0.79, 0.345, 0.028, PALE, 0.62)
    bar(0.60, 0.70, 0.283, 0.011, DIM, 0.70)

    # metric progress bars
    bar(0.12, 0.88, 0.185, 0.014, (0.045, 0.16, 0.14), 1.0)
    bar(0.12, 0.65, 0.185, 0.014, MINT, 0.95)
    bar(0.12, 0.88, 0.115, 0.014, (0.045, 0.16, 0.14), 1.0)
    bar(0.12, 0.48, 0.115, 0.014, MINT2, 0.90)

    # rounded screen corners
    r = 0.16
    qx = np.abs(x - 0.5) - (0.5 - r)
    qy = np.abs(y - 0.5) - (0.5 - r)
    dd = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) - r
    img[..., :3] *= np.clip(-dd / 0.012, 0, 1)[..., None]

    image = bpy.data.images.new(name, S, S, alpha=True)
    image.pixels.foreach_set(img.reshape(-1))
    image.pack()
    return image


def mat_screen(name="TC_Screen"):
    """Emissive UI behind a glossy clear coat — reads as glass without the
    ray-traced transmission noise EEVEE produces on a thin pane."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.location = (-380, 0)
    tex.image = make_screen_image()
    tex.interpolation = 'Cubic'
    tex.extension = 'EXTEND'
    setv(bsdf, "Base Color", (0.006, 0.010, 0.010, 1))
    setv(bsdf, "Metallic", 0.0)
    setv(bsdf, "Roughness", 0.10)
    setv(bsdf, "Coat Weight", 1.0)
    setv(bsdf, "Coat Roughness", 0.03)
    setv(bsdf, "Emission Strength", 2.4)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    return m


# ============================================================
#  TELEBAND
# ============================================================
def build_teleband():
    parts = []
    M_TITAN  = mat_pbr("TC_Titanium", C_TITAN, metallic=1.0, rough=0.22)
    M_DARK   = mat_pbr("TC_DarkCeramic", C_DARK, metallic=0.2, rough=0.34, coat=0.5)
    M_STRAP  = mat_pbr("TC_Strap", C_STRAP, metallic=0.0, rough=0.66)
    M_SCREEN = mat_screen()
    M_LED    = mat_pbr("TC_LED", C_MINT, emis=C_MINT, emis_str=5.0, rough=0.2)
    M_ACCENT = mat_pbr("TC_Accent", C_GREEN, metallic=0.65, rough=0.28,
                       emis=C_GREEN, emis_str=0.5)

    # case
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
    case = bpy.context.object; case.name = "TB_Case"
    case.scale = (1.05, 1.22, 0.26)
    bpy.ops.object.transform_apply(scale=True)
    bevel(case, width=0.24, segments=10, angle=40)
    apply_mods(case); smooth(case); assign(case, M_TITAN); parts.append(case)

    # dark bezel
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0.205))
    bez = bpy.context.object; bez.name = "TB_Bezel"
    bez.scale = (0.95, 1.12, 0.10)
    bpy.ops.object.transform_apply(scale=True)
    bevel(bez, width=0.085, segments=8, angle=40)
    apply_mods(bez); smooth(bez); assign(bez, M_DARK); parts.append(bez)

    # emissive screen
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0.307))
    scr = bpy.context.object; scr.name = "TB_Screen"
    scr.scale = (0.785, 0.945, 1)
    bpy.ops.object.transform_apply(scale=True)
    assign(scr, M_SCREEN); parts.append(scr)

    # crown & side button
    bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=0.16, vertices=48,
                                        rotation=(0, math.radians(90), 0),
                                        location=(1.10, 0.30, 0.02))
    crown = bpy.context.object; crown.name = "TB_Crown"
    bevel(crown, width=0.02, segments=4); apply_mods(crown); smooth(crown)
    assign(crown, M_ACCENT); parts.append(crown)

    bpy.ops.mesh.primitive_cube_add(size=2, location=(1.06, -0.32, 0.01))
    btn = bpy.context.object; btn.name = "TB_Button"
    btn.scale = (0.05, 0.22, 0.05)
    bpy.ops.object.transform_apply(scale=True)
    bevel(btn, width=0.03, segments=5); apply_mods(btn); smooth(btn)
    assign(btn, M_TITAN); parts.append(btn)

    # sensor pod (underside)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.60, depth=0.14, vertices=64,
                                        location=(0, 0, -0.30))
    pod = bpy.context.object; pod.name = "TB_Pod"
    bevel(pod, width=0.05, segments=6); apply_mods(pod); smooth(pod)
    assign(pod, M_DARK); parts.append(pod)

    for i in range(4):
        a = math.radians(90 * i + 45)
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.10, depth=0.05, vertices=32,
            location=(0.30 * math.cos(a), 0.30 * math.sin(a), -0.372))
        led = bpy.context.object; led.name = "TB_LED%d" % i
        bevel(led, width=0.015, segments=3); apply_mods(led); smooth(led)
        assign(led, M_LED); parts.append(led)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.11, depth=0.05, vertices=32,
                                        location=(0, 0, -0.372))
    pd = bpy.context.object; pd.name = "TB_PD"
    bevel(pd, width=0.015, segments=3); apply_mods(pd); smooth(pd)
    assign(pd, M_DARK); parts.append(pd)

    # straps: flat ribbons swept along an elliptical wrist path, built as quad
    # strips so the profile stays a real band rather than a rod
    CY, CZ = 0.0, -2.05
    A, B = 2.34, 1.95
    for sgn in (1, -1):
        verts, faces = [], []
        N = 64
        phi0, phi1 = math.radians(26), math.radians(171)
        for i in range(N + 1):
            t = i / N
            phi = phi0 + (phi1 - phi0) * t
            py = CY + sgn * A * math.sin(phi)
            pz = CZ + B * math.cos(phi)
            half = 0.62 * (1.0 - 0.26 * t * t)
            verts.append((-half, py, pz))
            verts.append(( half, py, pz))
            if i:
                a = (i - 1) * 2
                faces.append((a, a + 1, a + 3, a + 2))
        ob = mesh_from("TB_Strap%d" % sgn, verts, faces)
        sol = ob.modifiers.new("Sol", 'SOLIDIFY')
        sol.thickness = 0.13
        sol.offset = 0.0
        bevel(ob, width=0.045, segments=4, angle=44)
        apply_mods(ob); smooth(ob); assign(ob, M_STRAP); parts.append(ob)

    return join(parts, "TeleBand")


# ============================================================
#  TELERING
# ============================================================
def build_telering():
    parts = []
    M_RING  = mat_pbr("TR_Titanium", (0.72, 0.74, 0.75, 1), metallic=1.0, rough=0.16)
    M_INNER = mat_pbr("TR_Inner", (0.045, 0.065, 0.062, 1), metallic=0.2, rough=0.42)
    M_SENS  = mat_pbr("TR_Sensor", C_MINT, emis=C_MINT, emis_str=6.0, rough=0.2)
    M_LINE  = mat_pbr("TR_Line", C_GREEN, metallic=0.7, rough=0.24,
                      emis=C_GREEN, emis_str=1.2)

    # --- body: a revolved band profile, not a fat torus ---
    RI, RO, HW, C = 0.82, 1.06, 0.32, 0.105     # inner/outer radius, half-width, corner
    prof = [(RI, -HW + 0.03), (RI + 0.03, -HW)]
    for k in range(9):                           # rounded outer corner (bottom)
        a = math.radians(-90 + 90 * k / 8.0)
        prof.append((RO - C + C * math.cos(a), -HW + C + C * math.sin(a)))
    for k in range(9):                           # rounded outer corner (top)
        a = math.radians(0 + 90 * k / 8.0)
        prof.append((RO - C + C * math.cos(a), HW - C + C * math.sin(a)))
    prof.append((RI + 0.03, HW))
    prof.append((RI, HW - 0.03))
    ring = revolve_profile("TR_Body", prof, segments=192)
    smooth(ring); assign(ring, M_RING); parts.append(ring)

    # inner sleeve — open-ended tube lining the bore
    bpy.ops.mesh.primitive_cylinder_add(radius=0.815, depth=0.60, vertices=160,
                                        end_fill_type='NOTHING')
    sleeve = bpy.context.object; sleeve.name = "TR_Sleeve"
    sol = sleeve.modifiers.new("Sol", 'SOLIDIFY')
    sol.thickness = 0.022
    apply_mods(sleeve); smooth(sleeve); assign(sleeve, M_INNER); parts.append(sleeve)

    # engraved accent groove around the outer face
    bpy.ops.mesh.primitive_torus_add(major_radius=1.045, minor_radius=0.020,
                                     major_segments=160, minor_segments=16,
                                     location=(0, 0, 0.155))
    grv = bpy.context.object; grv.name = "TR_Groove"
    smooth(grv); assign(grv, M_LINE); parts.append(grv)

    # inner-facing sensor windows
    for i in range(3):
        a = math.radians(120 * i)
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.105, segments=28, ring_count=14,
            location=(0.800 * math.cos(a), 0.800 * math.sin(a), 0))
        s = bpy.context.object; s.name = "TR_Sensor%d" % i
        s.scale = (0.62, 0.62, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        smooth(s); assign(s, M_SENS); parts.append(s)

    return join(parts, "TeleRing")


# ============================================================
#  STUDIO
# ============================================================
def studio_world():
    w = bpy.context.scene.world
    if w is None:
        w = bpy.data.worlds.new("TC_World")
        bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out   = nt.nodes.new("ShaderNodeOutputWorld"); out.location = (400, 0)
    bg    = nt.nodes.new("ShaderNodeBackground");  bg.location = (200, 0)
    ramp  = nt.nodes.new("ShaderNodeValToRGB");    ramp.location = (0, 0)
    grad  = nt.nodes.new("ShaderNodeTexGradient"); grad.location = (-200, 0)
    grad.gradient_type = 'SPHERICAL'
    coord = nt.nodes.new("ShaderNodeTexCoord");    coord.location = (-420, 0)
    ramp.color_ramp.elements[0].color = (0.005, 0.026, 0.024, 1)
    ramp.color_ramp.elements[1].color = (0.016, 0.090, 0.072, 1)
    nt.links.new(coord.outputs['Window'], grad.inputs['Vector'])
    nt.links.new(grad.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def add_area(name, loc, rot, size, energy, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.size = size; ld.energy = energy; ld.color = color
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc; ob.rotation_euler = rot
    bpy.context.collection.objects.link(ob)
    return ob


def studio_lights():
    add_area("Key",  (4.6, -4.4, 5.6), (math.radians(42), 0, math.radians(46)), 8.0, 1400)
    add_area("Fill", (-5.6, -3.0, 2.2), (math.radians(74), 0, math.radians(-62)), 7.0, 420,
             color=(0.66, 0.94, 0.88))
    add_area("Rim",  (-1.8, 6.0, 3.8), (math.radians(112), 0, math.radians(196)), 6.0, 900,
             color=(0.45, 1.0, 0.80))
    add_area("Top",  (0, 0, 7.0), (0, 0, 0), 10.0, 320)


def add_camera(lens=58):
    cd = bpy.data.cameras.new("Cam"); cd.lens = lens
    cam = bpy.data.objects.new("Cam", cd)
    cam.location = (0, -12, 3)
    bpy.context.collection.objects.link(cam)
    tgt = bpy.data.objects.new("CamTarget", None)
    bpy.context.collection.objects.link(tgt)
    c = cam.constraints.new('TRACK_TO'); c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam
    return cam, tgt


def world_points(objs):
    pts = []
    for o in objs:
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    return pts


def fit_camera(cam, tgt, objs, az_deg, el_deg, margin=1.20, center=None):
    """Frames `objs` from the given azimuth/elevation, respecting render aspect."""
    pts = world_points(objs)
    if center is None:
        center = sum(pts, Vector()) / len(pts)
    radius = max((p - center).length for p in pts)

    sc = bpy.context.scene
    aspect = sc.render.resolution_x / float(sc.render.resolution_y)
    half = cam.data.angle / 2.0            # applies to the larger sensor axis
    if aspect >= 1.0:
        half_x, half_y = half, math.atan(math.tan(half) / aspect)
    else:
        half_y, half_x = half, math.atan(math.tan(half) * aspect)
    half_min = min(half_x, half_y)

    dist = radius / math.sin(half_min) * margin
    az, el = math.radians(az_deg), math.radians(el_deg)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam.location = center + d * dist
    tgt.location = center


def pick_engine():
    keys = bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys()
    for e in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
        if e in keys:
            return e
    return list(keys)[0]


def setup_render(res=(1280, 720), samples=64):
    sc = bpy.context.scene
    sc.render.engine = pick_engine()
    print(">>> engine:", sc.render.engine)
    ee = getattr(sc, 'eevee', None)
    if ee:
        for attr, val in (('taa_render_samples', samples), ('use_bloom', True),
                          ('use_gtao', True), ('use_raytracing', True),
                          ('use_shadows', True)):
            if hasattr(ee, attr):
                try:
                    setattr(ee, attr, val)
                except Exception:
                    pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = 'AgX'
    except Exception:
        pass
    sc.view_settings.exposure = 0.5
    return sc


# ============================================================
#  MAIN
# ============================================================
def main():
    wipe()
    studio_world()
    studio_lights()

    band = build_teleband()
    ring = build_telering()

    def export_glb(obj, path):
        old = (obj.location.copy(), obj.rotation_euler.copy(), obj.scale.copy())
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
        obj.scale = (1, 1, 1)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                                  use_selection=True, export_apply=True,
                                  export_yup=True)
        obj.location, obj.rotation_euler, obj.scale = old
        print("GLB ->", path)

    export_glb(band, os.path.join(OUT_MODELS, "teleband.glb"))
    export_glb(ring, os.path.join(OUT_MODELS, "telering.glb"))

    # ---- staging for renders ----
    band.location = (-1.15, 0, 0.9)
    band.rotation_euler = (math.radians(15), 0, math.radians(-13))
    ring.location = (2.35, 0.35, -0.85)
    ring.rotation_euler = (math.radians(64), 0, math.radians(24))
    ring.scale = (1.05, 1.05, 1.05)

    piv = bpy.data.objects.new("Turntable", None)
    bpy.context.collection.objects.link(piv)
    for o in (band, ring):
        o.parent = piv
        o.matrix_parent_inverse = piv.matrix_world.inverted()
    bpy.context.view_layer.update()

    sc = setup_render((1280, 720), samples=64)
    cam, tgt = add_camera(lens=58)

    # Frame around the turntable axis so nothing clips mid-spin.
    pts = world_points([band, ring])
    spin_centre = Vector((0, 0, (min(p.z for p in pts) + max(p.z for p in pts)) / 2.0))
    fit_camera(cam, tgt, [band, ring], az_deg=0, el_deg=26,
               margin=1.16, center=spin_centre)

    # ---- turntable animation ----
    try:
        bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    except Exception:
        pass
    FR = 120
    sc.frame_start, sc.frame_end = 1, FR
    sc.render.fps = 30
    piv.rotation_euler = (0, 0, 0)
    piv.keyframe_insert("rotation_euler", frame=1)
    piv.rotation_euler = (0, 0, math.radians(360))
    piv.keyframe_insert("rotation_euler", frame=FR + 1)
    for fc in iter_fcurves(piv):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

    if hasattr(sc.render.image_settings, 'media_type'):
        sc.render.image_settings.media_type = 'VIDEO'
    sc.render.image_settings.file_format = 'FFMPEG'
    sc.render.ffmpeg.format = 'MPEG4'
    sc.render.ffmpeg.codec = 'H264'
    sc.render.ffmpeg.constant_rate_factor = 'HIGH'
    sc.render.ffmpeg.ffmpeg_preset = 'GOOD'
    sc.render.ffmpeg.audio_codec = 'NONE'
    sc.render.filepath = os.path.join(OUT_VIDEO, "telecare-product")
    if STILLS_ONLY:
        print(">>> --stills-only: melewati render video")
    else:
        print(">>> rendering turntable video ...")
        bpy.ops.render.render(animation=True)

        # Blender appends the frame range to video filenames — normalise it.
        final = os.path.join(OUT_VIDEO, "telecare-product.mp4")
        for f in glob.glob(os.path.join(OUT_VIDEO, "telecare-product*.mp4")):
            if os.path.abspath(f) != os.path.abspath(final):
                if os.path.exists(final):
                    os.remove(final)
                shutil.move(f, final)
                print("VIDEO ->", final)

    # ---- transparent stills ----
    piv.animation_data_clear()
    piv.rotation_euler = (0, 0, 0)
    if hasattr(sc.render.image_settings, 'media_type'):
        sc.render.image_settings.media_type = 'IMAGE'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.film_transparent = True
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 1200

    shots = [
        ("hero-duo", [band, ring],  22, 34, 1.10, 12),
        ("teleband", [band],       -16, 44, 1.04, -8),
        ("telering", [ring],        38, 26, 1.04, 30),
    ]
    for name, objs, az, el, margin, pivrot in shots:
        piv.rotation_euler = (0, 0, math.radians(pivrot))
        bpy.context.view_layer.update()
        for o in (band, ring):
            o.hide_render = o not in objs
        fit_camera(cam, tgt, objs, az_deg=az, el_deg=el, margin=margin)
        sc.render.filepath = os.path.join(OUT_IMG, "render-%s.png" % name)
        print(">>> still:", name)
        bpy.ops.render.render(write_still=True)
    for o in (band, ring):
        o.hide_render = False

    # ---- social card (opaque, 1.91:1) ----
    sc.render.film_transparent = False
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 630
    piv.rotation_euler = (0, 0, math.radians(16))
    bpy.context.view_layer.update()
    fit_camera(cam, tgt, [band, ring], az_deg=18, el_deg=26, margin=1.28)
    sc.render.filepath = os.path.join(OUT_IMG, "og-cover.png")
    print(">>> still: og-cover")
    bpy.ops.render.render(write_still=True)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "telecare_assets.blend"))
    print("TELECARE_BUILD_DONE")


# Dijaga supaya fungsi pembangun (build_teleband, build_telering, dll.) dapat
# diimpor skrip lain — misalnya build_ikon3d.py — tanpa ikut merender ulang video.
if __name__ == "__main__":
    main()
