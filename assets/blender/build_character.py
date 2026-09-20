"""
=====================================================================
 FASES 2 y 3 — PROPORCIONES, CARA Y ESQUELETO
=====================================================================
 Toma la base masculina normalizada por `build_base.py`, le añade los
 rasgos de la cara, la enlaza a un esqueleto con pesos y la exporta.

 A diferencia del modelo anterior (piezas rígidas colgadas de huecos),
 ESTE personaje es una malla con skin: hombros, codos, rodillas y cuello
 se deforman de verdad al animarse.

     /Applications/Blender.app/Contents/MacOS/Blender --background \
         --python assets/blender/build_character.py

 Entrada:  assets/blender/out/base_male.blend   (lo crea build_base.py)
 Salidas:  apps/client/public/assets/models/characters/character.glb
           assets/blender/out/character.blend
=====================================================================
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

from lib import face, materials, rig, shape  # noqa: E402
from lib import proportions as P  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
GLB_DIR = ROOT / "apps/client/public/assets/models/characters"
OUT_DIR = Path(__file__).resolve().parent / "out"
BASE_BLEND = OUT_DIR / "base_male.blend"


def log(msg):
    print(f"[char] {msg}")


def collection(name, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col


def move_to(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def organize():
    """Character / Body / Head / Hair / Clothes / Shoes / Accessories / Armature."""
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for c in list(bpy.context.scene.collection.children):
        bpy.context.scene.collection.children.unlink(c)
    character = collection("Character")
    return {name: collection(name, character) for name in
            ("Body", "Head", "Hair", "Clothes", "Shoes", "Accessories", "Armature")}


def build():
    if not BASE_BLEND.exists():
        raise SystemExit(
            f"Falta {BASE_BLEND}.\nEjecuta antes:\n"
            f"  Blender --background --python assets/blender/build_base.py")
    bpy.ops.wm.open_mainfile(filepath=str(BASE_BLEND))
    body = bpy.data.objects.get("Body")
    if body is None:
        raise SystemExit("La copia de trabajo no tiene el objeto 'Body'")

    cols = organize()
    move_to(body, cols["Body"])
    materials.assign(body, materials.recolor("skin", roughness=0.62))
    # Retoques de forma ANTES de enlazar el esqueleto: deformar la malla
    # después dejaría los pesos sin sentido.
    shape.masculine_pass(body.data)
    bpy.context.view_layer.update()

    # ------------------------------------------------------------- cara
    # Los rasgos se apoyan en la superficie REAL del cráneo lanzando rayos,
    # así que siguen el modelo base aunque cambie su forma.
    face_parts = (face.build_eyes(body) + face.build_brows(body)
                  + face.build_mouth(body) + face.build_nose(body))
    for obj in face_parts:
        obj.location = (obj.location.x, obj.location.y, obj.location.z + P.Y_CHIN)
        move_to(obj, cols["Head"])
    log(f"cara: {len(face_parts)} piezas")

    # --------------------------------------------------------- esqueleto
    armature = rig.build_armature()
    move_to(armature, cols["Armature"])
    mode = rig.skin([body], armature)
    log(f"cuerpo enlazado al esqueleto con {mode}")
    # Los rasgos de la cara son rígidos: van al hueso de la cabeza al 100 %.
    rig.parent_rigid(face_parts, armature, "head")

    # Y ahora, con los pesos ya calculados, se alinean los huesos con los ejes
    # del mundo para que el cliente los rote igual que rotaba sus grupos.
    rig.flatten_orientations(armature)

    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for poly in obj.data.polygons:
                poly.use_smooth = True

    return {"body": body, "face": face_parts, "armature": armature}


def export_glb(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_apply=False,      # con skin NO se pueden aplicar modificadores
        export_yup=True,         # +Y de Blender -> -Z de glTF: el frente del juego
        export_skins=True,
        export_animations=True,
        export_def_bones=False,
        use_selection=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )


def main():
    result = build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    export_glb(GLB_DIR / "character.glb")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_DIR / "character.blend"))
    body = result["body"]
    body.data.calc_loop_triangles()
    tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects
               if o.type == "MESH" and (o.data.calc_loop_triangles() or True))
    print(f"CHARACTER OK cuerpo={len(body.data.loop_triangles)} tris  total={tris} tris  "
          f"huesos={len(result['armature'].data.bones)}")
    print(f"GLB -> {GLB_DIR / 'character.glb'}")


if __name__ == "__main__":
    main()
