"""
Anatomía del personaje base, con proporciones tipo Brawl Stars: cabeza enorme,
cuerpo corto y rechoncho, extremidades cortas y gruesas, manos y botas grandes.

Cada pieza es una caja de control de pocos polígonos que la subdivisión
convierte en superficie orgánica, más pasadas de escultura con caída suave para
pómulos, mandíbula, deltoides o pantorrilla.

Origen de cada pieza = su articulación, para que el esqueleto la mueva sin
compensaciones y para que sea intercambiable.
"""
from . import proportions as P
from .mesh import Ring, cube_sphere, new_object, rings_to_mesh
from . import sculpt


# ------------------------------------------------------------------ cabeza

def head_cage():
    """
    Cráneo de chibi moderno: bóveda muy ancha y alta, mejillas llenas, mentón
    pequeño y redondeado, y un plano frontal aplanado donde se leen los rasgos.
    """
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    rings = [
        Ring(H * 0.005, W * 0.26, D * 0.30, n=3.0, y=D * 0.14),
        Ring(H * 0.045, W * 0.46, D * 0.50, n=2.9, y=D * 0.10),
        Ring(H * 0.105, W * 0.66, D * 0.72, n=2.7, y=D * 0.04, back=1.02),
        Ring(H * 0.185, W * 0.83, D * 0.87, n=2.6, front=0.96, back=1.05),
        Ring(H * 0.285, W * 0.94, D * 0.95, n=2.5, front=0.93, back=1.07),
        Ring(H * 0.400, W * 1.00, D * 1.00, n=2.4, front=0.92, back=1.09),
        Ring(H * 0.530, W * 1.01, D * 1.01, n=2.4, front=0.93, back=1.10),
        Ring(H * 0.660, W * 0.99, D * 0.99, n=2.4, front=0.96, back=1.09),
        Ring(H * 0.780, W * 0.92, D * 0.93, n=2.4, front=1.00, back=1.06),
        Ring(H * 0.880, W * 0.78, D * 0.79, n=2.4),
        Ring(H * 0.955, W * 0.52, D * 0.53, n=2.4),
        Ring(H * 1.000, W * 0.16, D * 0.16, n=2.4),
    ]
    verts, faces = rings_to_mesh(rings, segments=18)

    # --- escultura: aquí la cabeza deja de ser una forma torneada ---
    # Pómulos altos y llenos
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.60, D * 0.46, H * 0.255),
                            (side * 0.5, 0.86, 0.0), W * 0.50, W * 0.085)
    # Reborde de ceja: da carácter inmediato a la mirada
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.36, D * 0.80, H * 0.405),
                            (0.0, 1.0, 0.12), W * 0.40, W * 0.060)
    # Cuenca del ojo, para que el globo se aloje en vez de pegarse
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.34, D * 0.86, H * 0.320),
                            (0.0, -1.0, 0.0), W * 0.34, W * 0.070)
    # Mandíbula suave pero presente
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.54, D * 0.16, H * 0.110),
                            (side * 0.92, 0.28, -0.10), W * 0.44, W * 0.060)
    # Mentón pequeño, algo adelantado
    verts = sculpt.push(verts, (0.0, D * 0.52, H * 0.040),
                        (0.0, 0.92, 0.30), W * 0.36, W * 0.070)
    # Nuca llena
    verts = sculpt.push(verts, (0.0, -D * 0.86, H * 0.50),
                        (0.0, -1.0, 0.0), W * 0.82, W * 0.050)
    # Plano de la cara: los rasgos grandes se leen mejor sobre una zona plana
    verts = sculpt.flatten_front(verts, H * 0.17, H * 0.55, 0.12, y_min=D * 0.22)
    return verts, faces


def build_head(name="Head"):
    verts, faces = head_cage()
    return new_object(name, verts, faces)


def build_ear(side, name):
    W, D, H = P.HEAD_W, P.HEAD_D, P.HEAD_H
    verts, faces = cube_sphere(3)
    out = [(v[0] * W * 0.075, v[1] * D * 0.115, v[2] * H * 0.070) for v in verts]
    obj = new_object(name, out, faces)
    obj.location = (side * W * 0.96, -D * 0.05, P.HEAD_H * 0.32)
    obj.rotation_euler = (0.0, 0.0, side * 0.18)
    obj.scale = (0.85, 1.0, 1.10)
    return obj


def build_nose(name="Nose"):
    """Nariz muy discreta: en este estilo es casi un botón."""
    W, D, H = P.HEAD_W, P.HEAD_D, P.HEAD_H
    verts, faces = cube_sphere(2)
    out = [(v[0] * W * 0.052, v[1] * D * 0.030, v[2] * H * 0.019) for v in verts]
    obj = new_object(name, out, faces)
    obj.location = (0.0, D * 0.855, H * 0.238)
    return obj


# ------------------------------------------------------------------- torso

def torso_cage():
    """
    Torso corto con hombros anchos y cintura marcada. La V de hombro a cintura
    es lo que evita que el cuerpo se lea como un barril.
    """
    T = P.TORSO_H
    rings = [
        Ring(T * -0.20, P.HIP_W * 0.70, P.HIP_W * 0.56, n=3.2),
        Ring(T * -0.08, P.HIP_W * 0.96, P.HIP_W * 0.70, n=3.1),
        Ring(T * 0.04, P.HIP_W * 1.00, P.HIP_W * 0.72, n=3.1, back=1.05),
        Ring(T * 0.22, P.WAIST_W, P.WAIST_W * 0.74, n=3.3, back=1.04),
        Ring(T * 0.44, P.CHEST_W * 0.94, P.CHEST_W * 0.70, n=3.1, front=1.04, back=1.05),
        Ring(T * 0.64, P.CHEST_W, P.CHEST_W * 0.70, n=3.0, front=1.06, back=1.07),
        Ring(T * 0.74, P.SHOULDER_W * 1.02, P.SHOULDER_W * 0.64, n=2.8, front=1.04, back=1.05),
        Ring(T * 0.84, P.SHOULDER_W * 0.98, P.SHOULDER_W * 0.62, n=2.8, front=1.03, back=1.04),
        Ring(T * 0.93, P.SHOULDER_W * 0.70, P.SHOULDER_W * 0.52, n=2.8),
        Ring(T * 1.00, P.SHOULDER_W * 0.40, P.SHOULDER_W * 0.38, n=2.6),
    ]
    verts, faces = rings_to_mesh(rings, segments=16)
    # Pecho y omóplatos
    verts = sculpt.push(verts, (0.0, P.CHEST_W * 0.72, T * 0.58),
                        (0.0, 1.0, 0.0), P.CHEST_W * 1.05, P.CHEST_W * 0.070)
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * P.CHEST_W * 0.52, -P.CHEST_W * 0.56, T * 0.66),
                            (0.0, -1.0, 0.0), P.CHEST_W * 0.68, P.CHEST_W * 0.050)
    # Trapecio: sube del hombro hacia el cuello
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * P.SHOULDER_W * 0.58, 0.0, T * 0.90),
                            (0.0, 0.0, 1.0), P.SHOULDER_W * 0.66, P.SHOULDER_W * 0.10)
    return verts, faces


def build_torso(name="Torso"):
    verts, faces = torso_cage()
    obj = new_object(name, verts, faces)
    obj.location = (0.0, 0.0, P.Y_HIP)
    return obj


def build_neck(name="Neck"):
    r = P.SHOULDER_W * 0.40
    rings = [
        Ring(-0.016, r * 1.24, r * 1.08, n=2.9),
        Ring(0.006, r * 1.00, r * 0.92, n=2.8),
        Ring(P.NECK_H + 0.022, r * 0.98, r * 0.90, n=2.8),
    ]
    verts, faces = rings_to_mesh(rings, segments=12)
    obj = new_object(name, verts, faces)
    obj.location = (0.0, -0.004, P.Y_NECK)
    return obj


# ------------------------------------------------------------------ brazos

def build_arm_upper(side, name):
    """
    Del hombro al codo. Deltoides como bola marcada que conecta con el torso, y
    brazo que adelgaza: así el brazo se lee separado del cuerpo.
    """
    r = P.ARM_R
    elbow = -P.UPPER_ARM
    # El anillo más alto no puede pasar de +0.030: por encima de eso el hombro
    # asomaría junto a la barbilla en vez de nacer del torso.
    rings = [
        Ring(0.030, r * 0.62, r * 0.60, n=2.7),
        Ring(0.014, r * 1.00, r * 0.96, n=2.6),
        Ring(-0.008, r * 1.12, r * 1.06, n=2.5),
        Ring(elbow * 0.42, r * 0.90, r * 0.88, n=2.5),
        Ring(elbow + 0.010, r * 0.78, r * 0.77, n=2.5),
        Ring(elbow - 0.014, r * 0.74, r * 0.73, n=2.6),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    verts = sculpt.push(verts, (side * r * 0.70, 0.0, -0.006),
                        (side * 1.0, 0.0, 0.0), r * 1.10, r * 0.18)
    verts = sculpt.push(verts, (0.0, r * 0.72, elbow * 0.42),
                        (0.0, 1.0, 0.0), r * 0.95, r * 0.09)
    # Tríceps: pequeño bulto trasero que evita el brazo-cilindro.
    verts = sculpt.push(verts, (0.0, -r * 0.78, elbow * 0.30),
                        (0.0, -1.0, 0.0), r * 0.90, r * 0.08)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER)
    return obj


def build_arm_lower(side, name):
    """Del codo a la muñeca. Se estrecha hacia la muñeca para dar la mano grande."""
    r = P.ARM_R
    wrist = -P.FOREARM
    rings = [
        Ring(0.040, r * 0.66, r * 0.65, n=2.6),
        Ring(0.016, r * 0.80, r * 0.79, n=2.5),
        Ring(-0.004, r * 0.80, r * 0.79, n=2.5),
        Ring(wrist * 0.46, r * 0.70, r * 0.69, n=2.5),
        Ring(wrist + 0.014, r * 0.56, r * 0.55, n=2.6),
        Ring(wrist, r * 0.50, r * 0.49, n=2.7),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER - P.UPPER_ARM)
    return obj


def hand_shell(side, name, t=0.0, tip=1.0):
    """
    Manopla grande: palma con canto y pulgar. `t` engorda la pieza para que un
    guante pueda usar EXACTAMENTE la misma forma y cubrir la mano sin que
    asome ni un dedo (antes el guante era más pequeño que la mano).
    """
    import math
    r = P.ARM_R
    L = P.HAND_LEN
    rings = [
        Ring(0.028, r * 0.48 + t, r * 0.40 + t, n=3.0),
        Ring(0.006, r * 0.62 + t, r * 0.50 + t, n=3.0),
        Ring(-0.016, r * 0.82 + t, r * 0.62 + t, n=3.2),
        Ring(-L * 0.50, r * 0.90 + t, r * 0.66 + t, n=3.2),
        Ring(-L * 0.82, r * 0.76 + t, r * 0.56 + t, n=3.0),
        Ring(-L * tip, r * 0.42 + t * 0.5, r * 0.34 + t * 0.5, n=3.0),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    # Surco entre los dedos: sin él la mano es una piedra.
    verts = sculpt.push(verts, (0.0, r * 0.56 + t, -L * 0.58),
                        (0.0, 1.0, 0.0), r * 0.62, r * 0.10)
    trings = [
        Ring(0.0, r * 0.30 + t, r * 0.28 + t, n=2.7),
        Ring(-r * 0.42, r * 0.28 + t, r * 0.26 + t, n=2.7),
        Ring(-r * 0.76, r * 0.17 + t * 0.6, r * 0.17 + t * 0.6, n=2.7),
    ]
    tv, tf = rings_to_mesh(trings, segments=8)
    ang = side * 0.85
    base = len(verts)
    for (vx, vy, vz) in tv:
        rx = vx * math.cos(ang) + vz * math.sin(ang)
        rz = -vx * math.sin(ang) + vz * math.cos(ang)
        verts.append((rx - side * r * 0.60, vy + r * 0.20, rz - L * 0.24))
    faces.extend(tuple(i + base for i in f) for f in tf)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER - P.UPPER_ARM - P.FOREARM)
    return obj


def build_hand(side, name):
    return hand_shell(side, name)


# ----------------------------------------------------------------- piernas

def build_leg_upper(side, name):
    """Muslo grueso y corto."""
    r = P.THIGH_R
    knee = -P.THIGH
    rings = [
        Ring(0.052, r * 0.74, r * 0.72, n=3.0),
        Ring(0.024, r * 0.96, r * 0.93, n=3.0),
        Ring(-0.012, r * 1.02, r * 0.99, n=3.0),
        Ring(knee * 0.52, r * 0.92, r * 0.90, n=2.9),
        Ring(knee + 0.018, r * 0.84, r * 0.83, n=2.8),
        Ring(knee - 0.014, r * 0.80, r * 0.80, n=2.8),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    verts = sculpt.push(verts, (0.0, r * 0.80, knee * 0.44), (0.0, 1.0, 0.0), r * 1.05, r * 0.09)
    verts = sculpt.push(verts, (0.0, -r * 0.80, 0.008), (0.0, -1.0, 0.0), r * 0.95, r * 0.11)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.HIP_X, 0.0, P.Y_HIP)
    return obj


def build_leg_lower(side, name):
    """Pantorrilla con volumen hacia atrás y tobillo fino: lo remata la bota."""
    r = P.THIGH_R
    ankle = -P.SHIN
    rings = [
        Ring(0.042, r * 0.74, r * 0.73, n=2.8),
        Ring(0.018, r * 0.86, r * 0.85, n=2.8),
        Ring(0.000, r * 0.86, r * 0.85, n=2.8, front=1.06),
        Ring(ankle * 0.36, r * 0.78, r * 0.77, n=2.8, back=1.20),
        Ring(ankle * 0.74, r * 0.60, r * 0.59, n=2.8, back=1.06),
        Ring(ankle, r * 0.48, r * 0.48, n=2.9),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    verts = sculpt.push(verts, (0.0, r * 0.70, 0.004), (0.0, 1.0, 0.0), r * 0.52, r * 0.06)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.HIP_X, 0.0, P.Y_KNEE)
    return obj


def build_foot(side, name):
    """Pie base. En la práctica siempre lo cubre una bota grande."""
    r = P.THIGH_R
    A = P.Y_ANKLE
    rings = [
        Ring(0.030, r * 0.46, r * 0.50, n=2.9, y=r * 0.06),
        Ring(0.004, r * 0.54, r * 0.60, n=2.9, y=r * 0.08),
        Ring(-A * 0.34, r * 0.60, r * 0.92, n=3.1, y=r * 0.32),
        Ring(-A * 0.70, r * 0.64, r * 1.18, n=3.3, y=r * 0.50),
        Ring(-A * 0.95, r * 0.62, r * 1.24, n=3.5, y=r * 0.53),
        Ring(-A, r * 0.56, r * 1.18, n=3.7, y=r * 0.53),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    verts = sculpt.push(verts, (0.0, -r * 0.42, -A * 0.55), (0.0, -1.0, 0.0), r * 0.68, r * 0.14)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.HIP_X, 0.0, P.Y_ANKLE)
    return obj
