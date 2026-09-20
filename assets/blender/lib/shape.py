"""
Retoques de forma sobre la malla base, antes de enlazarla al esqueleto.

Aquí es donde el modelo descargado deja de ser un maniquí genérico y pasa a ser
EL personaje del juego: plano facial donde apoyar los rasgos, mandíbula más
marcada, hombros algo más anchos. Todo con caída suave, sin tocar la topología.

IMPORTANTE: esto se aplica SIEMPRE antes de `rig.skin()`. Deformar la malla
después de calcular los pesos los deja inservibles.
"""
import math

from . import proportions as P


def _falloff(d, r):
    if d >= r:
        return 0.0
    t = 1.0 - d / r
    return t * t * (3.0 - 2.0 * t)


def push(mesh, center, direction, radius, strength, only=None):
    """Empuja los vértices cercanos a `center` en `direction` con caída suave."""
    cx, cy, cz = center
    dx, dy, dz = direction
    n = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
    dx, dy, dz = dx / n, dy / n, dz / n
    for v in mesh.vertices:
        if only and not only(v.co):
            continue
        d = math.dist((v.co.x, v.co.y, v.co.z), (cx, cy, cz))
        k = _falloff(d, radius)
        if k <= 0.0:
            continue
        v.co.x += dx * strength * k
        v.co.y += dy * strength * k
        v.co.z += dz * strength * k


def flatten_front(mesh, z_from, z_to, amount, y_min):
    """
    Aplana la mitad delantera entre dos alturas. Un cráneo esférico hace que
    los ojos se hundan por dentro y sobresalgan por fuera; con un plano facial
    los rasgos se apoyan de verdad.
    """
    mid = (z_from + z_to) * 0.5
    half = (z_to - z_from) * 0.5
    for v in mesh.vertices:
        if v.co.y <= y_min:
            continue
        k = _falloff(abs(v.co.z - mid), half)
        if k <= 0.0:
            continue
        # Cuanto más al centro de la cara, más se aplana.
        lateral = _falloff(abs(v.co.x), P.HEAD_W * 0.92)
        v.co.y -= v.co.y * amount * k * lateral


def masculine_pass(mesh):
    """
    Los retoques que separan a este personaje del maniquí original.
    Los números son fracciones de las medidas de `proportions.py`, así que
    siguen valiendo si mañana cambia la escala del modelo.
    """
    W, D, H = P.HEAD_W, P.HEAD_D, P.HEAD_H
    chin = P.Y_CHIN

    # 1. Plano facial: de la boca a la frente.
    flatten_front(mesh, chin + H * 0.10, chin + H * 0.62, 0.17, y_min=D * 0.12)

    # 2. Reborde de ceja: sombra sobre los ojos, que es lo que da mirada.
    for s in (-1, 1):
        push(mesh, (s * W * 0.34, D * 0.70, chin + H * 0.46), (0, 1, 0.15),
             W * 0.40, W * 0.052)

    # 3. Mandíbula más ancha y recta: la lectura masculina más barata que hay.
    for s in (-1, 1):
        push(mesh, (s * W * 0.62, D * 0.20, chin + H * 0.14), (s, 0.30, 0),
             W * 0.52, W * 0.060)
    # 4. Mentón algo más adelantado y cuadrado.
    push(mesh, (0.0, D * 0.52, chin + H * 0.055), (0, 1, 0.25), W * 0.34, W * 0.055)

    # 5. Nuca llena: de perfil, una cabeza plana por detrás parece un globo.
    push(mesh, (0.0, -D * 0.86, chin + H * 0.52), (0, -1, 0), W * 0.78, W * 0.030)

    # 6. Hombros: un pelín más anchos y más altos que el maniquí neutro.
    for s in (-1, 1):
        push(mesh, (s * P.SHOULDER_X * 0.92, 0.0, P.Y_SHOULDER + 0.012),
             (s * 0.86, 0.0, 0.50), P.SHOULDER_W * 0.80, P.SHOULDER_W * 0.085)
    # 7. Pecho algo más plano y ancho.
    push(mesh, (0.0, P.CHEST_W * 0.72, P.Y_CHEST), (0, 1, 0),
         P.CHEST_W * 1.15, P.CHEST_W * 0.055)
    # 8. Cintura un poco más entrada: acentúa la V del torso.
    for s in (-1, 1):
        push(mesh, (s * P.WAIST_W, 0.0, P.Y_WAIST), (-s, 0.0, 0.0),
             P.WAIST_W * 1.30, P.WAIST_W * 0.10)
    mesh.update()
    return mesh
