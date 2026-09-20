"""Escena de trabajo: limpieza, luces de estudio, cámara y render."""
import math
import bpy


def _node(tree, node_type):
    """
    Busca un nodo por TIPO, no por nombre. El nombre del nodo Principled
    cambia entre versiones e idiomas de Blender y buscarlo por texto revienta
    el script con un KeyError.
    """
    for node in tree.nodes:
        if node.type == node_type:
            return node
    raise KeyError(f"no hay ningún nodo {node_type} en {tree}")


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    try:
        scene.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    world = bpy.data.worlds.new("Mundo")
    scene.world = world
    world.use_nodes = True
    bg = _node(world.node_tree, "BACKGROUND")
    bg.inputs[0].default_value = (0.055, 0.062, 0.094, 1.0)
    bg.inputs[1].default_value = 1.0
    return scene


def studio_lights():
    """Tres puntos: principal cálida, relleno fría y contraluz."""
    def lamp(name, kind, energy, loc, rot, size=3.0, color=(1, 1, 1)):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = color
        if kind == "AREA":
            data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = rot
        bpy.context.scene.collection.objects.link(obj)
        return obj

    lamp("Key", "AREA", 260, (1.6, -1.9, 2.2), (math.radians(52), 0, math.radians(40)),
         size=2.4, color=(1.0, 0.95, 0.88))
    lamp("Fill", "AREA", 90, (-2.2, -1.4, 1.2), (math.radians(72), 0, math.radians(-58)),
         size=3.0, color=(0.74, 0.83, 1.0))
    lamp("Rim", "AREA", 190, (-0.8, 2.4, 1.9), (math.radians(118), 0, math.radians(-160)),
         size=2.0, color=(0.85, 0.92, 1.0))


def camera(name="Cam", target=(0, 0, 0.62), distance=3.0, yaw=0.0, pitch=0.06, lens=68.0):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    # El personaje mira hacia +Y (al exportar a glTF eso se convierte en -Z,
    # que es la dirección de avance en el juego). La cámara frontal, por tanto,
    # se coloca en el lado +Y.
    cam.location = (
        target[0] + math.sin(yaw) * math.cos(pitch) * distance,
        target[1] + math.cos(yaw) * math.cos(pitch) * distance,
        target[2] + math.sin(pitch) * distance,
    )
    direction = (target[0] - cam.location[0], target[1] - cam.location[1], target[2] - cam.location[2])
    cam.rotation_euler = _look_at(direction)
    bpy.context.scene.camera = cam
    return cam


def _look_at(direction):
    from mathutils import Vector
    v = Vector(direction)
    rot = v.to_track_quat("-Z", "Y").to_euler()
    return rot


def ground(size=8.0, color=(0.10, 0.11, 0.15, 1.0)):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    plane = bpy.context.active_object
    plane.name = "Suelo"
    mat = bpy.data.materials.new("Suelo")
    mat.use_nodes = True
    bsdf = _node(mat.node_tree, "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.9
    plane.data.materials.append(mat)
    return plane


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
