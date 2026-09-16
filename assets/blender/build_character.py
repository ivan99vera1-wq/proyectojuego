"""
Genera el personaje base de TinyStrike y lo exporta a GLB.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python assets/blender/build_character.py

Salida:
    apps/client/public/assets/models/characters/character.glb
    assets/blender/out/character.blend
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

from lib import body, clothing, face, materials, mesh, rig, scene  # noqa: E402
from lib import proportions as P  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
GLB_DIR = ROOT / "apps/client/public/assets/models/characters"
OUT_DIR = Path(__file__).resolve().parent / "out"

# Nivel de subdivisión al exportar. 1 mantiene el personaje por debajo del
# presupuesto de triángulos y ya se ve suave a distancia de juego.
EXPORT_SUBSURF = 1


def collection(name, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col


def move_to(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def build(with_clothes=True, with_hair=True):
    scene.reset()
    skin = materials.recolor("skin", roughness=0.58)

    col_char = collection("Character")
    col_body = collection("Body", col_char)
    col_face = collection("Face", col_char)
    col_cloth = collection("Clothing", col_char)

    # ----------------------------------------------------------- cuerpo
    parts = {}
    head = body.build_head("Head")
    head.location = (0, 0, P.Y_CHIN)
    parts["Head"] = head
    parts["Nose"] = body.build_nose("Nose")
    parts["EarL"] = body.build_ear(-1, "EarL")
    parts["EarR"] = body.build_ear(1, "EarR")
    for tag in ("Nose", "EarL", "EarR"):
        parts[tag].location = (parts[tag].location.x,
                               parts[tag].location.y,
                               parts[tag].location.z + P.Y_CHIN)
    parts["Neck"] = body.build_neck("Neck")
    parts["Torso"] = body.build_torso("Torso")
    for side, tag in ((-1, "L"), (1, "R")):
        parts[f"ArmUpper{tag}"] = body.build_arm_upper(side, f"ArmUpper{tag}")
        parts[f"ArmLower{tag}"] = body.build_arm_lower(side, f"ArmLower{tag}")
        parts[f"Hand{tag}"] = body.build_hand(side, f"Hand{tag}")
        parts[f"LegUpper{tag}"] = body.build_leg_upper(side, f"LegUpper{tag}")
        parts[f"LegLower{tag}"] = body.build_leg_lower(side, f"LegLower{tag}")
        parts[f"Foot{tag}"] = body.build_foot(side, f"Foot{tag}")

    for obj in parts.values():
        materials.assign(obj, skin)
        mesh.add_subsurf(obj, EXPORT_SUBSURF, render=2)
        move_to(obj, col_body)

    bpy.context.view_layer.update()

    # ------------------------------------------------------------ cara
    face_parts = face.build_eyes(head) + face.build_brows(head) + face.build_mouth(head)
    for obj in face_parts:
        obj.location = (obj.location.x, obj.location.y, obj.location.z + P.Y_CHIN)
        mesh.add_subsurf(obj, 1)
        move_to(obj, col_face)

    # ------------------------------------------------------------ ropa
    clothes = []
    if with_clothes:
        clothes += [clothing.build_shirt()]
        clothes += clothing.build_sleeves()
        clothes += clothing.build_vest()
        clothes += clothing.build_pants()
        clothes += clothing.build_boots()
        clothes += clothing.build_gloves()
    if with_hair:
        hair = clothing.build_hair()
        hair.location = (0, 0, P.Y_CHIN)
        clothes.append(hair)
    for obj in clothes:
        mesh.add_subsurf(obj, EXPORT_SUBSURF, render=2)
        move_to(obj, col_cloth)

    # --------------------------------------------------------- esqueleto
    armature = rig.build_armature()
    move_to(armature, col_char)
    rig.bind_rigid(list(parts.values()), armature)

    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for poly in obj.data.polygons:
                poly.use_smooth = True

    return {"parts": parts, "face": face_parts, "clothes": clothes, "armature": armature}


def export_glb(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_apply=True,       # congela subdivisión y simetría
        export_yup=True,         # +Y de Blender pasa a -Z de glTF: el frente del juego
        use_selection=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )


def main():
    build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    export_glb(GLB_DIR / "character.glb")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_DIR / "character.blend"))
    tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects
               if o.type == "MESH" and o.data.loop_triangles is not None)
    print(f"CHARACTER OK  objetos={len([o for o in bpy.data.objects if o.type == 'MESH'])}")
    print(f"GLB -> {GLB_DIR / 'character.glb'}")


if __name__ == "__main__":
    main()
