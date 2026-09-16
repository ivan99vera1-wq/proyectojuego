"""
Ropa del personaje base.

Cada prenda es geometría propia construida sobre el perfil del cuerpo, no una
textura pintada encima: por eso una chaqueta ensancha de verdad los hombros y
unas botas cambian la silueta del pie.

Todas las piezas son mallas independientes para que el sistema de
personalización pueda intercambiarlas sin tocar el cuerpo.
"""
from . import materials
from . import proportions as P
from .mesh import Ring, new_object, rings_to_mesh
from . import sculpt


def _shell(name, rings, segments=14, cap_bottom=True, cap_top=True):
    verts, faces = rings_to_mesh(rings, segments=segments,
                                 cap_bottom=cap_bottom, cap_top=cap_top)
    return new_object(name, verts, faces)


# ------------------------------------------------------------- camiseta

def build_shirt():
    """Camiseta de manga larga: capa fina pegada al torso."""
    T, t = P.TORSO_H, 0.011
    rings = [
        Ring(T * -0.14, P.HIP_W * 0.92 + t, P.HIP_W * 0.68 + t, n=3.0),
        Ring(T * 0.05, P.HIP_W * 1.00 + t, P.HIP_W * 0.71 + t, n=3.0),
        Ring(T * 0.21, P.WAIST_W + t, P.WAIST_W * 0.74 + t, n=3.2),
        Ring(T * 0.40, P.CHEST_W * 0.93 + t, P.CHEST_W * 0.66 + t, n=3.0),
        Ring(T * 0.62, P.CHEST_W + t, P.CHEST_W * 0.67 + t, n=2.9, front=1.05),
        Ring(T * 0.79, P.SHOULDER_W + t, P.SHOULDER_W * 0.58 + t, n=2.7),
        Ring(T * 0.90, P.SHOULDER_W * 0.92 + t, P.SHOULDER_W * 0.60 + t, n=2.7),
        Ring(T * 0.98, P.SHOULDER_W * 0.62, P.SHOULDER_W * 0.54, n=2.6),
        Ring(T * 1.04, P.SHOULDER_W * 0.46, P.SHOULDER_W * 0.43, n=2.6),
    ]
    obj = _shell("Shirt", rings)
    obj.location = (0.0, 0.0, P.Y_HIP)
    materials.assign(obj, materials.recolor("secondary", roughness=0.88))
    return obj


def build_sleeves():
    """Mangas: una por brazo, hasta la muñeca."""
    out = []
    r, t = P.ARM_R, 0.010
    elbow = -P.UPPER_ARM
    wrist = elbow - P.FOREARM
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        rings = [
            Ring(0.082, r * 0.52 + t, r * 0.50 + t, n=2.6),
            Ring(0.062, r * 0.92 + t, r * 0.89 + t, n=2.6),
            Ring(0.016, r * 1.06 + t, r * 1.02 + t, n=2.5),
            Ring(elbow * 0.55, r * 0.82 + t, r * 0.80 + t, n=2.5),
            Ring(elbow, r * 0.74 + t, r * 0.73 + t, n=2.5),
            Ring(wrist + P.FOREARM * 0.42, r * 0.70 + t, r * 0.69 + t, n=2.5),
            Ring(wrist + 0.012, r * 0.60 + t, r * 0.59 + t, n=2.6),
        ]
        obj = _shell(f"Sleeve{tag}", rings, segments=12)
        obj.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER)
        materials.assign(obj, materials.recolor("secondary", roughness=0.88))
        out.append(obj)
    return out


# --------------------------------------------------------------- chaleco

def build_vest():
    """
    Chaleco táctico: capa gruesa y angulosa. Es la pieza que da la lectura
    "táctico" en silueta, incluso a contraluz.
    """
    T, t = P.TORSO_H, 0.018
    rings = [
        Ring(T * 0.18, P.WAIST_W * 0.98 + t, P.WAIST_W * 0.76 + t, n=3.6),
        Ring(T * 0.34, P.WAIST_W * 1.04 + t, P.WAIST_W * 0.80 + t, n=3.6),
        Ring(T * 0.54, P.CHEST_W * 0.98 + t, P.CHEST_W * 0.72 + t, n=3.4),
        Ring(T * 0.72, P.CHEST_W * 1.00 + t, P.CHEST_W * 0.72 + t, n=3.2),
        Ring(T * 0.84, P.SHOULDER_W * 0.86 + t, P.SHOULDER_W * 0.56 + t, n=3.0),
        Ring(T * 0.91, P.SHOULDER_W * 0.62, P.SHOULDER_W * 0.46, n=2.9),
    ]
    body = _shell("Vest", rings)
    body.location = (0.0, 0.0, P.Y_HIP)
    materials.assign(body, materials.recolor("primary", roughness=0.9))

    pieces = [body]
    pouch_mat = materials.fixed("Gear_Dark", (0.10, 0.11, 0.13, 1.0), roughness=0.92)
    # Bolsas frontales: volumen reconocible en la silueta
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        prings = [
            Ring(0.0, P.CHEST_W * 0.24, P.CHEST_W * 0.11, n=4.0),
            Ring(T * 0.13, P.CHEST_W * 0.26, P.CHEST_W * 0.13, n=4.0),
        ]
        pouch = _shell(f"VestPouch{tag}", prings, segments=10)
        pouch.location = (side * P.CHEST_W * 0.42, P.CHEST_W * 0.74, P.Y_HIP + T * 0.36)
        materials.assign(pouch, pouch_mat)
        pieces.append(pouch)
        # Hombreras
        srings = [
            Ring(-T * 0.05, P.SHOULDER_W * 0.30, P.SHOULDER_W * 0.46, n=3.4),
            Ring(T * 0.05, P.SHOULDER_W * 0.32, P.SHOULDER_W * 0.48, n=3.4),
        ]
        strap = _shell(f"VestStrap{tag}", srings, segments=10)
        strap.location = (side * P.SHOULDER_W * 0.60, 0.0, P.Y_HIP + T * 0.88)
        materials.assign(strap, pouch_mat)
        pieces.append(strap)
    return pieces


# -------------------------------------------------------------- pantalón

def build_pants():
    """Pantalón cargo: cadera y perneras hasta el tobillo, con bolsillos."""
    out = []
    T, t = P.TORSO_H, 0.013
    hip_rings = [
        Ring(T * -0.20, P.HIP_W * 0.76 + t, P.HIP_W * 0.60 + t, n=3.2),
        Ring(T * -0.05, P.HIP_W * 1.00 + t, P.HIP_W * 0.72 + t, n=3.2),
        Ring(T * 0.12, P.HIP_W * 0.98 + t, P.HIP_W * 0.72 + t, n=3.2),
        Ring(T * 0.24, P.WAIST_W * 1.02 + t, P.WAIST_W * 0.78 + t, n=3.4),
    ]
    hips = _shell("PantsHips", hip_rings)
    hips.location = (0.0, 0.0, P.Y_HIP)
    materials.assign(hips, materials.recolor("primary", roughness=0.92))
    out.append(hips)

    r = P.THIGH_R
    knee = -P.THIGH
    ankle = knee - P.SHIN
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        rings = [
            Ring(0.040, r * 0.86 + t, r * 0.84 + t, n=3.0),
            Ring(-0.014, r * 1.02 + t, r * 0.99 + t, n=3.0),
            Ring(knee * 0.50, r * 0.94 + t, r * 0.92 + t, n=2.9),
            Ring(knee, r * 0.86 + t, r * 0.85 + t, n=2.9),
            Ring(knee - P.SHIN * 0.40, r * 0.84 + t, r * 0.83 + t, n=2.9),
            Ring(ankle + 0.016, r * 0.70 + t, r * 0.70 + t, n=3.0),
            Ring(ankle, r * 0.64 + t, r * 0.64 + t, n=3.0),
        ]
        leg = _shell(f"PantsLeg{tag}", rings, segments=12)
        leg.location = (side * P.HIP_X, 0.0, P.Y_HIP)
        materials.assign(leg, materials.recolor("primary", roughness=0.92))
        out.append(leg)

        prings = [
            Ring(0.0, r * 0.40, r * 0.52, n=4.0),
            Ring(P.THIGH * 0.26, r * 0.44, r * 0.56, n=4.0),
        ]
        pocket = _shell(f"PantsPocket{tag}", prings, segments=10)
        pocket.location = (side * (P.HIP_X + r * 0.92), 0.0, P.Y_HIP - P.THIGH * 0.60)
        materials.assign(pocket, materials.fixed("Gear_Mid", (0.16, 0.18, 0.21, 1.0), roughness=0.94))
        out.append(pocket)
    return out


# ----------------------------------------------------------------- botas

def build_boots():
    """Botas: caña sobre la pantorrilla, empeine con volumen y suela dura."""
    out = []
    r = P.THIGH_R
    A = P.Y_ANKLE
    leather = materials.fixed("Boot_Leather", (0.10, 0.11, 0.14, 1.0), roughness=0.75)
    sole = materials.fixed("Boot_Sole", (0.06, 0.06, 0.08, 1.0), roughness=0.95)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        shaft = _shell(f"BootShaft{tag}", [
            Ring(0.0, r * 0.76, r * 0.76, n=3.0),
            Ring(P.SHIN * 0.26, r * 0.80, r * 0.80, n=3.0),
            Ring(P.SHIN * 0.40, r * 0.82, r * 0.82, n=3.0),
        ], segments=12)
        shaft.location = (side * P.HIP_X, 0.0, P.Y_ANKLE)
        materials.assign(shaft, leather)
        out.append(shaft)

        upper_rings = [
            Ring(0.018, r * 0.74, r * 0.74, n=3.0, y=r * 0.06),
            Ring(-A * 0.30, r * 0.80, r * 1.06, n=3.2, y=r * 0.34),
            Ring(-A * 0.62, r * 0.84, r * 1.34, n=3.4, y=r * 0.54),
            Ring(-A * 0.80, r * 0.82, r * 1.38, n=3.6, y=r * 0.57),
        ]
        upper = _shell(f"BootUpper{tag}", upper_rings, segments=14)
        upper.location = (side * P.HIP_X, 0.0, P.Y_ANKLE)
        materials.assign(upper, leather)
        out.append(upper)

        sole_rings = [
            Ring(-A * 0.98, r * 0.86, r * 1.42, n=3.8, y=r * 0.57),
            Ring(-A * 0.78, r * 0.88, r * 1.44, n=3.8, y=r * 0.57),
        ]
        s = _shell(f"BootSole{tag}", sole_rings, segments=14)
        s.location = (side * P.HIP_X, 0.0, P.Y_ANKLE)
        materials.assign(s, sole)
        out.append(s)
    return out


# --------------------------------------------------------------- guantes

def build_gloves():
    """Guantes tácticos sobre la mano, con puño marcado."""
    out = []
    r, L = P.ARM_R, P.HAND_LEN
    mat = materials.fixed("Glove", (0.09, 0.10, 0.12, 1.0), roughness=0.85)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        rings = [
            Ring(0.030, r * 0.66, r * 0.58, n=3.0),
            Ring(0.004, r * 0.60, r * 0.50, n=3.0),
            Ring(-0.020, r * 0.80, r * 0.61, n=3.2),
            Ring(-L * 0.55, r * 0.84, r * 0.62, n=3.2),
            Ring(-L * 0.86, r * 0.72, r * 0.54, n=3.0),
            Ring(-L * 1.02, r * 0.40, r * 0.34, n=3.0),
        ]
        obj = _shell(f"Glove{tag}", rings, segments=12)
        obj.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER - P.UPPER_ARM - P.FOREARM)
        materials.assign(obj, mat)
        out.append(obj)
    return out


# ------------------------------------------------------------------ pelo

def build_hair():
    """
    Pelo base: casquete que sigue el cráneo con flequillo en pico y nuca.
    Cambia la silueta, que es lo que debe hacer una pieza de pelo.
    """
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    t = 0.012
    cap_rings = [
        Ring(H * 0.54, W * 0.99 + t, D * 0.99 + t, n=2.4, front=0.96, back=1.08),
        Ring(H * 0.64, W * 0.99 + t, D * 0.99 + t, n=2.3, front=0.97, back=1.09),
        Ring(H * 0.74, W * 0.94 + t, D * 0.95 + t, n=2.3, front=1.00, back=1.07),
        Ring(H * 0.86, W * 0.80 + t, D * 0.81 + t, n=2.3),
        Ring(H * 0.95, W * 0.55 + t, D * 0.56 + t, n=2.3),
        Ring(H * 1.00, W * 0.18, D * 0.18, n=2.3),
    ]
    verts, faces = rings_to_mesh(cap_rings, segments=16, cap_bottom=False)
    # Flequillo: baja en pico sobre la frente y rompe la línea recta del casquete
    verts = sculpt.push(verts, (0.0, D * 0.92, H * 0.56), (0.0, 0.10, -1.0), W * 0.46, H * 0.070)
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.72, D * 0.62, H * 0.56),
                            (0.0, 0.0, -1.0), W * 0.42, H * 0.048)
        # Patillas por delante de la oreja
        verts = sculpt.push(verts, (side * W * 0.98, D * 0.05, H * 0.54),
                            (0.0, 0.0, -1.0), W * 0.32, H * 0.110)
    # Nuca
    verts = sculpt.push(verts, (0.0, -D * 0.94, H * 0.52), (0.0, -0.15, -1.0), W * 0.80, H * 0.140)
    # Mechones de flequillo: sin ellos el pelo se lee como un casco
    import math
    for i in range(7):
        f = (i / 6.0) * 2.0 - 1.0
        ang = f * 1.15
        cx = math.sin(ang) * W * 0.92
        cy = math.cos(ang) * D * 0.92
        drop = H * (0.105 - 0.045 * abs(f))
        verts = sculpt.push(verts, (cx, cy, H * 0.56), (0.0, 0.10, -1.0), W * 0.30, drop)
    obj = new_object("Hair", verts, faces)
    materials.assign(obj, materials.recolor("hair", roughness=0.72))
    return obj
