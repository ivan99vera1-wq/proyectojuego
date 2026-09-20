"""
Ropa del personaje base.

Cada prenda es geometría propia construida sobre el perfil del cuerpo, no una
textura pintada encima: por eso una chaqueta ensancha de verdad los hombros y
unas botas cambian la silueta del pie.

Todas las piezas son mallas independientes para que el sistema de
personalización pueda intercambiarlas sin tocar el cuerpo.

El GROSOR de cada prenda (`t`) no es cosmético: el torso y las extremidades
llevan esculpido encima de sus anillos (pectoral, trapecio, deltoides), y ese
relieve llega a ~0,016 m. Una prenda más fina que eso deja asomar triángulos
de piel por el pecho y los hombros.
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

def build_shirt(name="Shirt", channel="secondary", hem=-0.14):
    """Camiseta de manga larga: capa fina pegada al torso."""
    T, t = P.TORSO_H, 0.022
    rings = [
        Ring(T * hem, P.HIP_W * 0.92 + t, P.HIP_W * 0.68 + t, n=3.0),
        Ring(T * 0.05, P.HIP_W * 1.00 + t, P.HIP_W * 0.71 + t, n=3.0),
        Ring(T * 0.21, P.WAIST_W + t, P.WAIST_W * 0.74 + t, n=3.2),
        Ring(T * 0.40, P.CHEST_W * 0.93 + t, P.CHEST_W * 0.66 + t, n=3.0),
        Ring(T * 0.62, P.CHEST_W + t, P.CHEST_W * 0.67 + t, n=2.9, front=1.05),
        Ring(T * 0.79, P.SHOULDER_W + t, P.SHOULDER_W * 0.58 + t, n=2.7),
        Ring(T * 0.90, P.SHOULDER_W * 0.92 + t, P.SHOULDER_W * 0.60 + t, n=2.7),
        Ring(T * 0.98, P.SHOULDER_W * 0.62, P.SHOULDER_W * 0.54, n=2.6),
        Ring(T * 1.04, P.SHOULDER_W * 0.46, P.SHOULDER_W * 0.43, n=2.6),
    ]
    obj = _shell(name, rings)
    obj.location = (0.0, 0.0, P.Y_HIP)
    materials.assign(obj, materials.recolor(channel, roughness=0.88))
    return obj


def build_sleeves(prefix="Sleeve", channel="secondary", to_wrist=True):
    """
    Mangas divididas por el codo. Una manga continua no podría doblarse con el
    brazo: el juego anima rotando cada segmento por su articulación.
    """
    out = []
    r, t = P.ARM_R, 0.020
    elbow = -P.UPPER_ARM
    mat = materials.recolor(channel, roughness=0.88)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        # El tope de la manga no puede subir por encima del deltoides del
        # cuerpo (+0.030) o asomaría al lado de la barbilla.
        upper = _shell(f"{prefix}Upper{tag}", [
            Ring(0.034, r * 0.64 + t, r * 0.62 + t, n=2.6),
            Ring(0.016, r * 1.02 + t, r * 0.98 + t, n=2.6),
            Ring(-0.008, r * 1.14 + t, r * 1.08 + t, n=2.5),
            Ring(elbow * 0.50, r * 0.92 + t, r * 0.90 + t, n=2.5),
            Ring(elbow - 0.022, r * 0.84 + t, r * 0.83 + t, n=2.5),
        ], segments=12)
        upper.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER)
        materials.assign(upper, mat)
        out.append(upper)

        if not to_wrist:
            continue
        lower = _shell(f"{prefix}Lower{tag}", [
            Ring(0.044, r * 0.72 + t, r * 0.71 + t, n=2.5),
            Ring(0.018, r * 0.86 + t, r * 0.85 + t, n=2.5),
            Ring(-P.FOREARM * 0.42, r * 0.80 + t, r * 0.79 + t, n=2.5),
            Ring(-P.FOREARM + 0.012, r * 0.64 + t, r * 0.63 + t, n=2.6),
        ], segments=12)
        lower.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER - P.UPPER_ARM)
        materials.assign(lower, mat)
        out.append(lower)
    return out


# --------------------------------------------------------------- chaleco

def build_vest():
    """
    Chaleco táctico: capa gruesa y angulosa. Es la pieza que da la lectura
    "táctico" en silueta, incluso a contraluz.
    """
    T, t = P.TORSO_H, 0.028
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

    # Bandolera cruzada: una diagonal rompe la simetría y da carácter.
    import math
    sash_rings = [
        Ring(-T * 0.40, P.CHEST_W * 0.20, P.CHEST_W * 0.055, n=4.5),
        Ring(0.0, P.CHEST_W * 0.22, P.CHEST_W * 0.060, n=4.5),
        Ring(T * 0.40, P.CHEST_W * 0.20, P.CHEST_W * 0.055, n=4.5),
    ]
    sash = _shell("VestSash", sash_rings, segments=10)
    sash.location = (0.0, P.CHEST_W * 0.80, P.Y_HIP + T * 0.56)
    sash.rotation_euler = (0.0, math.radians(-34), 0.0)
    materials.assign(sash, materials.fixed("Gear_Web", (0.20, 0.21, 0.24, 1.0), roughness=0.95))
    pieces.append(sash)

    # Cuello alto del chaleco.
    collar = _shell("VestCollar", [
        Ring(T * 0.90, P.SHOULDER_W * 0.52, P.SHOULDER_W * 0.44, n=3.2),
        Ring(T * 1.02, P.SHOULDER_W * 0.56, P.SHOULDER_W * 0.48, n=3.2),
        Ring(T * 1.10, P.SHOULDER_W * 0.50, P.SHOULDER_W * 0.43, n=3.2),
    ], segments=12)
    collar.location = (0.0, -0.004, P.Y_HIP)
    materials.assign(collar, pouch_mat)
    pieces.append(collar)
    return pieces


# -------------------------------------------------------------- pantalón

def build_pants():
    """Pantalón cargo: cadera y perneras hasta el tobillo, con bolsillos."""
    out = []
    T, t = P.TORSO_H, 0.024
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
        upper = _shell(f"PantsLegUpper{tag}", [
            Ring(0.040, r * 0.86 + t, r * 0.84 + t, n=3.0),
            Ring(-0.014, r * 1.02 + t, r * 0.99 + t, n=3.0),
            Ring(knee * 0.50, r * 0.94 + t, r * 0.92 + t, n=2.9),
            Ring(knee - 0.026, r * 0.92 + t, r * 0.91 + t, n=2.9),
        ], segments=12)
        upper.location = (side * P.HIP_X, 0.0, P.Y_HIP)
        materials.assign(upper, materials.recolor("primary", roughness=0.92))
        out.append(upper)

        lower = _shell(f"PantsLegLower{tag}", [
            Ring(0.046, r * 0.84 + t, r * 0.83 + t, n=2.9),
            Ring(0.018, r * 0.96 + t, r * 0.95 + t, n=2.9),
            Ring(-P.SHIN * 0.40, r * 0.86 + t, r * 0.85 + t, n=2.9),
            Ring(-P.SHIN + 0.020, r * 0.72 + t, r * 0.72 + t, n=3.0),
            Ring(-P.SHIN + 0.004, r * 0.66 + t, r * 0.66 + t, n=3.0),
        ], segments=12)
        lower.location = (side * P.HIP_X, 0.0, P.Y_KNEE)
        materials.assign(lower, materials.recolor("primary", roughness=0.92))
        out.append(lower)

        prings = [
            Ring(0.0, r * 0.40, r * 0.52, n=4.0),
            Ring(P.THIGH * 0.26, r * 0.44, r * 0.56, n=4.0),
        ]
        pocket = _shell(f"PantsPocket{tag}", prings, segments=10)
        pocket.location = (side * (P.HIP_X + r * 0.92), 0.0, P.Y_HIP - P.THIGH * 0.60)
        materials.assign(pocket, materials.fixed("Gear_Mid", (0.16, 0.18, 0.21, 1.0), roughness=0.94))
        out.append(pocket)

        # Rodillera: corta la pernera en dos y da lectura de "equipado".
        knee_pad = _shell(f"KneePad{tag}", [
            Ring(0.030, r * 0.62, r * 0.42, n=3.6),
            Ring(-0.006, r * 0.72, r * 0.50, n=3.6),
            Ring(-0.040, r * 0.60, r * 0.42, n=3.6),
        ], segments=10)
        knee_pad.location = (side * P.HIP_X, r * 0.72, P.Y_KNEE + 0.006)
        materials.assign(knee_pad, materials.fixed("Gear_Pad", (0.13, 0.14, 0.17, 1.0), roughness=0.7))
        out.append(knee_pad)

    # Cinturón: una banda horizontal es lo que separa el torso de las piernas.
    belt = _shell("Belt", [
        Ring(T * 0.17, P.WAIST_W * 1.05 + t, P.WAIST_W * 0.82 + t, n=3.6),
        Ring(T * 0.245, P.WAIST_W * 1.09 + t, P.WAIST_W * 0.85 + t, n=3.6),
        Ring(T * 0.32, P.WAIST_W * 1.05 + t, P.WAIST_W * 0.82 + t, n=3.6),
    ], segments=14)
    belt.location = (0.0, 0.0, P.Y_HIP)
    materials.assign(belt, materials.fixed("Belt", (0.08, 0.08, 0.09, 1.0), roughness=0.55))
    out.append(belt)

    buckle = _shell("BeltBuckle", [
        Ring(-T * 0.055, P.WAIST_W * 0.26, P.WAIST_W * 0.10, n=5.0),
        Ring(T * 0.055, P.WAIST_W * 0.26, P.WAIST_W * 0.10, n=5.0),
    ], segments=10)
    buckle.location = (0.0, P.WAIST_W * 0.86, P.Y_HIP + T * 0.245)
    materials.assign(buckle, materials.fixed("Buckle", (0.42, 0.38, 0.22, 1.0),
                                             roughness=0.32, metallic=0.85))
    out.append(buckle)
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
            Ring(-P.SHIN, r * 0.78, r * 0.78, n=3.0),
            Ring(-P.SHIN * 0.74, r * 0.82, r * 0.82, n=3.0),
            Ring(-P.SHIN * 0.60, r * 0.84, r * 0.84, n=3.0),
        ], segments=12)
        shaft.location = (side * P.HIP_X, 0.0, P.Y_KNEE)
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

        # Puntera reforzada: el detalle que hace que la bota no sea un zueco.
        toe = _shell(f"BootToe{tag}", [
            Ring(-A * 0.86, r * 0.56, r * 0.34, n=3.6),
            Ring(-A * 0.62, r * 0.60, r * 0.36, n=3.6),
            Ring(-A * 0.40, r * 0.46, r * 0.26, n=3.6),
        ], segments=10)
        toe.location = (side * P.HIP_X, r * 1.10, P.Y_ANKLE)
        materials.assign(toe, sole)
        out.append(toe)

        # Correa sobre el empeine.
        strap = _shell(f"BootStrap{tag}", [
            Ring(-A * 0.44, r * 0.84, r * 0.86, n=3.8),
            Ring(-A * 0.26, r * 0.88, r * 0.90, n=3.8),
            Ring(-A * 0.08, r * 0.84, r * 0.86, n=3.8),
        ], segments=12)
        strap.location = (side * P.HIP_X, r * 0.20, P.Y_ANKLE)
        materials.assign(strap, materials.fixed("Boot_Strap", (0.17, 0.18, 0.21, 1.0), roughness=0.6))
        out.append(strap)
    return out


# --------------------------------------------------------------- guantes

def build_gloves():
    """
    Guantes tácticos: manopla que envuelve la mano del modelo base, con puño y
    placa de nudillos. Se construye contra las medidas reales de la muñeca
    (`P.WRIST_X`, `P.Y_WRIST`), no copiando una mano procedural.
    """
    out = []
    r, L = P.ARM_R, P.HAND_LEN
    mat = materials.fixed("Glove", (0.09, 0.10, 0.12, 1.0), roughness=0.85)
    plate = materials.fixed("Glove_Plate", (0.16, 0.17, 0.20, 1.0), roughness=0.55)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        obj = _shell(f"Glove{tag}", [
            Ring(0.024, r * 0.88, r * 0.74, n=3.0),
            Ring(-0.004, r * 1.12, r * 0.90, n=3.2),
            Ring(-L * 0.42, r * 1.24, r * 0.98, n=3.2),
            Ring(-L * 0.78, r * 1.08, r * 0.84, n=3.0),
            Ring(-L * 0.98, r * 0.58, r * 0.50, n=3.0),
        ], segments=12)
        obj.location = (side * P.WRIST_X, 0.0, P.Y_WRIST)
        materials.assign(obj, mat)
        out.append(obj)

        # Placa de nudillos: detalle que se lee incluso en miniatura.
        knuckle = _shell(f"GloveKnuckle{tag}", [
            Ring(0.0, r * 0.74, r * 0.46, n=4.0),
            Ring(L * 0.26, r * 0.66, r * 0.42, n=4.0),
        ], segments=10)
        knuckle.location = (side * P.WRIST_X, r * 0.60, P.Y_WRIST - L * 0.60)
        materials.assign(knuckle, plate)
        out.append(knuckle)

        # Puño con refuerzo en la muñeca.
        cuff = _shell(f"GloveCuff{tag}", [
            Ring(0.004, r * 1.02, r * 0.90, n=3.4),
            Ring(0.028, r * 1.12, r * 0.98, n=3.4),
            Ring(0.046, r * 0.98, r * 0.88, n=3.4),
        ], segments=12)
        cuff.location = (side * P.WRIST_X, 0.0, P.Y_WRIST)
        materials.assign(cuff, plate)
        out.append(cuff)
    return out


# ------------------------------------------------------------------ pelo

def _lock(azimuth, z_top, length, width, thick, tilt, W, D, k=1.0):
    """
    Un mechón: prisma que nace en la superficie del casquete y baja hasta
    acabar en punta. Es lo que diferencia un peinado de un gorro de baño.

    `azimuth` 0 = frente (+Y), positivo hacia +X. `tilt` separa la punta de
    la cabeza, que es lo que hace que el flequillo se lea en silueta.
    """
    import math
    rings = [
        Ring(0.0, width, thick, n=3.2),
        Ring(-length * 0.34, width * 0.96, thick * 1.02, n=3.0),
        Ring(-length * 0.70, width * 0.66, thick * 0.82, n=3.0),
        Ring(-length, width * 0.10, thick * 0.12, n=3.0),
    ]
    verts, faces = rings_to_mesh(rings, segments=8)
    ct, st = math.cos(tilt), math.sin(tilt)
    ca, sa = math.cos(-azimuth), math.sin(-azimuth)
    ox, oy = math.sin(azimuth) * W * k, math.cos(azimuth) * D * k
    out = []
    for (x, y, z) in verts:
        y2, z2 = y * ct - z * st, y * st + z * ct
        out.append((x * ca - y2 * sa + ox, x * sa + y2 * ca + oy, z2 + z_top))
    return out, faces


def build_hair():
    """
    Pelo base: casquete ajustado al cráneo + mechones sueltos en el flequillo,
    las patillas y la nuca. Los mechones son geometría propia, así que cambian
    de verdad la silueta (y se leen incluso a contraluz).
    """
    import math
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    t = 0.013
    cap_rings = [
        Ring(H * 0.50, W * 0.995 + t, D * 0.995 + t, n=2.4, front=0.95, back=1.09),
        Ring(H * 0.62, W * 1.00 + t, D * 1.00 + t, n=2.3, front=0.97, back=1.10),
        Ring(H * 0.74, W * 0.95 + t, D * 0.96 + t, n=2.3, front=1.00, back=1.08),
        Ring(H * 0.86, W * 0.81 + t, D * 0.82 + t, n=2.3),
        Ring(H * 0.95, W * 0.56 + t, D * 0.57 + t, n=2.3),
        Ring(H * 1.00, W * 0.18, D * 0.18, n=2.3),
    ]
    verts, faces = rings_to_mesh(cap_rings, segments=16, cap_bottom=False)
    # La nuca baja más que el resto del casquete.
    verts = sculpt.push(verts, (0.0, -D * 0.94, H * 0.54), (0.0, -0.15, -1.0), W * 0.82, H * 0.130)
    # Pico en la frente: rompe la línea horizontal del casquete.
    verts = sculpt.push(verts, (0.0, D * 0.94, H * 0.54), (0.0, 0.10, -1.0), W * 0.34, H * 0.045)

    def add(v2, f2):
        base = len(verts)
        verts.extend(v2)
        faces.extend(tuple(i + base for i in f) for f in f2)

    # --- flequillo: siete mechones que caen sobre la frente ---------------
    for i in range(7):
        f = (i / 6.0) * 2.0 - 1.0
        az = f * 1.20
        # Alternar largo y corto da el desorden que pide el estilo.
        long_one = (i % 2) == 0
        length = H * (0.265 if long_one else 0.205) - H * 0.040 * abs(f)
        add(*_lock(az, H * (0.665 - 0.018 * abs(f)), length,
                   W * (0.255 - 0.040 * abs(f)), D * 0.080,
                   0.15 + 0.06 * abs(f), W, D, k=0.975))

    # --- patillas: bajan por delante de la oreja --------------------------
    for side in (-1, 1):
        add(*_lock(side * 1.62, H * 0.625, H * 0.290, W * 0.150, D * 0.075,
                   0.08, W, D, k=0.965))

    # --- nuca: tres puntas hacia fuera ------------------------------------
    for az in (math.pi - 0.62, math.pi, math.pi + 0.62):
        add(*_lock(az, H * 0.575, H * 0.225, W * 0.185, D * 0.080,
                   -0.16, W, D, k=0.965))

    obj = new_object("Hair", verts, faces)
    materials.assign(obj, materials.recolor("hair", roughness=0.72))
    return obj
