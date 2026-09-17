"""
Genera todas las piezas de personalización y las exporta en un solo GLB.

    Blender --background --python assets/blender/build_cosmetics.py

Salida: apps/client/public/assets/models/cosmetics/cosmetics.glb
Cada objeto se llama `<idDelCosmetico>__<Pieza>`.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from lib import cosmetics, scene  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/client/public/assets/models/cosmetics/cosmetics.glb"


def main():
    scene.reset()
    total = 0
    for cosmetic_id, builder in cosmetics.BUILDERS.items():
        pieces = builder()
        total += len(pieces)
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for poly in obj.data.polygons:
                poly.use_smooth = True
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT), export_format="GLB", export_apply=True,
        export_yup=True, use_selection=False, export_materials="EXPORT",
        export_cameras=False, export_lights=False,
    )
    print(f"COSMETICS OK cosmeticos={len(cosmetics.BUILDERS)} piezas={total}")


if __name__ == "__main__":
    main()
