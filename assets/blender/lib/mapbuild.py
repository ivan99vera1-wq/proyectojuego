"""
Construcción del arte de los mapas a partir de los datos de juego.

Los datos (`data/maps.json`) son las mismas cajas que el servidor usa para las
colisiones. Aquí solo se les da forma: biselado, materiales, cornisas y
adornos. Nunca se mueve ni se redimensiona una caja sólida, porque entonces lo
que se ve dejaría de coincidir con lo que bloquea el paso.

Ejes: los datos vienen en el sistema del juego (Y arriba, -Z adelante) y
Blender usa Z arriba. La conversión es (x, y, z)_juego -> (x, -z, y)_blender,
que es la inversa de la que aplica el exportador de glTF con "+Y up".
"""
import json
import math
import random
from pathlib import Path

import bmesh
import bpy

from . import materials

DATA = Path(__file__).resolve().parent.parent / "data" / "maps.json"


def to_blender(x, y, z):
    """Del sistema del juego (Y arriba) al de Blender (Z arriba)."""
    return (x, -z, y)


def load_layouts():
    with DATA.open() as fh:
        return json.load(fh)


def _bevel(obj, width, segments=2):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = [e for e in bm.edges if e.calc_face_angle(0.0) > 0.6]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=width, segments=segments,
                        profile=0.6, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(obj.data)
    bm.free()


def solid_box(name, box, bevel=0.06):
    """Caja del mapa. Mantiene centro y tamaño exactos: es geometría de juego."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = box["sx"], box["sz"], box["sy"]   # el juego usa Y como altura
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = to_blender(box["x"], box["y"], box["z"])
    # Las rotaciones del juego son sobre sus propios ejes; se traducen igual.
    obj.rotation_euler = (box.get("rx", 0.0), -box.get("rz", 0.0), box.get("ry", 0.0))
    smallest = min(sx, sy, sz)
    _bevel(obj, min(bevel, smallest * 0.24))
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


# ---------------------------------------------------------------- adornos

def _ico(name, radius, loc, flat=True, subdiv=1):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    for poly in obj.data.polygons:
        poly.use_smooth = not flat
    return obj


def _cyl(name, r1, r2, depth, loc, segments=8, smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    for poly in obj.data.polygons:
        poly.use_smooth = smooth
    return obj


def build_prop(prop, index):
    """Adorno sin colisión: árbol, arbusto, roca, nube, farola, globo."""
    kind = prop["kind"]
    s = prop.get("scale", 1.0)
    loc = to_blender(prop["x"], prop.get("y", 0.0), prop["z"])
    rot = prop.get("rot", 0.0)
    pieces = []
    rng = random.Random(index * 7919)

    if kind == "tree":
        trunk = _cyl(f"Tree{index}_Trunk", 0.16 * s, 0.24 * s, 1.7 * s,
                     (loc[0], loc[1], loc[2] + 0.85 * s), segments=7)
        materials.assign(trunk, materials.fixed("Map_Bark", (0.20, 0.12, 0.07, 1.0), roughness=0.95))
        pieces.append(trunk)
        leaf = materials.fixed(f"Map_Leaf_{prop.get('color', '#4e9d4c')}",
                               _hex(prop.get("color", "#4e9d4c")), roughness=0.9)
        for r, dz, dx, dy in ((0.95, 2.2, 0.0, 0.0), (0.68, 2.85, 0.32, -0.2), (0.60, 1.95, -0.5, 0.35)):
            blob = _ico(f"Tree{index}_Leaf", r * s,
                        (loc[0] + dx * s, loc[1] + dy * s, loc[2] + dz * s))
            blob.rotation_euler = (rng.random(), rng.random(), rng.random())
            materials.assign(blob, leaf)
            pieces.append(blob)

    elif kind == "bush":
        mat = materials.fixed("Map_Bush", (0.20, 0.44, 0.19, 1.0), roughness=0.95)
        for r, dx, dy, dz in ((0.50, 0, 0, 0.38), (0.34, 0.42, 0.12, 0.26)):
            blob = _ico(f"Bush{index}", r * s, (loc[0] + dx * s, loc[1] + dy * s, loc[2] + dz * s))
            materials.assign(blob, mat)
            pieces.append(blob)

    elif kind == "rock":
        rock = _ico(f"Rock{index}", 0.55 * s, (loc[0], loc[1], loc[2] + 0.30 * s))
        rock.scale = (1.0, 0.9, 0.66)
        rock.rotation_euler = (0.0, 0.0, rot)
        materials.assign(rock, materials.fixed("Map_Rock", (0.34, 0.37, 0.42, 1.0), roughness=1.0))
        pieces.append(rock)

    elif kind == "cloud":
        mat = materials.fixed("Map_Cloud", (0.96, 0.97, 1.0, 1.0), roughness=1.0)
        for r, dx, dy, dz in ((2.2, 0, 0, 0), (1.6, 2.4, 0.4, -0.3), (1.4, -2.2, -0.3, -0.4), (1.1, 0.8, -0.8, 0.9)):
            puff = _ico(f"Cloud{index}", r * s, (loc[0] + dx * s, loc[1] + dy * s, loc[2] + dz * s))
            puff.scale = (1.0, 1.0, 0.65)
            materials.assign(puff, mat)
            pieces.append(puff)

    elif kind == "lamp":
        post = _cyl(f"Lamp{index}_Post", 0.07 * s, 0.10 * s, 3.2 * s,
                    (loc[0], loc[1], loc[2] + 1.6 * s))
        materials.assign(post, materials.fixed("Map_Metal", (0.16, 0.18, 0.22, 1.0), roughness=0.5, metallic=0.4))
        pieces.append(post)
        bulb_hex = prop.get("color", "#ffd98a")
        bulb = _ico(f"Lamp{index}_Bulb", 0.30 * s, (loc[0], loc[1], loc[2] + 3.3 * s), flat=False, subdiv=2)
        materials.assign(bulb, materials.fixed(f"Map_Bulb_{bulb_hex}", _hex(bulb_hex),
                                               roughness=0.3, emission=_hex(bulb_hex)))
        pieces.append(bulb)

    elif kind == "balloon":
        col = prop.get("color", "#ffd23f")
        body = _ico(f"Balloon{index}", 0.42 * s, (loc[0], loc[1], loc[2] + 2.6 * s), flat=False, subdiv=2)
        body.scale = (1.0, 1.0, 1.25)
        materials.assign(body, materials.fixed(f"Map_Balloon_{col}", _hex(col), roughness=0.3))
        pieces.append(body)
        string = _cyl(f"Balloon{index}_String", 0.012, 0.012, 2.1 * s,
                      (loc[0], loc[1], loc[2] + 1.2 * s), segments=4)
        materials.assign(string, materials.fixed("Map_String", (0.90, 0.92, 0.96, 1.0)))
        pieces.append(string)

    elif kind == "grass":
        mat = materials.fixed("Map_Grass", (0.24, 0.50, 0.20, 1.0), roughness=0.95)
        for i in range(5):
            a = (i / 5.0) * math.tau
            blade = _cyl(f"Grass{index}", 0.05 * s, 0.0, 0.30 * s,
                         (loc[0] + math.cos(a) * 0.05 * s,
                          loc[1] + math.sin(a) * 0.05 * s,
                          loc[2] + 0.15 * s), segments=4)
            blade.rotation_euler = (math.sin(a) * 0.34, -math.cos(a) * 0.34, a)
            materials.assign(blade, mat)
            pieces.append(blade)

    elif kind == "flower":
        stem_mat = materials.fixed("Map_Stem", (0.19, 0.42, 0.16, 1.0), roughness=0.95)
        stem = _cyl(f"Flower{index}_Stem", 0.012 * s, 0.016 * s, 0.20 * s,
                    (loc[0], loc[1], loc[2] + 0.10 * s), segments=4)
        materials.assign(stem, stem_mat)
        pieces.append(stem)
        col = prop.get("color", "#ffe066")
        petal_mat = materials.fixed(f"Map_Petal_{col.lstrip('#')}", _hex(col), roughness=0.8)
        for i in range(5):
            a = (i / 5.0) * math.tau
            petal = _ico(f"Flower{index}_Petal", 0.055 * s,
                         (loc[0] + math.cos(a) * 0.05 * s,
                          loc[1] + math.sin(a) * 0.05 * s,
                          loc[2] + 0.21 * s))
            materials.assign(petal, petal_mat)
            pieces.append(petal)
        heart = _ico(f"Flower{index}_Heart", 0.038 * s, (loc[0], loc[1], loc[2] + 0.225 * s))
        materials.assign(heart, materials.fixed("Map_Petal_heart", _hex("#ffb020"), roughness=0.8))
        pieces.append(heart)

    elif kind == "banner":
        col = prop.get("color", "#ffd23f")
        # La tela es una caja muy fina: basta para leerse colgada del muro.
        mesh_ = bpy.data.meshes.new(f"Banner{index}")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 1.8 * s
            v.co.y *= 0.08
            v.co.z *= 3.2 * s
        bm.to_mesh(mesh_)
        bm.free()
        obj = bpy.data.objects.new(f"Banner{index}", mesh_)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = loc
        materials.assign(obj, materials.fixed(f"Map_Banner_{col.lstrip('#')}", _hex(col), roughness=0.9))
        pieces.append(obj)
        bar = _cyl(f"Banner{index}_Bar", 0.06 * s, 0.06 * s, 2.0 * s,
                   (loc[0], loc[1], loc[2] + 1.6 * s), segments=6)
        bar.rotation_euler = (0.0, math.radians(90), 0.0)
        materials.assign(bar, materials.fixed("Map_BannerBar", (0.85, 0.87, 0.92, 1.0),
                                              roughness=0.5, metallic=0.4))
        pieces.append(bar)

    elif kind == "flag":
        col = prop.get("color", "#ffd23f")
        pole = _cyl(f"Flag{index}_Pole", 0.06 * s, 0.07 * s, 3.4 * s,
                    (loc[0], loc[1], loc[2] + 1.7 * s), segments=7)
        materials.assign(pole, materials.fixed("Map_Pole", (0.88, 0.90, 0.94, 1.0), roughness=0.55))
        pieces.append(pole)

    for p in pieces:
        p.rotation_euler = (p.rotation_euler[0], p.rotation_euler[1], p.rotation_euler[2] + rot)
    return pieces


def _hex(value):
    value = value.lstrip("#")
    r = int(value[0:2], 16) / 255.0
    g = int(value[2:4], 16) / 255.0
    b = int(value[4:6], 16) / 255.0
    # De sRGB a lineal, que es como Blender guarda el color base.
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), 1.0)


def build_map(map_id, layout):
    """Construye el arte completo de un mapa y devuelve sus objetos."""
    objects = []
    mats = {}

    def mat_for(color_hex, solid):
        key = f"{color_hex}|{solid}"
        if key not in mats:
            mats[key] = materials.fixed(
                f"Map_{color_hex.lstrip('#')}{'' if solid else '_flat'}",
                _hex(color_hex), roughness=0.88 if solid else 0.96)
        return mats[key]

    for i, box in enumerate(layout["boxes"]):
        solid = box.get("solid", True) is not False
        name = f"{map_id}_box{i:03d}"
        obj = solid_box(name, box, bevel=0.06 if solid else 0.0)
        materials.assign(obj, mat_for(box.get("color", "#888888"), solid))
        objects.append(obj)

    for i, prop in enumerate(layout.get("props", [])):
        objects.extend(build_prop(prop, i))

    return objects


def join_by_material(objects, prefix):
    """
    Une las mallas que comparten material en una sola. Un mapa son miles de
    cajas y adornos; sin esto el cliente haría miles de llamadas de dibujo por
    fotograma. Al agrupar por material bajan a una por color, que es lo que un
    mapa de este estilo necesita.

    No cambia ni una posición: solo fusiona geometría ya colocada.
    """
    groups = {}
    for obj in objects:
        if obj.type != "MESH" or obj.name not in bpy.data.objects:
            continue
        mats = obj.data.materials
        key = mats[0].name if len(mats) else "_sin_material"
        groups.setdefault(key, []).append(obj)

    merged = []
    for key, group in groups.items():
        if len(group) == 1:
            merged.append(group[0])
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = f"{prefix}_{key}"
        merged.append(joined)
    return merged
