"""
Materiales del personaje.

El prefijo `Recolor_<canal>` es un contrato con el juego: el cliente busca
esos materiales en el GLB y les aplica el color que ha elegido el jugador
(piel, pelo, ojos, principal, secundario). Un material sin ese prefijo
conserva siempre su color.
"""
import bpy

CHANNELS = ("skin", "hair", "eyes", "primary", "secondary")

DEFAULTS = {
    "skin": (0.86, 0.62, 0.46, 1.0),
    "hair": (0.045, 0.036, 0.032, 1.0),
    "eyes": (0.22, 0.13, 0.07, 1.0),
    # Equipo táctico: casi negro. Un gris medio se lava con luz fuerte y el
    # personaje deja de leerse como operativo.
    "primary": (0.035, 0.040, 0.052, 1.0),
    "secondary": (0.115, 0.125, 0.115, 1.0),
}


def make(name, color, roughness=0.75, metallic=0.0, emission=None, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return mat


def recolor(channel, roughness=0.75, metallic=0.0):
    """Material que el juego puede repintar con el color del jugador."""
    name = f"Recolor_{channel}"
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    return make(name, DEFAULTS[channel], roughness, metallic)


def fixed(name, color, roughness=0.75, metallic=0.0, emission=None, alpha=1.0):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    return make(name, color, roughness, metallic, emission, alpha)


def assign(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj
