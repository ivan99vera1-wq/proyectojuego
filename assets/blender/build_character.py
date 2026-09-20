"""
=====================================================================
 PERSONAJE COMPLETO: CUERPO, CARA Y GUARDARROPA EN UN SOLO GLB
=====================================================================
 Toma la base masculina normalizada por `build_base.py`, la esculpe,
 le pone cara, esqueleto y ropa, y lo exporta TODO junto.

 Por qué un solo archivo y no uno por cosmético: la ropa está enlazada
 al MISMO esqueleto que el cuerpo. Si cada prenda viviera en su propio
 GLB habría que reenlazarla al esqueleto del jugador en tiempo de
 ejecución, con el riesgo de que el orden de los huesos no coincida.
 Con un único archivo el cliente solo tiene que quedarse con las piezas
 que el jugador lleva puestas y tirar el resto.

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

from lib import face, materials, rig, shape, wardrobe  # noqa: E402
from lib import proportions as P  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
GLB_DIR = ROOT / "apps/client/public/assets/models/characters"
OUT_DIR = Path(__file__).resolve().parent / "out"
BASE_BLEND = OUT_DIR / "base_male.blend"

# Variantes de cara. Son pocas a propósito: mejor tres bien hechas que doce
# a medias. Cada una sale de la misma construcción con otros parámetros.
EYE_VARIANTS = [("eyes_round", "round"), ("eyes_sharp", "sharp"), ("eyes_calm", "calm")]
BROW_VARIANTS = [("brows_straight", "straight"), ("brows_angry", "angry"), ("brows_calm", "calm")]
MOUTH_VARIANTS = [("mouth_smile", "smile"), ("mouth_neutral", "neutral"), ("mouth_smirk", "smirk")]


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


def collection_for(name):
    """A qué colección va cada cosmético, solo para tener el .blend ordenado."""
    if name.startswith("hair_"):
        return "Hair"
    if name.startswith("shoes_"):
        return "Shoes"
    if name.startswith(("headwear_", "eyewear_", "headacc_", "back_", "hands_")):
        return "Accessories"
    if name.startswith(("top_", "outer_", "bottom_")):
        return "Clothes"
    return "Head"


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
    # Los retoques de forma van ANTES de calcular los pesos: deformar la malla
    # después los dejaría sin sentido.
    shape.masculine_pass(body.data)
    bpy.context.view_layer.update()

    # ------------------------------------------------------------- cara
    face_parts = []
    for cosmetic_id, style in EYE_VARIANTS:
        face_parts += face.build_eyes(body, style=style, prefix=f"{cosmetic_id}__")
    for cosmetic_id, style in BROW_VARIANTS:
        face_parts += face.build_brows(body, style=style, prefix=f"{cosmetic_id}__")
    for cosmetic_id, style in MOUTH_VARIANTS:
        face_parts += face.build_mouth(body, style=style, prefix=f"{cosmetic_id}__")
    face_parts += face.build_nose(body)
    for obj in face_parts:
        obj.location = (obj.location.x, obj.location.y, obj.location.z + P.Y_CHIN)
        move_to(obj, cols["Head"])
    log(f"cara: {len(face_parts)} piezas "
        f"({len(EYE_VARIANTS)} ojos, {len(BROW_VARIANTS)} cejas, {len(MOUTH_VARIANTS)} bocas)")

    # --------------------------------------------------------- esqueleto
    armature = rig.build_armature()
    move_to(armature, cols["Armature"])
    mode = rig.skin([body], armature)
    log(f"cuerpo enlazado al esqueleto con {mode}")
    rig.parent_rigid(face_parts, armature, "head")

    # -------------------------------------------------------- guardarropa
    # Se construye DESPUÉS de enlazar el cuerpo: las prendas ajustadas se
    # derivan de su malla y heredan sus grupos de vértices.
    made = wardrobe.build_all(body)
    for obj, rigid_bone in made:
        move_to(obj, cols[collection_for(obj.name)])
        if rigid_bone:
            rig.parent_rigid([obj], armature, rigid_bone)
        else:
            obj.parent = armature
            obj.matrix_parent_inverse = armature.matrix_world.inverted()
            mod = obj.modifiers.new("Armature", "ARMATURE")
            mod.object = armature
    log(f"guardarropa: {len(made)} piezas")

    # Y ahora, con todos los pesos ya calculados, se alinean los huesos con
    # los ejes del mundo para que el cliente los rote igual que sus grupos.
    rig.flatten_orientations(armature)

    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for poly in obj.data.polygons:
                poly.use_smooth = True

    return {"body": body, "face": face_parts, "wardrobe": made, "armature": armature}


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
    tris = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            tris += len(obj.data.loop_triangles)
    result["body"].data.calc_loop_triangles()
    print(f"CHARACTER OK cuerpo={len(result['body'].data.loop_triangles)} tris  "
          f"total={tris} tris  huesos={len(result['armature'].data.bones)}  "
          f"cosmeticos={len(result['wardrobe'])}")
    print(f"GLB -> {GLB_DIR / 'character.glb'}")


if __name__ == "__main__":
    main()
