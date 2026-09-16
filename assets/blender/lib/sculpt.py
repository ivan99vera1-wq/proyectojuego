"""
Escultura programática: empujar zonas concretas de la malla con una caída
suave. Es lo que convierte una superficie de revolución en una cara con
pómulos, ceja y mandíbula, en vez de una forma torneada.
"""
import math
from mathutils import Vector


def falloff(distance, radius):
    """Caída suave tipo campana: 1 en el centro, 0 en el borde."""
    if distance >= radius:
        return 0.0
    t = 1.0 - distance / radius
    return t * t * (3.0 - 2.0 * t)


def push(verts, center, direction, radius, strength, mask=None):
    """
    Desplaza los vértices cercanos a `center` en la dirección dada.
    `mask(v)` permite limitar el efecto a media cara, un lado, etc.
    """
    c = Vector(center)
    d = Vector(direction)
    if d.length > 0:
        d = d.normalized()
    out = []
    for v in verts:
        vv = Vector(v)
        if mask is None or mask(vv):
            w = falloff((vv - c).length, radius)
            if w > 0:
                vv = vv + d * (strength * w)
        out.append((vv.x, vv.y, vv.z))
    return out


def scale_region(verts, center, radius, factor, axis=(1, 1, 1)):
    """Ensancha o estrecha una zona respecto a su centro."""
    c = Vector(center)
    out = []
    for v in verts:
        vv = Vector(v)
        w = falloff((vv - c).length, radius)
        if w > 0:
            delta = vv - c
            k = 1.0 + (factor - 1.0) * w
            vv = c + Vector((delta.x * (k if axis[0] else 1.0),
                             delta.y * (k if axis[1] else 1.0),
                             delta.z * (k if axis[2] else 1.0)))
        out.append((vv.x, vv.y, vv.z))
    return out


def flatten_front(verts, z_from, z_to, amount, y_min=0.0):
    """Aplana la parte delantera entre dos alturas: la cara de un chibi es plana."""
    out = []
    for v in verts:
        x, y, z = v
        if y > y_min and z_from <= z <= z_to:
            t = math.sin(math.pi * (z - z_from) / max(1e-6, z_to - z_from))
            y = y * (1.0 - amount * t)
        out.append((x, y, z))
    return out


def mirror_x_positive(v):
    return v.x > 0.001


def mirror_x_negative(v):
    return v.x < -0.001
