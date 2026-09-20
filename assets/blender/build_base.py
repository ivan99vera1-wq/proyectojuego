"""
=====================================================================
 FASE 1 — BASE MASCULINA DEL PERSONAJE
=====================================================================
 Parte del modelo de Sketchfab "Chibi Base Mesh Character (Male)" y lo
 deja listo para el juego: escala, orientación, origen, presupuesto de
 polígonos y jerarquía ordenada.

 EL ARCHIVO ORIGINAL NO SE TOCA. Se abre solo para leerlo y el
 resultado se guarda en otra ruta. El script aborta si alguna vez
 intentara escribir encima del original.

     /Applications/Blender.app/Contents/MacOS/Blender --background \
         --python assets/blender/build_base.py

 Salida: assets/blender/out/base_male.blend   (copia de trabajo)
=====================================================================
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/source/Chibi Base Mesh Character.blend"
OUT_DIR = Path(__file__).resolve().parent / "out"
WORKING = OUT_DIR / "base_male.blend"

BODY_OBJECT = "Chibi Base Mesh Male Character"

# --- destino en unidades de juego -----------------------------------
# La altura total es la de la cápsula de colisión (GAMEPLAY.player.capsuleHeight).
TOTAL_HEIGHT = 1.20

# Presupuesto de triángulos del cuerpo. Con 10 jugadores en pantalla esto son
# ~70.000 triángulos de personajes, que junto a los ~32.000 del mapa deja el
# fotograma holgado incluso en portátiles sin GPU dedicada.
TARGET_TRIS = 7000

# Nivel de subdivisión ANTES de reducir. 1 basta: el modelo ya trae una malla
# de control densa y subir a 2 solo da trabajo al decimador.
SUBSURF_LEVEL = 1

# --- medidas leídas del modelo original (fracción de la altura) ------
# Salen de medir el modelo por rebanadas horizontales: el cuello es el punto
# más estrecho entre la cabeza y los hombros, la rodilla y el tobillo son los
# mínimos locales de la pierna. Las usa la fase 2 para colocar el esqueleto.
SOURCE_FRACTIONS = {
    "ankle": 0.067,
    "knee": 0.200,
    "hip": 0.289,
    "chin": 0.600,
    "crown": 1.000,
}


def log(msg):
    print(f"[base] {msg}")


def open_source_readonly():
    if not SOURCE.exists():
        raise SystemExit(f"No encuentro el modelo original en {SOURCE}")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    log(f"abierto (solo lectura) {SOURCE.name}")


def strip_scene(keep):
    """Deja únicamente el objeto que interesa: fuera cámaras, luces y vacíos."""
    for obj in list(bpy.data.objects):
        if obj.name != keep:
            bpy.data.objects.remove(obj, do_unlink=True)


def apply_modifiers(obj):
    """Congela Mirror y Subdivisión: el juego necesita geometría real."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        if mod.type == "SUBSURF":
            mod.levels = SUBSURF_LEVEL
            mod.render_levels = SUBSURF_LEVEL
        bpy.ops.object.modifier_apply(modifier=mod.name)
    log(f"modificadores aplicados: {len(obj.data.vertices)} vértices")


def bake_transform(obj):
    """Mete la escala y la rotación del objeto dentro de la malla."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def band_center_y(mesh, lo, hi, frac_a, frac_b):
    """Centro en Y de una franja de altura, para saber dónde está el tronco."""
    h = hi - lo
    ys = [v.co.y for v in mesh.vertices if lo + h * frac_a <= v.co.z < lo + h * frac_b]
    return sum(ys) / len(ys) if ys else 0.0


def normalize(obj):
    """
    Deja el personaje en las coordenadas que espera el juego:
      * de pie sobre z = 0, centrado en x = 0 y en y = 0 (el tronco),
      * mirando hacia +Y de Blender, que al exportar a glTF con "+Y up"
        se convierte en -Z, la dirección de avance del juego,
      * con la altura exacta de la cápsula de colisión.
    """
    mesh = obj.data
    zs = [v.co.z for v in mesh.vertices]
    xs = [v.co.x for v in mesh.vertices]
    lo, hi = min(zs), max(zs)
    height = hi - lo
    cx = (min(xs) + max(xs)) / 2
    # El tronco (cadera y pecho) marca el eje; los pies y la cabeza se salen.
    cy = band_center_y(mesh, lo, hi, 0.28, 0.58)
    log(f"original: altura={height:.4f}  centro x={cx:.4f} y={cy:.4f}")

    scale = TOTAL_HEIGHT / height
    # El modelo de Sketchfab mira hacia -Y: los dedos de los pies apuntan a -Y
    # y el occipucio a +Y. Media vuelta sobre Z lo pone mirando a +Y.
    m = (
        Matrix.Scale(scale, 4)
        @ Matrix.Rotation(3.141592653589793, 4, "Z")
        @ Matrix.Translation((-cx, -cy, -lo))
    )
    mesh.transform(m)
    mesh.update()

    zs = [v.co.z for v in mesh.vertices]
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    log(f"normalizado: altura={max(zs) - min(zs):.4f} (suelo z={min(zs):.4f})"
        f"  ancho={max(xs) - min(xs):.4f}  fondo={max(ys) - min(ys):.4f}")
    return scale


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def fit_budget(obj):
    """Reduce hasta el presupuesto de triángulos, si hace falta."""
    tris = triangle_count(obj)
    if tris <= TARGET_TRIS:
        log(f"triángulos={tris}, ya cabe en el presupuesto ({TARGET_TRIS})")
        return
    mod = obj.modifiers.new("Reducir", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = TARGET_TRIS / tris
    mod.use_collapse_triangulate = False
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    log(f"triángulos {tris} -> {triangle_count(obj)} (objetivo {TARGET_TRIS})")


def clean_mesh(obj):
    """Suelda vértices dobles del espejo y recalcula normales hacia fuera."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    for poly in obj.data.polygons:
        poly.use_smooth = True


def organize(obj):
    """
    Jerarquía pedida: Character / Body / Head / Clothes / Shoes /
    Accessories / Armature. Las colecciones vacías se crean ya para que las
    fases siguientes tengan dónde dejar cada cosa.
    """
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for c in list(bpy.context.scene.collection.children):
        bpy.context.scene.collection.children.unlink(c)

    character = bpy.data.collections.new("Character")
    bpy.context.scene.collection.children.link(character)
    made = {}
    for name in ("Body", "Head", "Hair", "Clothes", "Shoes", "Accessories", "Armature"):
        col = bpy.data.collections.new(name)
        character.children.link(col)
        made[name] = col

    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    made["Body"].objects.link(obj)
    return made


def main():
    open_source_readonly()
    if WORKING.resolve() == SOURCE.resolve():
        raise SystemExit("ABORTADO: escribiría encima del modelo original")

    body = bpy.data.objects.get(BODY_OBJECT)
    if body is None:
        raise SystemExit(f"No encuentro el objeto {BODY_OBJECT!r} en el original")

    strip_scene(BODY_OBJECT)
    bpy.ops.object.select_all(action="DESELECT")
    apply_modifiers(body)
    bake_transform(body)
    normalize(body)
    clean_mesh(body)
    fit_budget(body)

    body.name = "Body"
    body.data.name = "Body"
    # Los materiales del original son de dibujo (contornos, tramas) y no pasan
    # a glTF. La piel la pone el juego con el contrato `Recolor_skin`.
    body.data.materials.clear()
    organize(body)

    uv = ", ".join(layer.name for layer in body.data.uv_layers) or "SIN UV"
    log(f"UV: {uv}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORKING))
    log(f"copia de trabajo -> {WORKING}")
    print(f"BASE OK triángulos={triangle_count(body)} vértices={len(body.data.vertices)}")


if __name__ == "__main__":
    main()
