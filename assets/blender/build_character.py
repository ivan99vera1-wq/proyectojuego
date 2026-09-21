"""
=====================================================================
 FASE 2 — ESQUELETO Y EXPORTACIÓN
=====================================================================
 Toma la base preparada por `build_base.py`, le pone esqueleto con
 pesos y la exporta al juego.

     /Applications/Blender.app/Contents/MacOS/Blender --background \
         --python assets/blender/build_character.py

 Entrada:  assets/blender/out/base.blend      (lo crea build_base.py)
 Salidas:  apps/client/public/assets/models/characters/character.glb
           assets/blender/out/character.blend
=====================================================================
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

from lib import rig  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
GLB_DIR = ROOT / "apps/client/public/assets/models/characters"
OUT_DIR = Path(__file__).resolve().parent / "out"
BASE_BLEND = OUT_DIR / "base.blend"


def log(msg):
    print(f"[char] {msg}")


def organize(body, armature):
    """Jerarquía limpia: Character / Body / Armature."""
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for c in list(bpy.context.scene.collection.children):
        bpy.context.scene.collection.children.unlink(c)
    character = bpy.data.collections.new("Character")
    bpy.context.scene.collection.children.link(character)
    for name, obj in (("Body", body), ("Armature", armature)):
        col = bpy.data.collections.new(name)
        character.children.link(col)
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col.objects.link(obj)


def build():
    if not BASE_BLEND.exists():
        raise SystemExit(
            f"Falta {BASE_BLEND}.\nEjecuta antes:\n"
            f"  Blender --background --python assets/blender/build_base.py")
    bpy.ops.wm.open_mainfile(filepath=str(BASE_BLEND))
    body = bpy.data.objects.get("Body")
    if body is None:
        raise SystemExit("La base no tiene el objeto 'Body'")

    armature = rig.build_armature()
    mode = rig.skin([body], armature)
    log(f"cuerpo enlazado al esqueleto con {mode}")

    # Con los pesos ya calculados, se alinean los huesos con los ejes del
    # mundo para que el cliente los rote igual que rotaba sus grupos.
    rig.flatten_orientations(armature)
    organize(body, armature)

    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for poly in obj.data.polygons:
                poly.use_smooth = True
    return {"body": body, "armature": armature}


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
        export_image_format="JPEG",
        export_jpeg_quality=88,
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
    size = (GLB_DIR / "character.glb").stat().st_size / 1024
    print(f"CHARACTER OK {len(body.data.loop_triangles)} triángulos, "
          f"{len(result['armature'].data.bones)} huesos, {size:.0f} KB")
    print(f"GLB -> {GLB_DIR / 'character.glb'}")


if __name__ == "__main__":
    main()
