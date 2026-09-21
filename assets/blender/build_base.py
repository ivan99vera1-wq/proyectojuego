"""
=====================================================================
 FASE 1 — BASE DEL PERSONAJE
=====================================================================
 Prepara el modelo de Sketchfab `caveman_boy.glb` para el juego:

   quita el martillo → simetriza → reduce polígonos → escala y orienta

 EL ARCHIVO ORIGINAL NO SE TOCA. Se abre solo para leerlo y el
 resultado se guarda en otra ruta.

     /Applications/Blender.app/Contents/MacOS/Blender --background \
         --python assets/blender/build_base.py

 Salida: assets/blender/out/base.blend
=====================================================================
"""
import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/source/caveman_boy.glb"
OUT_DIR = Path(__file__).resolve().parent / "out"
WORKING = OUT_DIR / "base.blend"

# --- destino en unidades de juego -----------------------------------
# La altura total es la de la cápsula de colisión (GAMEPLAY.player.capsuleHeight).
TOTAL_HEIGHT = 1.20

# Presupuesto de triángulos del cuerpo. Con diez jugadores en pantalla son
# ~130.000 triángulos de personajes, que junto al mapa deja el fotograma
# holgado incluso en portátiles sin GPU dedicada.
TARGET_TRIS = 13000

# --- medidas del martillo, tomadas sobre una vista ortográfica -------
# Ejes del modelo original: Z es la altura, el personaje mira hacia +X y su
# derecha es -Y (que es donde lleva el martillo).
HAMMER_Y_CUT = -0.150     # nada del personaje está más a su derecha que esto
HANDLE_A = (-0.130, -0.060)   # (y, z) del mango justo por encima del puño
HANDLE_B = (-0.020, -0.430)   # (y, z) de la punta de abajo
HANDLE_R = 0.040


def log(msg):
    print(f"[base] {msg}")


def load_source():
    if not SOURCE.exists():
        raise SystemExit(f"No encuentro el modelo original en {SOURCE}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = "Body"
    obj.data.name = "Body"
    # Las mallas son hijas del nodo que glTF crea para pasar de Y-up a Z-up.
    # Sin soltar ese padre, `transform_apply` deja las coordenadas en el
    # espacio del PADRE y todo lo que se mida después sale desplazado.
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Los nodos vacíos que crea el importador de glTF se quedan en la escena
    # y acaban dentro del archivo exportado. Peor: con ellos presentes el
    # exportador no llega a generar el `skin`.
    for extra in [o for o in bpy.data.objects if o is not obj]:
        bpy.data.objects.remove(extra, do_unlink=True)
    # El modelo viene troceado en nueve mallas por límite de búfer; las
    # costuras impiden detectar regiones conectadas.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.calc_loop_triangles()
    log(f"cargado: {len(obj.data.vertices)} vértices, {len(obj.data.loop_triangles)} triángulos")
    return obj


def vertex_colors(obj):
    """Color de textura de cada vértice, para poder clasificar materiales."""
    me = obj.data
    img = bpy.data.images["Image_0"]
    w, h = img.size
    px = list(img.pixels)          # una sola copia: leerlo por índice es lentísimo
    uv = me.uv_layers.active.data
    out = [None] * len(me.vertices)
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            if out[vi] is None:
                u, v = uv[li].uv
                x = min(w - 1, max(0, int(u % 1.0 * w)))
                y = min(h - 1, max(0, int(v % 1.0 * h)))
                i = (y * w + x) * 4
                out[vi] = (px[i], px[i + 1], px[i + 2])
    return out


def neighbours(me):
    out = [[] for _ in range(len(me.vertices))]
    for e in me.edges:
        a, b = e.vertices
        out[a].append(b)
        out[b].append(a)
    return out


def remove_hammer(obj):
    """
    Quita el martillo de piedra que el personaje lleva en la mano derecha.

    Se hace en tres pasos porque ninguno basta por sí solo:

      1. La CABEZA de piedra se encuentra por color: es la única mancha gris
         grande del modelo (la piel es naranja, el pelo marrón, la cinta
         amarilla). Se coge la región gris conectada más extensa.
      2. Desde ahí se crece hasta la mano. La almohadilla del martillo es
         color piel y queda entre la piedra y el mango, así que la piel se
         admite solo muy cerca de la piedra: más lejos ya es la mano.
      3. El tramo de mango que ATRAVIESA el puño no se alcanza por ahí, y ni
         el color ni un plano lo separan (la madera y la piel comparten rango
         de color, y la mano envuelve el mango). Se quita con un cilindro
         sobre su eje, medido en una vista ortográfica calibrada.
    """
    me = obj.data
    color = vertex_colors(obj)
    neigh = neighbours(me)

    def stone(c):
        return c is not None and (max(c) - min(c)) < 0.055 and 0.045 < max(c) < 0.62

    def skin(c):
        r, g, b = c
        return r > 0.30 and r > b * 1.5 and g > b

    grey = {i for i, c in enumerate(color) if stone(c)}
    seen, best = set(), []
    for s in grey:
        if s in seen:
            continue
        q = deque([s]); seen.add(s); comp = []
        while q:
            v = q.popleft(); comp.append(v)
            for n in neigh[v]:
                if n in grey and n not in seen:
                    seen.add(n); q.append(n)
        if len(comp) > len(best):
            best = comp
    pts = [me.vertices[i].co for i in best]
    center = Vector((sum(p.x for p in pts) / len(pts),
                     sum(p.y for p in pts) / len(pts),
                     sum(p.z for p in pts) / len(pts)))
    log(f"cabeza del martillo: {len(best)} vértices en {tuple(round(v, 3) for v in center)}")

    region = set(best)
    q = deque(best)
    while q:
        v = q.popleft()
        for n in neigh[v]:
            if n in region:
                continue
            d = (me.vertices[n].co - center).length
            if d > 0.42 or (skin(color[n]) and d > 0.15):
                continue
            region.add(n); q.append(n)

    ay, az = HANDLE_A
    by, bz = HANDLE_B
    dy, dz = by - ay, bz - az
    den = dy * dy + dz * dz
    for i, v in enumerate(me.vertices):
        if i in region:
            continue
        co = v.co
        if co.y < HAMMER_Y_CUT:
            region.add(i); continue
        t = max(0.0, min(1.0, ((co.y - ay) * dy + (co.z - az) * dz) / den))
        py, pz = ay + dy * t, az + dz * t
        if (co.y - py) ** 2 + (co.z - pz) ** 2 <= HANDLE_R ** 2:
            region.add(i)

    # Al quitar el mango quedan anillos sueltos entre los dedos: el personaje
    # es una única malla enorme, así que cualquier trozo suelto es basura.
    rest = [i for i in range(len(me.vertices)) if i not in region]
    restset = set(rest)
    seen2, comps = set(), []
    for s in rest:
        if s in seen2:
            continue
        q = deque([s]); seen2.add(s); comp = []
        while q:
            v = q.popleft(); comp.append(v)
            for n in neigh[v]:
                if n in restset and n not in seen2:
                    seen2.add(n); q.append(n)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    for c in comps[1:]:
        if len(c) < 20000:
            region.update(c)

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in region], context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    me.calc_loop_triangles()
    log(f"martillo fuera: quedan {len(me.vertices)} vértices, {len(me.loop_triangles)} triángulos")
    return obj


def symmetrise(obj):
    """
    Deja el personaje simétrico a partir de su lado bueno.

    Al quitar el martillo se va con él la mano derecha, porque los dedos
    envuelven el mango y no hay forma de separarlos. En vez de reconstruir
    esa mano a mano, se corta el modelo por su plano de simetría y se refleja
    el lado intacto (el izquierdo, que no tocaba el martillo).

    De paso el personaje queda perfectamente simétrico, que es justo lo que
    conviene para colocar un esqueleto y animarlo.
    """
    me = obj.data
    # El plano de simetría se mide en los PIES: están lejos del martillo y de
    # la melena, que son las dos zonas asimétricas del modelo.
    feet = [v.co.y for v in me.vertices if v.co.z < -0.42]
    y0 = (min(feet) + max(feet)) / 2 if feet else 0.0
    log(f"plano de simetría en y={y0:+.4f}")

    bm = bmesh.new()
    bm.from_mesh(me)
    # Cortar por el plano y quedarse con el lado del brazo intacto (+Y).
    bmesh.ops.bisect_plane(
        bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-6,
        plane_co=Vector((0.0, y0, 0.0)), plane_no=Vector((0.0, 1.0, 0.0)),
        clear_inner=True, clear_outer=False,
    )
    bm.to_mesh(me)
    bm.free()
    me.update()

    # Espejar. El modificador Mirror refleja sobre el origen del objeto, así
    # que primero se lleva el plano de simetría al origen.
    me.transform(Matrix.Translation((0.0, -y0, 0.0)))
    mod = obj.modifiers.new("Simetría", "MIRROR")
    mod.use_axis = (False, True, False)
    mod.use_clip = True
    mod.merge_threshold = 0.0015
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    me.transform(Matrix.Translation((0.0, y0, 0.0)))

    me.calc_loop_triangles()
    log(f"simetrizado: {len(me.vertices)} vértices, {len(me.loop_triangles)} triángulos")
    return obj


def normalise(obj):
    """
    Deja el personaje en las coordenadas que espera el juego:
      * de pie sobre z = 0, centrado en x = 0 y en y = 0,
      * mirando hacia +Y de Blender, que al exportar a glTF con "+Y up" se
        convierte en -Z, la dirección de avance del juego,
      * con la altura exacta de la cápsula de colisión.

    El modelo original mira hacia +X, así que hay que girarlo un cuarto de
    vuelta.
    """
    me = obj.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    height = max(zs) - min(zs)
    scale = TOTAL_HEIGHT / height
    log(f"original: altura={height:.4f}, centro x={(min(xs)+max(xs))/2:+.4f} y={(min(ys)+max(ys))/2:+.4f}")

    m = (Matrix.Scale(scale, 4)
         @ Matrix.Rotation(1.5707963267948966, 4, "Z")
         @ Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))))
    me.transform(m)
    me.update()

    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    log(f"normalizado: alto={max(zs) - min(zs):.4f} (suelo z={min(zs):.4f}) "
        f"ancho={max(xs) - min(xs):.4f} fondo={max(ys) - min(ys):.4f}")
    return obj


def fit_budget(obj):
    """Reduce hasta el presupuesto de triángulos."""
    obj.data.calc_loop_triangles()
    tris = len(obj.data.loop_triangles)
    if tris <= TARGET_TRIS:
        log(f"triángulos={tris}, ya cabe en el presupuesto")
        return obj
    mod = obj.modifiers.new("Reducir", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = TARGET_TRIS / tris
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.calc_loop_triangles()
    log(f"triángulos {tris} -> {len(obj.data.loop_triangles)}")
    return obj


def shrink_texture(size=1024):
    """
    La textura original es de 4096x4096 y pesa casi todo el archivo. A 1024
    el personaje se ve igual a distancia de juego y el GLB baja de 30 MB a
    poco más de uno.
    """
    img = bpy.data.images.get("Image_0")
    if img is None:
        return
    before = img.size[0]
    img.scale(size, size)
    img.pack()
    log(f"textura {before}px -> {img.size[0]}px")


def repair(obj):
    """
    Deja la malla en condiciones de que Blender pueda calcular pesos por
    calor. Ese método necesita una superficie cerrada y coherente; con
    agujeros o normales invertidas no falla con un error, simplemente
    devuelve todos los pesos a cero.

    El modelo viene de una herramienta generativa y además le hemos abierto
    un boquete al quitar el martillo, así que hay trabajo que hacer.
    """
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0004)
    bpy.ops.mesh.delete_loose()
    bpy.ops.mesh.fill_holes(sides=0)          # 0 = de cualquier tamaño
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.calc_loop_triangles()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    abiertos = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    bm.free()
    log(f"reparada: {len(obj.data.vertices)} vértices, "
        f"{len(obj.data.loop_triangles)} triángulos, {abiertos} aristas de borde")
    return obj


def main():
    if WORKING.resolve() == SOURCE.resolve():
        raise SystemExit("ABORTADO: escribiría encima del modelo original")
    obj = load_source()
    remove_hammer(obj)
    symmetrise(obj)
    normalise(obj)
    fit_budget(obj)
    shrink_texture()

    repair(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORKING))
    obj.data.calc_loop_triangles()
    print(f"BASE OK triángulos={len(obj.data.loop_triangles)} vértices={len(obj.data.vertices)}")
    print(f"-> {WORKING}")


if __name__ == "__main__":
    main()
