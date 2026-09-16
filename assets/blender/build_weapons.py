"""
Genera todas las armas y las exporta en un solo GLB.

    Blender --background --python assets/blender/build_weapons.py

Salida: apps/client/public/assets/models/weapons/weapons.glb
Cada objeto del GLB se llama como el id del arma en packages/config.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from lib import scene, weapons  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/client/public/assets/models/weapons/weapons.glb"


def main():
    scene.reset()
    built = []
    for name, builder in weapons.BUILDERS.items():
        obj = builder()
        built.append(obj)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT), export_format="GLB", export_apply=True,
        export_yup=True, use_selection=False, export_materials="EXPORT",
        export_cameras=False, export_lights=False,
    )
    print("WEAPONS OK", len(built), [o.name for o in built])


if __name__ == "__main__":
    main()
