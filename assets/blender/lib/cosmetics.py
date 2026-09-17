"""
Piezas de personalización, modeladas en Blender.

Convención de nombres: cada objeto se llama `<idDelCosmetico>__<Pieza>`.
  - La primera mitad es el id del catálogo (packages/config/src/customization.ts).
  - La segunda es la pieza, que el cliente usa para saber a qué hueso del rig
    la engancha (ver PART_SOCKET en apps/client/src/customization/glb.ts).

Así un cosmético puede constar de varias mallas (un pantalón son cadera, dos
muslos y dos pantorrillas) y seguir siendo intercambiable de una pieza.
"""
import math

import bpy

from . import clothing, materials
from . import proportions as P
from . import sculpt
from .mesh import Ring, cube_sphere, new_object, rings_to_mesh


def _head_space(objects):
    """
    Sube las piezas construidas en el espacio de la CABEZA a su sitio en el
    mundo. Pelo, gorros, gafas y auriculares se modelan con la barbilla en z=0
    porque así son independientes de la altura del personaje; al exportar hay
    que dejarlos donde va la cabeza.
    """
    for obj in objects:
        obj.location = (obj.location.x, obj.location.y, obj.location.z + P.Y_CHIN)
    return objects


def _rename(objects, cosmetic_id):
    out = []
    for obj in objects:
        obj.name = f"{cosmetic_id}__{obj.name}"
        obj.data.name = obj.name
        out.append(obj)
    return out


def _shell(name, rings, segments=14, cap_bottom=True, cap_top=True):
    verts, faces = rings_to_mesh(rings, segments=segments,
                                 cap_bottom=cap_bottom, cap_top=cap_top)
    return new_object(name, verts, faces)


def _blob(name, radius, scale=(1, 1, 1), loc=(0, 0, 0), subdiv=2):
    verts, faces = cube_sphere(subdiv)
    pts = [(v[0] * radius * scale[0], v[1] * radius * scale[1], v[2] * radius * scale[2]) for v in verts]
    obj = new_object(name, pts, faces)
    obj.location = loc
    return obj


# =====================================================================  pelo

def _hair_base(from_h, inflate, nape_to=0.0):
    """Casquete que sigue el cráneo, con opción de bajar por la nuca."""
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    t = inflate
    rings = [
        Ring(H * from_h, W * 0.99 + t, D * 0.99 + t, n=2.4, front=0.96, back=1.08),
        Ring(H * (from_h + 0.10), W * 0.99 + t, D * 0.99 + t, n=2.3, front=0.97, back=1.09),
        Ring(H * 0.74, W * 0.94 + t, D * 0.95 + t, n=2.3, front=1.00, back=1.07),
        Ring(H * 0.86, W * 0.80 + t, D * 0.81 + t, n=2.3),
        Ring(H * 0.95, W * 0.55 + t, D * 0.56 + t, n=2.3),
        Ring(H * 1.00, W * 0.18, D * 0.18, n=2.3),
    ]
    verts, faces = rings_to_mesh(rings, segments=16, cap_bottom=False)
    if nape_to:
        verts = sculpt.push(verts, (0.0, -D * 0.94, H * from_h),
                            (0.0, -0.15, -1.0), W * 0.85, H * nape_to)
    return verts, faces


def hair_spiky():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    verts, faces = _hair_base(0.54, 0.012, nape_to=0.14)
    for i in range(7):
        f = (i / 6.0) * 2.0 - 1.0
        ang = f * 1.15
        verts = sculpt.push(verts, (math.sin(ang) * W * 0.92, math.cos(ang) * D * 0.92, H * 0.56),
                            (0.0, 0.10, -1.0), W * 0.30, H * (0.105 - 0.045 * abs(f)))
    # Puntas hacia arriba: la silueta inconfundible de este peinado
    for i in range(8):
        a = (i / 8) * math.tau + 0.3
        verts = sculpt.push(verts, (math.cos(a) * W * 0.58, math.sin(a) * D * 0.58, H * 0.94),
                            (math.cos(a) * 0.35, math.sin(a) * 0.35, 1.0), W * 0.34, H * 0.16)
    obj = new_object("Hair", verts, faces)
    materials.assign(obj, materials.recolor("hair", roughness=0.72))
    return _rename(_head_space([obj]), "hair_spiky")


def hair_buzz():
    verts, faces = _hair_base(0.46, 0.005, nape_to=0.10)
    obj = new_object("Hair", verts, faces)
    materials.assign(obj, materials.recolor("hair", roughness=0.95))
    return _rename(_head_space([obj]), "hair_buzz")


def hair_bob():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    verts, faces = _hair_base(0.36, 0.016, nape_to=0.22)
    # Melena que enmarca la cara hasta la mandíbula
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.94, D * 0.10, H * 0.40),
                            (0.0, 0.0, -1.0), W * 0.46, H * 0.30)
    verts = sculpt.push(verts, (0.0, D * 0.92, H * 0.52), (0.0, 0.10, -1.0), W * 0.60, H * 0.10)
    obj = new_object("Hair", verts, faces)
    materials.assign(obj, materials.recolor("hair", roughness=0.72))
    return _rename(_head_space([obj]), "hair_bob")


def hair_ponytail():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    verts, faces = _hair_base(0.50, 0.013, nape_to=0.16)
    obj = new_object("Hair", verts, faces)
    materials.assign(obj, materials.recolor("hair", roughness=0.72))
    tail = _shell("HairTail", [
        Ring(0.0, W * 0.20, W * 0.20, n=2.4),
        Ring(-H * 0.22, W * 0.32, W * 0.32, n=2.4),
        Ring(-H * 0.52, W * 0.27, W * 0.27, n=2.4),
        Ring(-H * 0.80, W * 0.10, W * 0.10, n=2.4),
    ], segments=12)
    tail.location = (0.0, -D * 0.92, H * 0.74)
    tail.rotation_euler = (0.42, 0.0, 0.0)
    materials.assign(tail, materials.recolor("hair", roughness=0.72))
    tie = _shell("HairTie", [
        Ring(-0.008, W * 0.24, W * 0.24, n=2.6),
        Ring(0.008, W * 0.24, W * 0.24, n=2.6),
    ], segments=10)
    tie.location = (0.0, -D * 0.88, H * 0.70)
    materials.assign(tie, materials.recolor("secondary", roughness=0.7))
    return _rename(_head_space([obj, tail, tie]), "hair_ponytail")


def hair_afro():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    puff = _shell("Hair", [
        Ring(H * 0.28, W * 0.60, D * 0.58, n=2.5, front=0.55),
        Ring(H * 0.48, W * 1.02, D * 1.00, n=2.5, front=0.60),
        Ring(H * 0.68, W * 1.22, D * 1.20, n=2.5, front=0.64),
        Ring(H * 0.86, W * 1.14, D * 1.12, n=2.5, front=0.68),
        Ring(H * 1.02, W * 0.78, D * 0.76, n=2.5, front=0.76),
        Ring(H * 1.12, W * 0.26, D * 0.26, n=2.5),
    ], segments=18)
    puff.location = (0.0, -W * 0.10, 0.0)
    materials.assign(puff, materials.recolor("hair", roughness=0.85))
    return _rename(_head_space([puff]), "hair_afro")


# ================================================================  sombreros

def headwear_cap():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    crown = _shell("Hat", [
        Ring(H * 0.50, W * 1.02, D * 1.02, n=2.4, front=0.97, back=1.07),
        Ring(H * 0.70, W * 1.00, D * 1.00, n=2.3),
        Ring(H * 0.88, W * 0.80, D * 0.81, n=2.3),
        Ring(H * 1.00, W * 0.40, D * 0.40, n=2.3),
    ], segments=16, cap_bottom=False)
    materials.assign(crown, materials.recolor("secondary", roughness=0.85))
    peak = _shell("HatPeak", [
        Ring(0.0, W * 0.72, D * 0.42, n=3.6),
        Ring(H * 0.030, W * 0.78, D * 0.46, n=3.4),
    ], segments=16)
    peak.location = (0.0, D * 0.62, H * 0.50)
    peak.rotation_euler = (-0.16, 0.0, 0.0)
    materials.assign(peak, materials.recolor("secondary", roughness=0.85))
    return _rename(_head_space([crown, peak]), "headwear_cap")


def headwear_beanie():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    cap = _shell("Hat", [
        Ring(H * 0.42, W * 1.04, D * 1.04, n=2.4),
        Ring(H * 0.50, W * 1.08, D * 1.08, n=2.4),
        Ring(H * 0.56, W * 1.03, D * 1.03, n=2.3),
        Ring(H * 0.76, W * 0.99, D * 0.99, n=2.3),
        Ring(H * 0.90, W * 0.78, D * 0.79, n=2.3),
        Ring(H * 1.01, W * 0.34, D * 0.34, n=2.3),
    ], segments=16, cap_bottom=False)
    materials.assign(cap, materials.recolor("secondary", roughness=0.92))
    pom = _blob("HatPom", W * 0.30, loc=(0.0, 0.0, H * 1.06), subdiv=2)
    materials.assign(pom, materials.fixed("Pom", (0.86, 0.87, 0.90, 1.0), roughness=0.95))
    return _rename(_head_space([cap, pom]), "headwear_beanie")


def headwear_helmet_tactical():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    shell = _shell("Hat", [
        Ring(H * 0.44, W * 1.06, D * 1.06, n=2.8, front=0.98, back=1.06),
        Ring(H * 0.62, W * 1.05, D * 1.05, n=2.7),
        Ring(H * 0.82, W * 0.92, D * 0.93, n=2.6),
        Ring(H * 0.96, W * 0.60, D * 0.60, n=2.6),
        Ring(H * 1.02, W * 0.22, D * 0.22, n=2.6),
    ], segments=16, cap_bottom=False)
    mat = materials.fixed("Helmet", (0.055, 0.060, 0.058, 1.0), roughness=0.55)
    materials.assign(shell, mat)
    brim = _shell("HatBrim", [
        Ring(0.0, W * 0.86, D * 0.30, n=3.4),
        Ring(H * 0.04, W * 0.90, D * 0.34, n=3.2),
    ], segments=14)
    brim.location = (0.0, D * 0.72, H * 0.48)
    brim.rotation_euler = (-0.26, 0.0, 0.0)
    materials.assign(brim, mat)
    rails = []
    rail_mat = materials.fixed("HelmetRail", (0.030, 0.032, 0.036, 1.0), roughness=0.45)
    for side in (-1, 1):
        r = _shell(f"HatRail{'L' if side < 0 else 'R'}", [
            Ring(-D * 0.36, W * 0.06, H * 0.035, n=3.6),
            Ring(D * 0.36, W * 0.06, H * 0.035, n=3.6),
        ], segments=8)
        r.rotation_euler = (math.radians(90), 0.0, 0.0)
        r.location = (side * W * 1.08, 0.0, H * 0.66)
        materials.assign(r, rail_mat)
        rails.append(r)
    return _rename(_head_space([shell, brim] + rails), "headwear_helmet_tactical")


def headwear_cat_ears():
    H, W = P.HEAD_H, P.HEAD_W
    pieces = []
    outer = materials.recolor("primary", roughness=0.8)
    inner = materials.fixed("CatInner", (0.85, 0.55, 0.62, 1.0), roughness=0.9)
    band = _shell("Hat", [
        Ring(-H * 0.02, W * 1.00, W * 1.00, n=2.4),
        Ring(H * 0.02, W * 1.00, W * 1.00, n=2.4),
    ], segments=18)
    band.location = (0.0, 0.0, H * 0.70)
    materials.assign(band, outer)
    pieces.append(band)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        ear = _shell(f"HatEar{tag}", [
            Ring(0.0, W * 0.30, W * 0.16, n=2.4),
            Ring(H * 0.16, W * 0.20, W * 0.11, n=2.4),
            Ring(H * 0.30, W * 0.03, W * 0.02, n=2.4),
        ], segments=10)
        ear.location = (side * W * 0.58, -W * 0.05, H * 0.86)
        ear.rotation_euler = (0.0, -side * 0.30, 0.0)
        materials.assign(ear, outer)
        pieces.append(ear)
        cup = _shell(f"HatEarIn{tag}", [
            Ring(0.0, W * 0.16, W * 0.06, n=2.4),
            Ring(H * 0.20, W * 0.02, W * 0.02, n=2.4),
        ], segments=8)
        cup.location = (side * W * 0.58, W * 0.04, H * 0.90)
        cup.rotation_euler = (0.0, -side * 0.30, 0.0)
        materials.assign(cup, inner)
        pieces.append(cup)
    return _rename(_head_space(pieces), "headwear_cat_ears")


# ====================================================================  gafas

def _eye_level():
    return P.HEAD_H * 0.380, P.HEAD_D * 0.86


def eyewear_round():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    z, y = _eye_level()
    frame = materials.fixed("GlassFrame", (0.06, 0.06, 0.07, 1.0), roughness=0.35, metallic=0.6)
    glass = materials.fixed("GlassLens", (0.72, 0.86, 0.95, 1.0), roughness=0.12, alpha=0.4)
    pieces = []
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        ring = _shell(f"GlassesRing{tag}", [
            Ring(-W * 0.018, W * 0.235, W * 0.235, n=2.2),
            Ring(W * 0.018, W * 0.235, W * 0.235, n=2.2),
        ], segments=14)
        ring.rotation_euler = (math.radians(90), 0, 0)
        ring.location = (side * W * 0.345, y, z)
        ring.scale = (1.0, 1.0, 0.22)
        materials.assign(ring, frame)
        pieces.append(ring)
        lens = _blob(f"GlassesLens{tag}", W * 0.215, scale=(1.0, 0.10, 1.0),
                     loc=(side * W * 0.345, y - W * 0.01, z))
        materials.assign(lens, glass)
        pieces.append(lens)
        arm = _shell(f"GlassesArm{tag}", [
            Ring(-D * 0.42, W * 0.030, W * 0.030, n=3.0),
            Ring(D * 0.42, W * 0.030, W * 0.030, n=3.0),
        ], segments=6)
        arm.rotation_euler = (math.radians(90), 0, 0)
        arm.location = (side * W * 0.66, y - D * 0.42, z + H * 0.02)
        materials.assign(arm, frame)
        pieces.append(arm)
    bridge = _shell("GlassesBridge", [
        Ring(-W * 0.09, W * 0.028, W * 0.028, n=3.0),
        Ring(W * 0.09, W * 0.028, W * 0.028, n=3.0),
    ], segments=6)
    bridge.rotation_euler = (0, math.radians(90), 0)
    bridge.location = (0.0, y, z)
    materials.assign(bridge, frame)
    pieces.append(bridge)
    return _rename(_head_space(pieces), "eyewear_round")


def eyewear_goggles():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    z, y = _eye_level()
    frame = materials.fixed("GoggleFrame", (0.045, 0.048, 0.052, 1.0), roughness=0.6)
    lensmat = materials.fixed("GoggleLens", (0.35, 0.70, 0.52, 1.0), roughness=0.15, metallic=0.5)
    pieces = []
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        cup = _shell(f"GogglesCup{tag}", [
            Ring(-W * 0.05, W * 0.255, H * 0.110, n=3.2),
            Ring(W * 0.045, W * 0.275, H * 0.122, n=3.0),
        ], segments=14)
        cup.rotation_euler = (math.radians(90), 0, 0)
        cup.location = (side * W * 0.36, y - W * 0.02, z)
        materials.assign(cup, frame)
        pieces.append(cup)
        lens = _blob(f"GogglesLens{tag}", W * 0.215, scale=(1.05, 0.28, 0.78),
                     loc=(side * W * 0.36, y + W * 0.05, z))
        materials.assign(lens, lensmat)
        pieces.append(lens)
    strap = _shell("GogglesStrap", [
        Ring(-W * 0.04, W * 1.06, D * 1.04, n=2.5),
        Ring(W * 0.04, W * 1.06, D * 1.04, n=2.5),
    ], segments=18, cap_bottom=False, cap_top=False)
    strap.location = (0.0, -D * 0.06, z)
    materials.assign(strap, frame)
    pieces.append(strap)
    return _rename(_head_space(pieces), "eyewear_goggles")


def eyewear_visor():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    z, y = _eye_level()
    glow = materials.recolor("secondary", roughness=0.2)
    band = _shell("Visor", [
        Ring(-H * 0.05, W * 1.00, D * 0.62, n=3.4),
        Ring(H * 0.05, W * 1.03, D * 0.66, n=3.2),
    ], segments=18)
    band.location = (0.0, -D * 0.22, z)
    materials.assign(band, glow)
    return _rename(_head_space([band]), "eyewear_visor")


# =================================================  accesorios de cabeza

def headacc_headset():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    shell_mat = materials.fixed("HeadsetShell", (0.055, 0.058, 0.066, 1.0), roughness=0.5)
    pad = materials.fixed("HeadsetPad", (0.030, 0.032, 0.038, 1.0), roughness=0.95)
    pieces = []
    band = _shell("HeadsetBand", [
        Ring(-W * 0.05, W * 1.07, D * 1.05, n=2.4),
        Ring(W * 0.05, W * 1.07, D * 1.05, n=2.4),
    ], segments=18, cap_bottom=False, cap_top=False)
    band.rotation_euler = (0.0, math.radians(90), 0.0)
    band.location = (0.0, -D * 0.02, H * 0.60)
    band.scale = (1.0, 1.0, 0.52)
    materials.assign(band, shell_mat)
    pieces.append(band)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        cup = _shell(f"HeadsetCup{tag}", [
            Ring(-W * 0.10, W * 0.20, W * 0.22, n=3.0),
            Ring(0.0, W * 0.23, W * 0.26, n=2.8),
            Ring(W * 0.08, W * 0.19, W * 0.21, n=3.0),
        ], segments=12)
        cup.rotation_euler = (0.0, math.radians(90), 0.0)
        cup.location = (side * W * 1.05, -D * 0.04, H * 0.42)
        materials.assign(cup, shell_mat)
        pieces.append(cup)
        cushion = _blob(f"HeadsetPad{tag}", W * 0.18, scale=(0.42, 1.05, 1.0),
                        loc=(side * W * 0.93, -D * 0.04, H * 0.42))
        materials.assign(cushion, pad)
        pieces.append(cushion)
    boom = _shell("HeadsetBoom", [
        Ring(-W * 0.44, W * 0.026, W * 0.026, n=3.0),
        Ring(W * 0.44, W * 0.026, W * 0.026, n=3.0),
    ], segments=6)
    boom.rotation_euler = (0.0, math.radians(72), math.radians(-38))
    boom.location = (-W * 0.76, D * 0.34, H * 0.30)
    materials.assign(boom, pad)
    pieces.append(boom)
    return _rename(_head_space(pieces), "headacc_headset")


def headacc_earmuffs():
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    mat = materials.fixed("Earmuff", (0.075, 0.080, 0.075, 1.0), roughness=0.9)
    pieces = []
    band = _shell("EarmuffBand", [
        Ring(-W * 0.06, W * 1.05, D * 1.03, n=2.4),
        Ring(W * 0.06, W * 1.05, D * 1.03, n=2.4),
    ], segments=18, cap_bottom=False, cap_top=False)
    band.rotation_euler = (0.0, math.radians(90), 0.0)
    band.location = (0.0, -D * 0.02, H * 0.58)
    band.scale = (1.0, 1.0, 0.50)
    materials.assign(band, mat)
    pieces.append(band)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        cup = _shell(f"EarmuffCup{tag}", [
            Ring(-W * 0.12, W * 0.26, W * 0.27, n=3.6),
            Ring(W * 0.10, W * 0.26, W * 0.27, n=3.6),
        ], segments=12)
        cup.rotation_euler = (0.0, math.radians(90), 0.0)
        cup.location = (side * W * 1.02, -D * 0.04, H * 0.42)
        materials.assign(cup, mat)
        pieces.append(cup)
    return _rename(_head_space(pieces), "headacc_earmuffs")


# ==================================================================  mochila

def back_backpack():
    T = P.TORSO_H
    mat = materials.fixed("Backpack", (0.085, 0.090, 0.082, 1.0), roughness=0.92)
    strap_mat = materials.fixed("BackpackStrap", (0.045, 0.048, 0.044, 1.0), roughness=0.95)
    bag = _shell("Backpack", [
        Ring(T * -0.18, P.CHEST_W * 0.76, P.CHEST_W * 0.34, n=4.0),
        Ring(T * -0.02, P.CHEST_W * 0.88, P.CHEST_W * 0.42, n=3.6),
        Ring(T * 0.26, P.CHEST_W * 0.86, P.CHEST_W * 0.42, n=3.6),
        Ring(T * 0.36, P.CHEST_W * 0.70, P.CHEST_W * 0.34, n=3.8),
    ], segments=14)
    bag.location = (0.0, -P.CHEST_W * 0.92, P.Y_HIP + T * 0.40)
    materials.assign(bag, mat)
    pieces = [bag]
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        strap = _shell(f"BackpackStrap{tag}", [
            Ring(-T * 0.30, P.SHOULDER_W * 0.13, P.CHEST_W * 0.11, n=3.6),
            Ring(T * 0.30, P.SHOULDER_W * 0.13, P.CHEST_W * 0.11, n=3.6),
        ], segments=8)
        strap.location = (side * P.SHOULDER_W * 0.50, P.CHEST_W * 0.50, P.Y_HIP + T * 0.60)
        strap.rotation_euler = (0.12, 0.0, 0.0)
        materials.assign(strap, strap_mat)
        pieces.append(strap)
    return _rename(pieces, "back_backpack")


def accessory_scarf():
    T = P.TORSO_H
    mat = materials.recolor("primary", roughness=0.95)
    collar = _shell("Scarf", [
        Ring(-0.014, P.SHOULDER_W * 0.56, P.SHOULDER_W * 0.52, n=2.8),
        Ring(0.016, P.SHOULDER_W * 0.62, P.SHOULDER_W * 0.58, n=2.6),
        Ring(0.046, P.SHOULDER_W * 0.58, P.SHOULDER_W * 0.54, n=2.6),
    ], segments=16)
    collar.location = (0.0, 0.0, P.Y_HIP + T * 0.99)
    materials.assign(collar, mat)
    tail = _shell("ScarfTail", [
        Ring(-T * 0.50, P.CHEST_W * 0.22, P.CHEST_W * 0.09, n=3.2),
        Ring(-T * 0.20, P.CHEST_W * 0.24, P.CHEST_W * 0.10, n=3.0),
        Ring(0.0, P.CHEST_W * 0.20, P.CHEST_W * 0.09, n=3.0),
    ], segments=10)
    tail.location = (P.CHEST_W * 0.34, P.CHEST_W * 0.62, P.Y_HIP + T * 0.92)
    tail.rotation_euler = (0.0, 0.14, 0.0)
    materials.assign(tail, mat)
    return _rename([collar, tail], "accessory_scarf")


def accessory_mask():
    T = P.TORSO_H
    mat = materials.fixed("NeckMask", (0.06, 0.065, 0.062, 1.0), roughness=0.95)
    tube = _shell("Mask", [
        Ring(0.0, P.SHOULDER_W * 0.58, P.SHOULDER_W * 0.54, n=2.8),
        Ring(0.045, P.SHOULDER_W * 0.50, P.SHOULDER_W * 0.47, n=2.6),
        Ring(0.090, P.SHOULDER_W * 0.52, P.SHOULDER_W * 0.50, n=2.6),
    ], segments=16)
    tube.location = (0.0, 0.0, P.Y_HIP + T * 0.97)
    materials.assign(tube, mat)
    return _rename([tube], "accessory_mask")


# ===================================================================  ropa

def top_tee():
    return _rename([clothing.build_shirt(channel="secondary")] + clothing.build_sleeves(to_wrist=False), "top_tee")


def top_longsleeve():
    return _rename([clothing.build_shirt(channel="secondary")] + clothing.build_sleeves(), "top_longsleeve")


def outer_vest_tactical():
    return _rename(clothing.build_vest(), "outer_vest_tactical")


def outer_hoodie():
    pieces = [clothing.build_shirt(name="Hoodie", channel="primary", hem=-0.20)]
    pieces += clothing.build_sleeves(prefix="HoodieSleeve", channel="primary")
    T = P.TORSO_H
    hood = _blob("HoodieHood", P.CHEST_W * 0.92, scale=(1.0, 0.62, 0.72),
                 loc=(0.0, -P.CHEST_W * 0.60, P.Y_HIP + T * 0.96))
    materials.assign(hood, materials.recolor("primary", roughness=0.9))
    pieces.append(hood)
    return _rename(pieces, "outer_hoodie")


def outer_jacket():
    pieces = [clothing.build_shirt(name="Jacket", channel="primary", hem=-0.10)]
    pieces += clothing.build_sleeves(prefix="JacketSleeve", channel="primary")
    T = P.TORSO_H
    mat = materials.fixed("JacketTrim", (0.10, 0.10, 0.12, 1.0), roughness=0.7)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        lapel = _shell(f"JacketLapel{tag}", [
            Ring(-T * 0.22, P.CHEST_W * 0.20, P.CHEST_W * 0.08, n=3.8),
            Ring(T * 0.22, P.CHEST_W * 0.22, P.CHEST_W * 0.09, n=3.8),
        ], segments=8)
        lapel.location = (side * P.CHEST_W * 0.30, P.CHEST_W * 0.74, P.Y_HIP + T * 0.62)
        materials.assign(lapel, mat)
        pieces.append(lapel)
    return _rename(pieces, "outer_jacket")


def bottom_cargo():
    return _rename(clothing.build_pants(), "bottom_cargo")


def bottom_jeans():
    """Vaqueros: el mismo patrón que el cargo pero sin bolsillos laterales."""
    pieces = clothing.build_pants()
    keep, drop = [], []
    for obj in pieces:
        (drop if "Pocket" in obj.name else keep).append(obj)
    for obj in drop:
        bpy.data.objects.remove(obj, do_unlink=True)
    return _rename(keep, "bottom_jeans")


def shoes_boots():
    return _rename(clothing.build_boots(), "shoes_boots")


def hands_gloves():
    return _rename(clothing.build_gloves(), "hands_gloves")


BUILDERS = {
    "hair_spiky": hair_spiky, "hair_buzz": hair_buzz, "hair_bob": hair_bob,
    "hair_ponytail": hair_ponytail, "hair_afro": hair_afro,
    "headwear_cap": headwear_cap, "headwear_beanie": headwear_beanie,
    "headwear_helmet_tactical": headwear_helmet_tactical, "headwear_cat_ears": headwear_cat_ears,
    "eyewear_round": eyewear_round, "eyewear_goggles": eyewear_goggles, "eyewear_visor": eyewear_visor,
    "headacc_headset": headacc_headset, "headacc_earmuffs": headacc_earmuffs,
    "back_backpack": back_backpack,
    "accessory_scarf": accessory_scarf, "accessory_mask": accessory_mask,
    "top_tee": top_tee, "top_longsleeve": top_longsleeve,
    "outer_vest_tactical": outer_vest_tactical, "outer_hoodie": outer_hoodie, "outer_jacket": outer_jacket,
    "bottom_cargo": bottom_cargo, "bottom_jeans": bottom_jeans,
    "shoes_boots": shoes_boots, "hands_gloves": hands_gloves,
}
