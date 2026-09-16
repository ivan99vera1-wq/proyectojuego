"""
Hoja de personaje: vistas ortogonales, tres cuartos, detalle de cara y
silueta en negro. Es la comprobación visual del modelo.

    Blender --background --python assets/blender/render_sheet.py -- <carpeta>
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from build_character import build  # noqa: E402
from lib import scene  # noqa: E402
from lib import proportions as P  # noqa: E402

VIEWS = [
    ("frontal", 0.0, 0.05, 2.35, (0, 0, 0.58)),
    ("lateral", 1.5708, 0.05, 2.35, (0, 0, 0.58)),
    ("trasera", 3.1416, 0.05, 2.35, (0, 0, 0.58)),
    ("tresq", 0.72, 0.09, 2.30, (0, 0, 0.58)),
    ("busto", 0.55, 0.06, 1.05, (0, 0, 0.92)),
    ("cara", 0.10, 0.03, 0.72, (0, 0, P.Y_CHIN + P.HEAD_H * 0.42)),
]


def silhouette():
    """Todo en negro sobre fondo claro: la prueba de silueta."""
    black = bpy.data.materials.new("Silueta")
    black.use_nodes = True
    bsdf = black.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(black)
        elif obj.type == "LIGHT":
            obj.data.energy = 0.0
    world = bpy.context.scene.world
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.95, 0.98, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(args[0] if args else "/tmp")
    out.mkdir(parents=True, exist_ok=True)

    build()
    scene.studio_lights()
    scene.ground()
    for name, yaw, pitch, dist, target in VIEWS:
        scene.camera("Cam", target=target, distance=dist, yaw=yaw, pitch=pitch, lens=62)
        scene.render(str(out / f"char-{name}.png"))

    silhouette()
    for name, yaw in (("frontal", 0.0), ("lateral", 1.5708)):
        scene.camera("Cam", target=(0, 0, 0.58), distance=2.35, yaw=yaw, pitch=0.04, lens=62)
        scene.render(str(out / f"sil-{name}.png"))
    print("SHEET OK")


if __name__ == "__main__":
    main()
