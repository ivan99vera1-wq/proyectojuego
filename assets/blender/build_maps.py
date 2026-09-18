"""
Genera el arte de los mapas en Blender a partir de los datos del juego.

    npx tsx tools/export-map-layouts.ts          # vuelca los datos
    Blender --background --python assets/blender/build_maps.py

Salida: apps/client/public/assets/maps/<id>.glb
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from lib import mapbuild, scene  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/client/public/assets/maps"


def main():
    layouts = mapbuild.load_layouts()
    OUT.mkdir(parents=True, exist_ok=True)
    for map_id, layout in layouts.items():
        scene.reset()
        objects = mapbuild.build_map(map_id, layout)
        # Miles de cajas sueltas serían miles de llamadas de dibujo:
        # se fusionan por material antes de exportar.
        objects = mapbuild.join_by_material(objects, map_id)
        bpy.ops.export_scene.gltf(
            filepath=str(OUT / f"{map_id}.glb"), export_format="GLB",
            export_apply=True, export_yup=True, use_selection=False,
            export_materials="EXPORT", export_cameras=False, export_lights=False,
        )
        tris = sum(len(o.data.polygons) for o in objects)
        print(f"MAP OK {map_id} mallas={len(objects)} caras={tris}")


if __name__ == "__main__":
    main()
