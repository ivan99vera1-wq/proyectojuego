"""
Rasgos de la cara: ojos, cejas y boca.

Todos se colocan midiendo la superficie real del cráneo con un rayo, no con
posiciones estimadas. Así siguen apoyados en la piel aunque cambien las
proporciones de la cabeza.

El ojo es un globo alojado en su cuenca, con iris, pupila, brillo y un
párpado grueso encima. Ese párpado es lo que hace que la mirada se lea como
un personaje de videojuego y no como un muñeco con dos bolas pegadas.
"""
import math

from . import materials
from . import proportions as P
from .mesh import Ring, cube_sphere, new_object, rings_to_mesh, surface_y

EYE_Z = P.HEAD_H * 0.380
EYE_X = P.HEAD_W * 0.360
EYE_R = P.HEAD_W * 0.175
BROW_Z = EYE_Z + P.HEAD_H * 0.108
MOUTH_Z = EYE_Z - P.HEAD_H * 0.172


def _sphere(name, radius, scale=(1, 1, 1), subdiv=3):
    verts, faces = cube_sphere(subdiv)
    pts = [(v[0] * radius * scale[0], v[1] * radius * scale[1], v[2] * radius * scale[2]) for v in verts]
    return new_object(name, pts, faces)


def _skin_y(head, x, z, fallback):
    y = surface_y(head, x, z)
    return fallback if y is None else y


def build_eyes(head):
    """Ojos alojados en la cuenca, midiendo la piel para no hundirlos ni sacarlos."""
    pieces = []
    white = materials.fixed("Eye_White", (0.93, 0.93, 0.95, 1.0), roughness=0.22)
    iris_mat = materials.recolor("eyes", roughness=0.16)
    pupil = materials.fixed("Eye_Pupil", (0.045, 0.035, 0.055, 1.0), roughness=0.2)
    shine = materials.fixed("Eye_Shine", (1.0, 1.0, 1.0, 1.0), roughness=0.05,
                            emission=(1.0, 1.0, 1.0, 1.0))
    lash = materials.fixed("Eye_Lash", (0.055, 0.045, 0.055, 1.0), roughness=0.4)

    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        x = side * EYE_X
        skin = _skin_y(head, x, EYE_Z, P.HEAD_D * 0.78)
        # El 45% del globo asoma de la cuenca: suficiente para leerse, no tanto
        # como para parecer una canica pegada.
        cy = skin - EYE_R * 0.55

        globe = _sphere(f"Eye{tag}_Globe", EYE_R, (1.0, 0.94, 1.08))
        globe.location = (x, cy, EYE_Z)
        materials.assign(globe, white)
        pieces.append(globe)

        iris = _sphere(f"Eye{tag}_Iris", EYE_R * 0.88, (1.0, 0.34, 0.94), subdiv=2)
        iris.location = (x, cy + EYE_R * 0.52, EYE_Z)
        materials.assign(iris, iris_mat)
        pieces.append(iris)

        pup = _sphere(f"Eye{tag}_Pupil", EYE_R * 0.40, (1.0, 0.30, 1.12), subdiv=2)
        pup.location = (x, cy + EYE_R * 0.78, EYE_Z)
        materials.assign(pup, pupil)
        pieces.append(pup)

        hi = _sphere(f"Eye{tag}_Shine", EYE_R * 0.20, subdiv=2)
        hi.location = (x - side * EYE_R * 0.34, cy + EYE_R * 0.90, EYE_Z + EYE_R * 0.44)
        materials.assign(hi, shine)
        pieces.append(hi)

        lid = _build_lash(f"Eye{tag}_Lash", side)
        lid.location = (x, cy, EYE_Z)
        materials.assign(lid, lash)
        pieces.append(lid)
    return pieces


def _build_lash(name, side):
    """
    Línea de pestañas: arco grueso que recorre el borde superior del globo,
    apoyado en su superficie. Un casquete suelto encima parece una tapa; este
    arco es lo que da forma de ojo diseñado.
    """
    r = EYE_R
    theta = math.radians(58)      # cuánto se separa del frente hacia arriba
    verts, faces = [], []
    segments = 6
    starts = []
    steps = 10
    for i in range(steps + 1):
        t_ = i / steps
        a = math.radians(6 + 168 * t_)          # de un extremo del ojo al otro
        # Punto sobre la esfera: +Y es hacia delante
        dx = math.cos(a) * math.sin(theta)
        dy = math.cos(theta)
        dz = math.sin(a) * math.sin(theta)
        cx, cy, cz = dx * r, dy * r, dz * r
        # Grosor: más grueso en el centro y hacia el extremo externo
        thick = r * (0.17 + 0.10 * math.sin(math.pi * t_) + 0.05 * (t_ if side > 0 else 1 - t_))
        starts.append(len(verts))
        for s in range(segments):
            ang = (s / segments) * math.tau
            # El anillo se abre alrededor de la dirección radial del globo
            ux, uy, uz = -math.sin(a), 0.0, math.cos(a)          # tangente del arco
            nx, ny, nz = dx, dy, dz                              # radial
            bx = uy * nz - uz * ny
            by = uz * nx - ux * nz
            bz = ux * ny - uy * nx
            ca, sa = math.cos(ang), math.sin(ang)
            verts.append((cx + (nx * ca + bx * sa) * thick,
                          cy + (ny * ca + by * sa) * thick,
                          cz + (nz * ca + bz * sa) * thick))
    for i in range(steps):
        a0, b0 = starts[i], starts[i + 1]
        for s in range(segments):
            j = (s + 1) % segments
            faces.append((a0 + s, a0 + j, b0 + j, b0 + s))
    faces.append(tuple(range(starts[0] + segments - 1, starts[0] - 1, -1)))
    last = starts[-1]
    faces.append(tuple(range(last, last + segments)))
    return new_object(name, verts, faces)


def _surface_tube(head, name, samples, radius_fn, offset=0.004, segments=8):
    """
    Tubo que sigue la superficie de la cara. `samples` son pares (x, z) y
    `radius_fn(t)` da el grosor a lo largo del recorrido.
    """
    verts, faces = [], []
    ring_starts = []
    count = len(samples)
    for i, (x, z) in enumerate(samples):
        t = i / (count - 1)
        y = _skin_y(head, x, z, P.HEAD_D * 0.78) + offset
        r = radius_fn(t)
        ring_starts.append(len(verts))
        for s in range(segments):
            a = (s / segments) * math.tau
            # El anillo se abre en el plano perpendicular al recorrido (Y-Z local)
            verts.append((x, y + math.cos(a) * r * 0.55, z + math.sin(a) * r))
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
    """Ceja: barra curvada y angulada que sigue la frente."""
    pieces = []
    mat = materials.recolor("hair", roughness=0.55)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        samples = []
        steps = 7
        for i in range(steps + 1):
            t = i / steps
            # De dentro (junto a la nariz) a fuera (sien)
            x = side * (EYE_X * 0.26 + EYE_X * 1.42 * t)
            z = BROW_Z + P.HEAD_H * 0.026 * math.sin(math.pi * t) - P.HEAD_H * 0.030 * t
            samples.append((x, z))
        obj = _surface_tube(head, f"Brow{tag}", samples,
                            lambda t: P.HEAD_W * (0.030 + 0.020 * math.sin(math.pi * t)),
                            offset=0.002)
        materials.assign(obj, mat)
        pieces.append(obj)
    return pieces


def build_mouth(head):
    """Boca: línea curva hundida, no una pegatina plana."""
    mat = materials.fixed("Mouth", (0.42, 0.20, 0.21, 1.0), roughness=0.5)
    samples = []
    steps = 8
    half = P.HEAD_W * 0.185
    for i in range(steps + 1):
        t = i / steps
        x = -half + 2 * half * t
        z = MOUTH_Z - P.HEAD_H * 0.028 * math.sin(math.pi * t)
        samples.append((x, z))
    obj = _surface_tube(head, "Mouth", samples,
                        lambda t: P.HEAD_W * (0.016 + 0.014 * math.sin(math.pi * t)),
                        offset=-0.002)
    materials.assign(obj, mat)
    return [obj]
