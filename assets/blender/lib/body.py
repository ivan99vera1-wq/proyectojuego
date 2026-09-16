"""
Anatomía del personaje base. Cada pieza es una caja de control de pocos
polígonos que la subdivisión convierte en superficie orgánica.

Origen de cada pieza = su articulación, para que el esqueleto la mueva sin
compensaciones raras y para que la pieza sea intercambiable.
"""
from . import proportions as P
from .mesh import Ring, cube_sphere, new_object, rings_to_mesh
from . import sculpt


# ------------------------------------------------------------------ cabeza

def head_cage():
    """
    Cráneo chibi: mentón estrecho, mandíbula marcada, mejillas llenas,
    sienes anchas y nuca abultada. La cara es más plana que la nuca.
    """
    H, W, D = P.HEAD_H, P.HEAD_W, P.HEAD_D
    rings = [
        Ring(H * 0.010, W * 0.30, D * 0.34, n=2.8, y=D * 0.16),
        Ring(H * 0.060, W * 0.50, D * 0.54, n=2.7, y=D * 0.11),
        Ring(H * 0.130, W * 0.71, D * 0.77, n=2.6, y=D * 0.05, back=1.02),
        Ring(H * 0.225, W * 0.87, D * 0.91, n=2.5, front=0.97, back=1.05),
        Ring(H * 0.330, W * 0.96, D * 0.97, n=2.4, front=0.95, back=1.07),
        Ring(H * 0.460, W * 1.00, D * 1.00, n=2.3, front=0.95, back=1.09),
        Ring(H * 0.600, W * 0.99, D * 0.99, n=2.3, front=0.96, back=1.09),
        Ring(H * 0.740, W * 0.93, D * 0.94, n=2.3, front=1.00, back=1.06),
        Ring(H * 0.860, W * 0.79, D * 0.80, n=2.3),
        Ring(H * 0.950, W * 0.54, D * 0.55, n=2.3),
        Ring(H * 1.000, W * 0.17, D * 0.17, n=2.3),
    ]
    verts, faces = rings_to_mesh(rings, segments=16)

    # --- pasadas de escultura: aquí es donde la cabeza deja de ser un torno ---
    H_ = H
    # Pómulos
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.62, D * 0.42, H_ * 0.31),
                            (side * 0.55, 0.85, 0.0), W * 0.52, W * 0.075)
    # Ceja: un reborde sobre los ojos da carácter al instante
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.38, D * 0.80, H_ * 0.475),
                            (0.0, 1.0, 0.1), W * 0.42, W * 0.058)
    # Cuenca del ojo, justo debajo de la ceja
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.34, D * 0.84, H_ * 0.385),
                            (0.0, -1.0, 0.0), W * 0.34, W * 0.062)
    # Mandíbula marcada
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * W * 0.60, D * 0.10, H_ * 0.135),
                            (side * 0.9, 0.25, -0.15), W * 0.46, W * 0.070)
    # Mentón hacia delante y ligeramente arriba
    verts = sculpt.push(verts, (0.0, D * 0.55, H_ * 0.045),
                        (0.0, 0.9, 0.35), W * 0.40, W * 0.085)
    # Nuca más llena
    verts = sculpt.push(verts, (0.0, -D * 0.85, H_ * 0.58),
                        (0.0, -1.0, 0.0), W * 0.85, W * 0.055)
    # La cara se aplana: los rasgos se leen mejor sobre un plano que sobre una bola
    verts = sculpt.flatten_front(verts, H_ * 0.22, H_ * 0.62, 0.10, y_min=D * 0.25)
    return verts, faces


def build_head(name="Head"):
    verts, faces = head_cage()
    return new_object(name, verts, faces)


def build_ear(side, name):
    """Oreja: concha aplanada con un hueco interior."""
    W, D, H = P.HEAD_W, P.HEAD_D, P.HEAD_H
    verts, faces = cube_sphere(3)
    out = []
    for v in verts:
        out.append((v[0] * W * 0.085, v[1] * D * 0.13, v[2] * H * 0.085))
    # Aplanar contra el cráneo y crear el reborde
    out = sculpt.push(out, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 1.0, 0.0)
    obj = new_object(name, out, faces)
    obj.location = (side * W * 0.95, -D * 0.06, P.HEAD_H * 0.40)
    obj.rotation_euler = (0.0, 0.0, side * 0.20)
    obj.scale = (0.9, 1.0, 1.15)
    return obj


def build_nose(name="Nose"):
    W, D, H = P.HEAD_W, P.HEAD_D, P.HEAD_H
    verts, faces = cube_sphere(2)
    out = [(v[0] * W * 0.075, v[1] * D * 0.085, v[2] * H * 0.038) for v in verts]
    obj = new_object(name, out, faces)
    obj.location = (0.0, D * 0.86, H * 0.315)
    return obj


# ------------------------------------------------------------------- torso

def torso_cage():
    """Caderas, cintura estrecha, caja torácica y hombros anchos y planos."""
    T = P.TORSO_H
    mid = P.WAIST_W + (P.CHEST_W - P.WAIST_W) * 0.65
    rings = [
        Ring(T * -0.19, P.HIP_W * 0.72, P.HIP_W * 0.58, n=3.0),
        Ring(T * -0.07, P.HIP_W * 0.98, P.HIP_W * 0.70, n=3.0),
        Ring(T * 0.05, P.HIP_W * 1.00, P.HIP_W * 0.71, n=3.0, back=1.05),
        Ring(T * 0.21, P.WAIST_W, P.WAIST_W * 0.74, n=3.2, back=1.04),
        Ring(T * 0.40, mid, mid * 0.70, n=3.0, front=1.03, back=1.05),
        Ring(T * 0.62, P.CHEST_W, P.CHEST_W * 0.67, n=2.9, front=1.05, back=1.07),
        Ring(T * 0.79, P.SHOULDER_W, P.SHOULDER_W * 0.58, n=2.7, front=1.03, back=1.05),
        Ring(T * 0.91, P.SHOULDER_W * 0.78, P.SHOULDER_W * 0.54, n=2.7),
        Ring(T * 1.00, P.SHOULDER_W * 0.44, P.SHOULDER_W * 0.42, n=2.5),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    # Pecho y omóplatos: el torso deja de ser un tubo
    verts = sculpt.push(verts, (0.0, P.CHEST_W * 0.70, T * 0.58),
                        (0.0, 1.0, 0.0), P.CHEST_W * 1.05, P.CHEST_W * 0.075)
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * P.CHEST_W * 0.55, -P.CHEST_W * 0.55, T * 0.66),
                            (0.0, -1.0, 0.0), P.CHEST_W * 0.70, P.CHEST_W * 0.055)
    # Trapecio: sube del hombro al cuello
    for side in (-1, 1):
        verts = sculpt.push(verts, (side * P.SHOULDER_W * 0.62, 0.0, T * 0.88),
                            (0.0, 0.0, 1.0), P.SHOULDER_W * 0.70, P.SHOULDER_W * 0.10)
    return verts, faces


def build_torso(name="Torso"):
    verts, faces = torso_cage()
    obj = new_object(name, verts, faces)
    obj.location = (0.0, 0.0, P.Y_HIP)
    return obj


def build_neck(name="Neck"):
    r = P.SHOULDER_W * 0.42
    rings = [
        Ring(-0.020, r * 1.20, r * 1.06, n=2.8),
        Ring(0.008, r * 1.00, r * 0.92, n=2.7),
        Ring(P.NECK_H + 0.016, r * 0.96, r * 0.90, n=2.7),
    ]
    verts, faces = rings_to_mesh(rings, segments=12)
    obj = new_object(name, verts, faces)
    obj.location = (0.0, -0.004, P.Y_NECK)
    return obj


# ------------------------------------------------------------------ brazos

def build_arm_upper(side, name):
    """Del hombro al codo. Origen en el hombro."""
    r = P.ARM_R
    elbow = -P.UPPER_ARM
    rings = [
        Ring(0.072, r * 0.60, r * 0.58, n=2.6),
        Ring(0.050, r * 0.88, r * 0.85, n=2.6),
        Ring(0.016, r * 1.04, r * 1.00, n=2.5),
        Ring(elbow * 0.55, r * 0.86, r * 0.84, n=2.5),
        Ring(elbow + 0.010, r * 0.78, r * 0.77, n=2.5),
        Ring(elbow - 0.014, r * 0.74, r * 0.73, n=2.6),
    ]
    verts, faces = rings_to_mesh(rings, segments=12)
    # Deltoides hacia fuera y bíceps hacia delante
    verts = sculpt.push(verts, (side * r * 0.55, 0.0, 0.010),
                        (side * 1.0, 0.0, 0.0), r * 1.10, r * 0.14)
    verts = sculpt.push(verts, (0.0, r * 0.70, elbow * 0.45),
                        (0.0, 1.0, 0.0), r * 1.00, r * 0.10)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER)
    return obj


def build_arm_lower(side, name):
    """Del codo a la muñeca. Origen en el codo."""
    r = P.ARM_R
    wrist = -P.FOREARM
    rings = [
        Ring(0.026, r * 0.72, r * 0.71, n=2.6),
        Ring(0.004, r * 0.80, r * 0.79, n=2.5),
        Ring(wrist * 0.42, r * 0.72, r * 0.71, n=2.5),
        Ring(wrist + 0.018, r * 0.60, r * 0.59, n=2.6),
        Ring(wrist, r * 0.54, r * 0.53, n=2.7),
    ]
    verts, faces = rings_to_mesh(rings, segments=12)
    obj = new_object(name, verts, faces)
    obj.location = (0.0, 0.0, 0.0)
    obj.matrix_world.translation = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER - P.UPPER_ARM)
    return obj


def build_hand(side, name):
    """Mano chibi tipo manopla. Origen en la muñeca."""
    r = P.ARM_R
    L = P.HAND_LEN
    rings = [
        Ring(0.010, r * 0.56, r * 0.46, n=3.0),
        Ring(-0.020, r * 0.76, r * 0.57, n=3.2),
        Ring(-L * 0.55, r * 0.80, r * 0.58, n=3.2),
        Ring(-L * 0.85, r * 0.68, r * 0.50, n=3.0),
        Ring(-L, r * 0.38, r * 0.32, n=3.0),
    ]
    verts, faces = rings_to_mesh(rings, segments=12)
    verts = sculpt.push(verts, (0.0, r * 0.50, -L * 0.62),
                        (0.0, 1.0, 0.0), r * 0.60, r * 0.10)
    # Pulgar integrado en la misma malla
    trings = [
        Ring(0.0, r * 0.28, r * 0.26, n=2.6),
        Ring(-r * 0.40, r * 0.26, r * 0.24, n=2.6),
        Ring(-r * 0.74, r * 0.16, r * 0.16, n=2.6),
    ]
    tv, tf = rings_to_mesh(trings, segments=8)
    import math
    ang = side * 0.85
    base = len(verts)
    for (vx, vy, vz) in tv:
        rx = vx * math.cos(ang) + vz * math.sin(ang)
        rz = -vx * math.sin(ang) + vz * math.cos(ang)
        verts.append((rx - side * r * 0.56, vy + r * 0.18, rz - L * 0.26))
    faces.extend(tuple(i + base for i in f) for f in tf)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.SHOULDER_X, 0.0, P.Y_SHOULDER - P.UPPER_ARM - P.FOREARM)
    return obj


# ----------------------------------------------------------------- piernas

def build_leg_upper(side, name):
    """De la cadera a la rodilla. Origen en la cadera."""
    r = P.THIGH_R
    knee = -P.THIGH
    rings = [
        Ring(0.058, r * 0.72, r * 0.70, n=2.9),
        Ring(0.030, r * 0.94, r * 0.92, n=2.9),
        Ring(-0.014, r * 1.02, r * 0.99, n=2.9),
        Ring(knee * 0.50, r * 0.92, r * 0.90, n=2.8),
        Ring(knee + 0.022, r * 0.84, r * 0.83, n=2.7),
        Ring(knee - 0.018, r * 0.80, r * 0.80, n=2.7),
    ]
    verts, faces = rings_to_mesh(rings, segments=12)
    verts = sculpt.push(verts, (0.0, r * 0.80, knee * 0.45), (0.0, 1.0, 0.0), r * 1.10, r * 0.10)
    verts = sculpt.push(verts, (0.0, -r * 0.80, 0.010), (0.0, -1.0, 0.0), r * 1.00, r * 0.12)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.HIP_X, 0.0, P.Y_HIP)
    return obj


def build_leg_lower(side, name):
    """De la rodilla al tobillo. Origen en la rodilla."""
    r = P.THIGH_R
    ankle = -P.SHIN
    rings = [
        Ring(0.028, r * 0.80, r * 0.79, n=2.7),
        Ring(0.002, r * 0.84, r * 0.83, n=2.7, front=1.06),
        Ring(ankle * 0.34, r * 0.80, r * 0.79, n=2.7, back=1.20),
        Ring(ankle * 0.72, r * 0.64, r * 0.63, n=2.7, back=1.06),
        Ring(ankle, r * 0.52, r * 0.52, n=2.8),
    ]
    verts, faces = rings_to_mesh(rings, segments=12)
    verts = sculpt.push(verts, (0.0, r * 0.72, 0.004), (0.0, 1.0, 0.0), r * 0.55, r * 0.06)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.HIP_X, 0.0, P.Y_KNEE)
    return obj


def build_foot(side, name):
    """Pie con empeine y talón; la bota lo cubrirá casi siempre."""
    r = P.THIGH_R
    A = P.Y_ANKLE
    rings = [
        Ring(0.010, r * 0.52, r * 0.58, n=2.8, y=r * 0.10),
        Ring(-A * 0.34, r * 0.62, r * 0.96, n=3.0, y=r * 0.36),
        Ring(-A * 0.70, r * 0.66, r * 1.22, n=3.2, y=r * 0.55),
        Ring(-A * 0.95, r * 0.64, r * 1.28, n=3.4, y=r * 0.58),
        Ring(-A, r * 0.58, r * 1.22, n=3.6, y=r * 0.58),
    ]
    verts, faces = rings_to_mesh(rings, segments=14)
    # Talón hacia atrás
    verts = sculpt.push(verts, (0.0, -r * 0.45, -A * 0.55),
                        (0.0, -1.0, 0.0), r * 0.70, r * 0.16)
    obj = new_object(name, verts, faces)
    obj.location = (side * P.HIP_X, 0.0, P.Y_ANKLE)
    return obj
