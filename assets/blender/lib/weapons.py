"""
Armas de TinyStrike, en el mismo estilo chibi chunky que el personaje.

Contrato de orientación (lo espera el cliente):
  - El origen del objeto está en la EMPUÑADURA, donde lo agarra la mano.
  - El cañón apunta hacia +Y en Blender, que al exportar con "+Y up" se
    convierte en -Z de glTF: la dirección de disparo del juego.
  - La parte de arriba del arma es +Z en Blender.

Los nombres de objeto son los ids de `packages/config/src/weapons.ts`, así que
el cliente puede pedir un arma por su id sin ninguna tabla intermedia.
"""
import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials


def _bevel_all(obj, width=0.0035, segments=2, angle=0.7):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = [e for e in bm.edges if e.calc_face_angle(0.0) > angle]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=width, segments=segments,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def block(name, size, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0035, taper=None):
    """Bloque biselado. `taper` encoge la cara delantera (+Y) para dar forma."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    if taper:
        for v in bm.verts:
            if v.co.y > 0:
                v.co.x *= taper
                v.co.z *= taper
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if bevel:
        _bevel_all(obj, bevel)
    return obj


def tube(name, radius, length, loc=(0, 0, 0), rot=(0, 0, 0), segments=10, bevel=0.0018):
    """Cilindro a lo largo de +Y (el eje del cañón)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=length)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=Matrix.Rotation(1.5707963, 3, "X"))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if bevel:
        _bevel_all(obj, bevel)
    return obj


def _finish(name, pieces, mat_body, mat_dark=None, mat_accent=None):
    """Une las piezas del arma en un solo objeto con el id como nombre."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in pieces:
        p.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    if len(pieces) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


# --------------------------------------------------------------- materiales

def _mats():
    return {
        "body": materials.fixed("Gun_Body", (0.055, 0.058, 0.066, 1.0), roughness=0.42, metallic=0.55),
        "dark": materials.fixed("Gun_Dark", (0.028, 0.030, 0.035, 1.0), roughness=0.55, metallic=0.35),
        "grip": materials.fixed("Gun_Grip", (0.040, 0.042, 0.048, 1.0), roughness=0.85),
        "accent": materials.fixed("Gun_Accent", (0.42, 0.34, 0.16, 1.0), roughness=0.35, metallic=0.75),
        "wood": materials.fixed("Gun_Wood", (0.20, 0.11, 0.055, 1.0), roughness=0.62),
        "blade": materials.fixed("Gun_Blade", (0.62, 0.65, 0.70, 1.0), roughness=0.18, metallic=0.95),
    }


def _apply(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ------------------------------------------------------------------- armas

def build_knife():
    m = _mats()
    grip = block("k_grip", (0.016, 0.052, 0.020), loc=(0, 0.010, 0))
    guard = block("k_guard", (0.030, 0.006, 0.008), loc=(0, 0.046, 0))
    blade = block("k_blade", (0.006, 0.075, 0.022), loc=(0, 0.122, 0.002), taper=0.18)
    for p, mat in ((grip, m["grip"]), (guard, m["dark"]), (blade, m["blade"])):
        _apply(p, mat)
    return _finish("knife", [blade, guard, grip], m["body"])


def build_pistol_basic():
    m = _mats()
    grip = block("p_grip", (0.018, 0.024, 0.048), loc=(0, 0.004, -0.018), rot=(-0.22, 0, 0))
    frame = block("p_frame", (0.020, 0.062, 0.020), loc=(0, 0.040, 0.022))
    slide = block("p_slide", (0.022, 0.078, 0.022), loc=(0, 0.048, 0.040))
    barrel = tube("p_barrel", 0.006, 0.030, loc=(0, 0.098, 0.040))
    guard = block("p_guard", (0.012, 0.028, 0.006), loc=(0, 0.030, 0.004))
    sight = block("p_sight", (0.004, 0.006, 0.006), loc=(0, 0.080, 0.054))
    for p, mat in ((grip, m["grip"]), (frame, m["body"]), (slide, m["body"]),
                   (barrel, m["dark"]), (guard, m["body"]), (sight, m["dark"])):
        _apply(p, mat)
    return _finish("pistol_basic", [slide, frame, barrel, guard, sight, grip], m["body"])


def build_pistol_heavy():
    m = _mats()
    grip = block("r_grip", (0.020, 0.028, 0.054), loc=(0, 0.002, -0.020), rot=(-0.26, 0, 0))
    frame = block("r_frame", (0.020, 0.052, 0.024), loc=(0, 0.034, 0.026))
    cyl = tube("r_cyl", 0.019, 0.034, loc=(0, 0.040, 0.034), segments=8)
    barrel = tube("r_barrel", 0.008, 0.072, loc=(0, 0.092, 0.034))
    rib = block("r_rib", (0.006, 0.070, 0.006), loc=(0, 0.092, 0.046))
    guard = block("r_guard", (0.012, 0.030, 0.006), loc=(0, 0.028, 0.004))
    for p, mat in ((grip, m["wood"]), (frame, m["body"]), (cyl, m["body"]),
                   (barrel, m["dark"]), (rib, m["dark"]), (guard, m["body"])):
        _apply(p, mat)
    return _finish("pistol_heavy", [frame, cyl, barrel, rib, guard, grip], m["body"])


def build_smg_bubble():
    m = _mats()
    grip = block("s_grip", (0.018, 0.024, 0.050), loc=(0, 0, -0.020), rot=(-0.20, 0, 0))
    body = block("s_body", (0.024, 0.100, 0.034), loc=(0, 0.052, 0.024))
    top = block("s_top", (0.020, 0.084, 0.012), loc=(0, 0.052, 0.046))
    mag = block("s_mag", (0.014, 0.020, 0.052), loc=(0, 0.046, -0.016), rot=(0.12, 0, 0))
    barrel = tube("s_barrel", 0.007, 0.052, loc=(0, 0.126, 0.026))
    shroud = block("s_shroud", (0.016, 0.040, 0.016), loc=(0, 0.118, 0.026))
    stock = block("s_stock", (0.012, 0.050, 0.020), loc=(0, -0.040, 0.026))
    guard = block("s_guard", (0.012, 0.026, 0.006), loc=(0, 0.024, 0.002))
    for p, mat in ((grip, m["grip"]), (body, m["body"]), (top, m["dark"]), (mag, m["dark"]),
                   (barrel, m["dark"]), (shroud, m["body"]), (stock, m["dark"]), (guard, m["body"])):
        _apply(p, mat)
    return _finish("smg_bubble", [body, top, shroud, barrel, mag, stock, guard, grip], m["body"])


def build_rifle_star():
    m = _mats()
    grip = block("a_grip", (0.019, 0.026, 0.052), loc=(0, 0, -0.022), rot=(-0.22, 0, 0))
    receiver = block("a_recv", (0.026, 0.120, 0.038), loc=(0, 0.062, 0.026))
    rail = block("a_rail", (0.020, 0.150, 0.010), loc=(0, 0.080, 0.048))
    hand = block("a_hand", (0.024, 0.100, 0.030), loc=(0, 0.168, 0.026))
    barrel = tube("a_barrel", 0.008, 0.090, loc=(0, 0.252, 0.026))
    muzzle = tube("a_muzzle", 0.012, 0.026, loc=(0, 0.302, 0.026), segments=8)
    mag = block("a_mag", (0.015, 0.026, 0.070), loc=(0, 0.052, -0.024), rot=(0.18, 0, 0))
    stock = block("a_stock", (0.016, 0.070, 0.030), loc=(0, -0.052, 0.024))
    butt = block("a_butt", (0.018, 0.012, 0.046), loc=(0, -0.090, 0.022))
    guard = block("a_guard", (0.012, 0.028, 0.006), loc=(0, 0.026, 0.000))
    sight = block("a_sight", (0.010, 0.016, 0.014), loc=(0, 0.132, 0.058))
    for p, mat in ((grip, m["grip"]), (receiver, m["body"]), (rail, m["dark"]), (hand, m["body"]),
                   (barrel, m["dark"]), (muzzle, m["dark"]), (mag, m["dark"]), (stock, m["body"]),
                   (butt, m["grip"]), (guard, m["body"]), (sight, m["dark"])):
        _apply(p, mat)
    return _finish("rifle_star", [receiver, rail, hand, barrel, muzzle, mag, stock, butt, guard, sight, grip], m["body"])


def build_sniper_comet():
    m = _mats()
    grip = block("n_grip", (0.019, 0.026, 0.052), loc=(0, 0, -0.022), rot=(-0.20, 0, 0))
    receiver = block("n_recv", (0.026, 0.130, 0.036), loc=(0, 0.066, 0.026))
    barrel = tube("n_barrel", 0.009, 0.230, loc=(0, 0.248, 0.026))
    brake = tube("n_brake", 0.014, 0.030, loc=(0, 0.372, 0.026), segments=8)
    scope = tube("n_scope", 0.017, 0.110, loc=(0, 0.086, 0.068), segments=12)
    lens = tube("n_lens", 0.019, 0.016, loc=(0, 0.036, 0.068), segments=12)
    mount = block("n_mount", (0.008, 0.070, 0.016), loc=(0, 0.086, 0.050))
    mag = block("n_mag", (0.014, 0.022, 0.044), loc=(0, 0.054, -0.014))
    stock = block("n_stock", (0.017, 0.090, 0.032), loc=(0, -0.062, 0.024))
    cheek = block("n_cheek", (0.016, 0.052, 0.012), loc=(0, -0.048, 0.046))
    butt = block("n_butt", (0.019, 0.012, 0.050), loc=(0, -0.110, 0.020))
    guard = block("n_guard", (0.012, 0.028, 0.006), loc=(0, 0.026, 0.000))
    for p, mat in ((grip, m["grip"]), (receiver, m["body"]), (barrel, m["dark"]), (brake, m["dark"]),
                   (scope, m["dark"]), (lens, m["accent"]), (mount, m["body"]), (mag, m["dark"]),
                   (stock, m["body"]), (cheek, m["grip"]), (butt, m["grip"]), (guard, m["body"])):
        _apply(p, mat)
    return _finish("sniper_comet", [receiver, barrel, brake, scope, lens, mount, mag, stock, cheek, butt, guard, grip], m["body"])


def build_shotgun_pop():
    m = _mats()
    grip = block("g_grip", (0.019, 0.026, 0.050), loc=(0, 0, -0.020), rot=(-0.20, 0, 0))
    receiver = block("g_recv", (0.028, 0.090, 0.036), loc=(0, 0.048, 0.026))
    barrel = tube("g_barrel", 0.013, 0.180, loc=(0, 0.180, 0.032), segments=10)
    mag_tube = tube("g_tube", 0.010, 0.150, loc=(0, 0.164, 0.008), segments=8)
    pump = block("g_pump", (0.024, 0.048, 0.024), loc=(0, 0.140, 0.010))
    stock = block("g_stock", (0.017, 0.080, 0.032), loc=(0, -0.050, 0.024))
    butt = block("g_butt", (0.019, 0.012, 0.048), loc=(0, -0.094, 0.022))
    guard = block("g_guard", (0.012, 0.028, 0.006), loc=(0, 0.024, 0.000))
    for p, mat in ((grip, m["wood"]), (receiver, m["body"]), (barrel, m["dark"]), (mag_tube, m["dark"]),
                   (pump, m["wood"]), (stock, m["wood"]), (butt, m["grip"]), (guard, m["body"])):
        _apply(p, mat)
    return _finish("shotgun_pop", [receiver, barrel, mag_tube, pump, stock, butt, guard, grip], m["body"])


def build_grenade_frag():
    m = _mats()
    body = tube("f_body", 0.030, 0.052, loc=(0, 0.020, 0), segments=12, bevel=0.006)
    body.rotation_euler = (1.5707963, 0, 0)
    cap = tube("f_cap", 0.013, 0.016, loc=(0, 0.052, 0), segments=8)
    cap.rotation_euler = (1.5707963, 0, 0)
    lever = block("f_lever", (0.006, 0.034, 0.008), loc=(0.018, 0.030, 0.006))
    shell = materials.fixed("Nade_Frag", (0.14, 0.20, 0.13, 1.0), roughness=0.62)
    for p, mat in ((body, shell), (cap, m["dark"]), (lever, m["accent"])):
        _apply(p, mat)
    return _finish("grenade_frag", [body, cap, lever], shell)


def build_grenade_smoke():
    m = _mats()
    body = tube("m_body", 0.024, 0.070, loc=(0, 0.028, 0), segments=12, bevel=0.004)
    body.rotation_euler = (1.5707963, 0, 0)
    cap = tube("m_cap", 0.012, 0.018, loc=(0, 0.068, 0), segments=8)
    cap.rotation_euler = (1.5707963, 0, 0)
    band = tube("m_band", 0.026, 0.010, loc=(0, 0.030, 0), segments=12)
    band.rotation_euler = (1.5707963, 0, 0)
    shell = materials.fixed("Nade_Smoke", (0.60, 0.62, 0.66, 1.0), roughness=0.5)
    accent = materials.fixed("Nade_Band", (0.75, 0.72, 0.28, 1.0), roughness=0.45)
    for p, mat in ((body, shell), (cap, m["dark"]), (band, accent)):
        _apply(p, mat)
    return _finish("grenade_smoke", [body, band, cap], shell)


BUILDERS = {
    "knife": build_knife,
    "pistol_basic": build_pistol_basic,
    "pistol_heavy": build_pistol_heavy,
    "smg_bubble": build_smg_bubble,
    "rifle_star": build_rifle_star,
    "sniper_comet": build_sniper_comet,
    "shotgun_pop": build_shotgun_pop,
    "grenade_frag": build_grenade_frag,
    "grenade_smoke": build_grenade_smoke,
}
