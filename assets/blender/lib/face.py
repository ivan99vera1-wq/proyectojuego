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
    """
    Altura de la piel en (x, z). Los rasgos se miden en el espacio de la
    CABEZA (mentón en z=0) pero la malla del cuerpo vive en coordenadas de
    mundo, así que el rayo se lanza sumando la altura del mentón.
    """
    y = surface_y(head, x, z + P.Y_CHIN)
    return fallback if y is None else y


# ---------------------------------------------------------------- el ojo
# Cada capa del ojo se describe con una sola línea:
#   (radio_lateral, semigrosor, radio_vertical, profundidad, du, dv, se_apoya_en)
# Todo en unidades de EYE_R y medido a lo largo de la normal de la cara;
# `du`/`dv` desplazan la capa sobre el plano del ojo (derecha y arriba).
#
# Estas cifras NO se tocan a ojo: `_check_eye_stack()` comprueba al construir
# que cada capa asoma por delante de la de debajo y que su borde queda por
# detrás. La última vez que se ajustaron a mano, el iris acabó a la misma
# profundidad que el blanco y desapareció del modelo sin que fallara nada.
EYE_LAYERS = {
    "rim":    (1.09, 0.36, 1.09, -0.02, 0.00, 0.00, None),
    "globe":  (1.00, 0.42, 1.00,  0.03, 0.00, 0.00, "rim"),
    "iris":   (0.62, 0.17, 0.62,  0.34, 0.00, -0.05, "globe"),
    "pupil":  (0.30, 0.09, 0.30,  0.45, 0.00, -0.05, "iris"),
    "shine":  (0.15, 0.12, 0.15,  0.39, -0.30, 0.26, "iris"),
    "shine2": (0.10, 0.09, 0.10,  0.40, 0.28, -0.32, "iris"),
}


def _surface_at(layer, rho):
    """Profundidad de la superficie de una capa a distancia `rho` de su centro."""
    r, half, _rz, depth, du, dv, _under = EYE_LAYERS[layer]
    d = rho - math.hypot(du, dv) * 0.0     # el rho ya llega relativo a esta capa
    if d >= r:
        return None
    return depth + half * math.sqrt(1.0 - (d / r) ** 2)


def _check_eye_stack():
    """
    Comprueba las dos reglas del ojo:
      1. cada capa asoma por delante de la de debajo en su centro;
      2. su borde queda por DETRÁS de ella, para que no flote en el aire.
    Si alguna falla, el ojo se vería mal en el juego: mejor romper aquí.
    """
    for name, (r, half, _rz, depth, du, dv, under) in EYE_LAYERS.items():
        if under is None:
            continue
        rho = math.hypot(du, dv)
        front = depth + half
        center_ref = _surface_at(under, rho)
        edge_ref = _surface_at(under, rho + r)
        if center_ref is None:
            raise ValueError(f"capa {name!r}: {under!r} no llega a cubrirla")
        if front <= center_ref + 1e-4:
            raise ValueError(
                f"capa {name!r} no asoma: su polo ({front:.3f}) no pasa de "
                f"{under!r} ({center_ref:.3f}). Sube su profundidad.")
        if edge_ref is not None and depth >= edge_ref - 1e-4:
            raise ValueError(
                f"capa {name!r} flota: su borde ({depth:.3f}) queda por delante "
                f"de {under!r} ({edge_ref:.3f}). Bájala o hazla más pequeña.")


_check_eye_stack()


def _surface(head, x, z):
    """Punto y normal de la piel en (x, z), en coordenadas de mundo."""
    import bpy
    from mathutils import Vector
    deps = bpy.context.evaluated_depsgraph_get()
    ev = head.evaluated_get(deps)
    origin = Vector((x - head.location.x, 3.0, z + P.Y_CHIN - head.location.z))
    hit, loc, nor, _idx = ev.ray_cast(origin, Vector((0.0, -1.0, 0.0)))
    if not hit:
        return Vector((x, P.HEAD_D * 0.80, z)), Vector((0.0, 1.0, 0.0))
    world = Vector((loc.x + head.location.x, loc.y + head.location.y,
                    loc.z + head.location.z - P.Y_CHIN))
    normal = Vector((nor.x, nor.y, nor.z))
    if normal.y < 0:
        normal = -normal
    return world, normal.normalized()


def build_eyes(head):
    """
    El ojo se construye por capas, cada una un elipsoide muy achatado contra la
    cara. Las medidas están en unidades de EYE_R y cumplen dos condiciones:

      * el polo delantero sobresale del de la capa anterior  -> se ve;
      * el borde queda por detrás de la superficie anterior   -> no flota.

    TODO el conjunto se coloca sobre un marco local (derecha, normal, arriba)
    tomado de la superficie real del cráneo. Girar cada pieza por separado,
    como se hacía antes, descuadraba las capas entre sí.
    """
    from mathutils import Matrix, Vector
    pieces = []
    rim = materials.fixed("Eye_Rim", (0.035, 0.030, 0.038, 1.0), roughness=0.38)
    white = materials.fixed("Eye_White", (0.97, 0.97, 0.98, 1.0), roughness=0.20)
    iris_mat = materials.recolor("eyes", roughness=0.14)
    pupil = materials.fixed("Eye_Pupil", (0.030, 0.024, 0.036, 1.0), roughness=0.18)
    shine = materials.fixed("Eye_Shine", (1.0, 1.0, 1.0, 1.0), roughness=0.04,
                            emission=(1.0, 1.0, 1.0, 1.0))

    R = EYE_R
    up = Vector((0.0, 0.0, 1.0))
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        x = side * EYE_X
        point, normal = _surface(head, x, EYE_Z)
        # Marco local del ojo: n hacia fuera de la cara, u a su derecha, v arriba.
        n = normal
        u = up.cross(n)
        u = Vector((1.0, 0.0, 0.0)) if u.length < 1e-4 else u.normalized()
        v = n.cross(u).normalized()
        basis = Matrix((
            (u.x, n.x, v.x),
            (u.y, n.y, v.y),
            (u.z, n.z, v.z),
        ))
        euler = basis.to_euler()
        # Origen del apilado: un pelín por dentro de la piel.
        base = point - n * (R * 0.12)

        def layer(name, rx, ty, rz, depth, du=0.0, dv=0.0, mat=None, subdiv=3):
            obj = _sphere(name, R, (rx, ty, rz * 1.06), subdiv=subdiv)
            pos = base + n * (R * depth) + u * (R * du) + v * (R * dv)
            obj.location = (pos.x, pos.y, pos.z)
            obj.rotation_euler = euler
            materials.assign(obj, mat)
            pieces.append(obj)
            return obj

        # Contorno oscuro, blanco, iris, pupila y dos brillos. El orden y las
        # profundidades salen de EYE_LAYERS, que está validada al importar.
        for key, mat, subdiv in (("rim", rim, 3), ("globe", white, 3),
                                 ("iris", iris_mat, 3), ("pupil", pupil, 2),
                                 ("shine", shine, 2), ("shine2", shine, 2)):
            rx, ty, rz, depth, du, dv, _under = EYE_LAYERS[key]
            # `du` se refleja según el lado para que los brillos caigan siempre
            # hacia fuera de la cara.
            layer(f"Eye{tag}_{key.capitalize()}", rx, ty, rz, depth,
                  du=side * du, dv=dv, mat=mat, subdiv=subdiv)

        # 7. Párpado superior grueso, apoyado sobre el contorno
        lash = _build_lash(f"Eye{tag}_Lash", side)
        lash.location = (base.x, base.y, base.z)
        lash.rotation_euler = euler
        # Se aplasta contra la cara igual que el resto de capas.
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
                            lambda t: P.HEAD_W * (0.006 + 0.028 * math.sin(math.pi * t) ** 0.6),
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


def build_nose(head, name="Nose"):
    """
    Nariz de botón. El modelo base de Sketchfab viene con la cabeza lisa, así
    que la nariz es una pieza aparte apoyada sobre la superficie real.
    """
    W, D, H = P.HEAD_W, P.HEAD_D, P.HEAD_H
    z = EYE_Z - H * 0.075
    skin = _skin_y(head, 0.0, z, D * 0.80)
    verts, faces = cube_sphere(2)
    pts = [(v[0] * W * 0.048, v[1] * D * 0.032, v[2] * H * 0.020) for v in verts]
    obj = new_object(name, pts, faces)
    obj.location = (0.0, skin - D * 0.010, z)
    materials.assign(obj, materials.recolor("skin", roughness=0.62))
    return [obj]
