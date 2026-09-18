"""
Rasgos de la cara.

La clave del estilo es el OJO: grande, con un contorno oscuro que lo enmarca,
iris que ocupa casi todo el hueco y un brillo fuerte. Ese contorno es lo que
hace que la mirada se lea como personaje de videojuego moderno y no como dos
bolas pegadas a una cabeza.

Todo se coloca midiendo la superficie real del cráneo con un rayo, así que los
rasgos siguen apoyados en la piel aunque cambien las proporciones.
"""
import math

from . import materials
from . import proportions as P
from .mesh import Ring, cube_sphere, new_object, rings_to_mesh, surface_y

EYE_Z = P.HEAD_H * 0.320
EYE_X = P.HEAD_W * 0.360
EYE_R = P.HEAD_W * 0.250        # ojo grande: casi un cuarto del ancho de la cabeza
BROW_Z = EYE_Z + P.HEAD_H * 0.112
MOUTH_Z = EYE_Z - P.HEAD_H * 0.150


def _sphere(name, radius, scale=(1, 1, 1), subdiv=3):
    verts, faces = cube_sphere(subdiv)
    pts = [(v[0] * radius * scale[0], v[1] * radius * scale[1], v[2] * radius * scale[2]) for v in verts]
    return new_object(name, pts, faces)


def _skin_y(head, x, z, fallback):
    y = surface_y(head, x, z)
    return fallback if y is None else y


def build_eyes(head):
    """
    El ojo se construye por capas, cada una un elipsoide muy achatado en Y
    (el eje que mira hacia la cara). Las medidas están en unidades de EYE_R y
    cumplen dos condiciones en todas las capas:

      * el polo delantero sobresale del de la capa anterior  -> se ve;
      * el borde queda por detrás de la superficie anterior   -> no flota.

    Ese es justo el fallo que tenía antes: el iris estaba dentro del globo.
    """
    pieces = []
    rim = materials.fixed("Eye_Rim", (0.035, 0.030, 0.038, 1.0), roughness=0.38)
    white = materials.fixed("Eye_White", (0.97, 0.97, 0.98, 1.0), roughness=0.20)
    iris_mat = materials.recolor("eyes", roughness=0.14)
    pupil = materials.fixed("Eye_Pupil", (0.030, 0.024, 0.036, 1.0), roughness=0.18)
    shine = materials.fixed("Eye_Shine", (1.0, 1.0, 1.0, 1.0), roughness=0.04,
                            emission=(1.0, 1.0, 1.0, 1.0))

    R = EYE_R
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        x = side * EYE_X
        skin = _skin_y(head, x, EYE_Z, P.HEAD_D * 0.80)
        cy = skin - R * 0.30            # y = 0 de las capas
        tilt = (0.0, 0.0, -side * 0.09)

        def layer(name, rx, ty, rz, cyy, z=EYE_Z, xx=x, mat=None, subdiv=3):
            obj = _sphere(name, R, (rx, ty, rz * 1.06), subdiv=subdiv)
            obj.location = (xx, cy + R * cyy, z)
            obj.rotation_euler = tilt
            materials.assign(obj, mat)
            pieces.append(obj)
            return obj

        # 1. Contorno oscuro: más ancho y menos abombado que el blanco, así
        #    solo asoma como un anillo negro alrededor del ojo.
        layer(f"Eye{tag}_Rim", 1.13, 0.38, 1.13, -0.02, mat=rim)
        # 2. Blanco
        layer(f"Eye{tag}_Globe", 1.00, 0.42, 1.00, 0.00, mat=white)
        # 3. Iris grande, ligeramente bajo
        layer(f"Eye{tag}_Iris", 0.62, 0.15, 0.62, 0.30, z=EYE_Z - R * 0.05, mat=iris_mat)
        # 4. Pupila
        layer(f"Eye{tag}_Pupil", 0.30, 0.09, 0.30, 0.40, z=EYE_Z - R * 0.05,
              mat=pupil, subdiv=2)
        # 5. Brillo arriba, hacia fuera
        layer(f"Eye{tag}_Shine", 0.19, 0.13, 0.19, 0.41,
              z=EYE_Z + R * 0.26, xx=x - side * R * 0.30, mat=shine, subdiv=2)
        # 6. Brillo pequeño abajo, al lado contrario: el truco de siempre para
        #    que la mirada no parezca de muñeco de plástico.
        layer(f"Eye{tag}_Shine2", 0.10, 0.10, 0.10, 0.40,
              z=EYE_Z - R * 0.32, xx=x + side * R * 0.28, mat=shine, subdiv=2)

        # 7. Párpado superior grueso, apoyado sobre el contorno
        lash = _build_lash(f"Eye{tag}_Lash", side)
        lash.location = (x, cy, EYE_Z)
        lash.rotation_euler = tilt
        # El párpado se aplasta en Y igual que el resto de capas: si no,
        # flotaría muy por delante del contorno.
        lash.scale = (1.0, 0.30, 1.0)
        materials.assign(lash, rim)
        pieces.append(lash)
    return pieces


def _build_lash(name, side):
    """Arco grueso sobre el borde superior del ojo, apoyado en su superficie."""
    r = EYE_R * 1.16
    theta = math.radians(56)
    verts, faces = [], []
    segments = 6
    starts = []
    steps = 10
    for i in range(steps + 1):
        t_ = i / steps
        a = math.radians(14 + 152 * t_)
        dx, dy, dz = math.cos(a) * math.sin(theta), math.cos(theta), math.sin(a) * math.sin(theta)
        cx, cy, cz = dx * r, dy * r, dz * r
        # Los extremos deben cerrarse casi en punta: con grosor constante las
        # tapas del tubo asomaban por fuera del contorno como dos pestañas.
        thick = r * (0.012 + 0.215 * math.sin(math.pi * t_) ** 0.75
                     + 0.035 * (t_ if side > 0 else 1 - t_) * math.sin(math.pi * t_))
        starts.append(len(verts))
        for s in range(segments):
            ang = (s / segments) * math.tau
            ux, uy, uz = -math.sin(a), 0.0, math.cos(a)
            bx = uy * dz - uz * dy
            by = uz * dx - ux * dz
            bz = ux * dy - uy * dx
            ca, sa = math.cos(ang), math.sin(ang)
            verts.append((cx + (dx * ca + bx * sa) * thick,
                          cy + (dy * ca + by * sa) * thick,
                          cz + (dz * ca + bz * sa) * thick))
    for i in range(steps):
        a0, b0 = starts[i], starts[i + 1]
        for s in range(segments):
            j = (s + 1) % segments
            faces.append((a0 + s, a0 + j, b0 + j, b0 + s))
    faces.append(tuple(range(starts[0] + segments - 1, starts[0] - 1, -1)))
    last = starts[-1]
    faces.append(tuple(range(last, last + segments)))
    return new_object(name, verts, faces)


def _surface_tube(head, name, samples, radius_fn, offset=0.004, segments=8, squash=0.55):
    verts, faces = [], []
    ring_starts = []
    count = len(samples)
    for i, (x, z) in enumerate(samples):
        t = i / (count - 1)
        y = _skin_y(head, x, z, P.HEAD_D * 0.80) + offset
        r = radius_fn(t)
        ring_starts.append(len(verts))
        for s in range(segments):
            a = (s / segments) * math.tau
            verts.append((x, y + math.cos(a) * r * squash, z + math.sin(a) * r))
    for i in range(count - 1):
        a0, b0 = ring_starts[i], ring_starts[i + 1]
        for s in range(segments):
            j = (s + 1) % segments
            faces.append((a0 + s, a0 + j, b0 + j, b0 + s))
    faces.append(tuple(range(ring_starts[0] + segments - 1, ring_starts[0] - 1, -1)))
    last = ring_starts[-1]
    faces.append(tuple(range(last, last + segments)))
    return new_object(name, verts, faces)


def build_brows(head):
    """Cejas gruesas y anguladas: cargan casi toda la expresión."""
    pieces = []
    mat = materials.recolor("hair", roughness=0.5)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        samples = []
        steps = 8
        for i in range(steps + 1):
            t = i / steps
            x = side * (EYE_X * 0.32 + EYE_X * 1.38 * t)
            z = BROW_Z + P.HEAD_H * 0.020 * math.sin(math.pi * t) - P.HEAD_H * 0.034 * t
            samples.append((x, z))
        obj = _surface_tube(head, f"Brow{tag}", samples,
                            lambda t: P.HEAD_W * (0.008 + 0.040 * math.sin(math.pi * t) ** 0.6),
                            offset=0.002, squash=0.45)
        materials.assign(obj, mat)
        pieces.append(obj)
    return pieces


def build_mouth(head):
    """Boca pequeña y curva. En este estilo manda la mirada, no la boca."""
    mat = materials.fixed("Mouth", (0.38, 0.17, 0.18, 1.0), roughness=0.45)
    samples = []
    steps = 8
    half = P.HEAD_W * 0.130
    for i in range(steps + 1):
        t = i / steps
        x = -half + 2 * half * t
        z = MOUTH_Z - P.HEAD_H * 0.020 * math.sin(math.pi * t)
        samples.append((x, z))
    obj = _surface_tube(head, "Mouth", samples,
                        lambda t: P.HEAD_W * (0.013 + 0.011 * math.sin(math.pi * t)),
                        offset=-0.002, squash=0.6)
    materials.assign(obj, mat)
    return [obj]
