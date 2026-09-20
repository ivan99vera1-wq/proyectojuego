"""
=====================================================================
 GUARDARROPA
=====================================================================
 La ropa NO se modela "a ojo" al lado del cuerpo. Cada prenda ajustada
 se DERIVA de la propia malla del personaje: se copia la región que
 cubre y se separa un poco por su normal.

 Eso resuelve de raíz los dos problemas que tenía el sistema anterior:

   * el ajuste es exacto, porque la prenda ES la superficie del cuerpo
     desplazada, así que no puede quedar flotando ni encajarse dentro;
   * el peso también es exacto, porque la copia se lleva los grupos de
     vértices del cuerpo y se deforma EXACTAMENTE igual que él. Una
     manga nunca se puede separar del brazo al doblar el codo.

 Las piezas con volumen propio (chaleco, gorra, mochila, botas) sí se
 modelan aparte, y entonces se les transfieren los pesos del cuerpo.

 Convención de nombres: cada objeto se llama `<idDelCosmetico>__<Pieza>`.
 El cliente usa el prefijo para saber qué mostrar y qué quitar.
=====================================================================
"""
import math

import bmesh
import bpy
from mathutils import Vector

from . import materials
from . import proportions as P
from .mesh import Ring, new_object, rings_to_mesh

# --- paleta táctica, tomada de la imagen de referencia ---------------
NAVY = (0.035, 0.042, 0.060, 1.0)
NAVY_SOFT = (0.060, 0.070, 0.095, 1.0)
CREAM = (0.640, 0.600, 0.520, 1.0)
BLACK = (0.018, 0.020, 0.026, 1.0)
GREY = (0.180, 0.200, 0.235, 1.0)
SOLE = (0.780, 0.780, 0.760, 1.0)
STRAP = (0.090, 0.095, 0.110, 1.0)
METAL = (0.300, 0.290, 0.240, 1.0)


# ============================================================ utilidades

def _bone_of(body, vert_index, groups):
    """Hueso con más peso en un vértice."""
    best, best_w = None, -1.0
    for g in body.data.vertices[vert_index].groups:
        if g.weight > best_w:
            best_w, best = g.weight, groups[g.group]
    return best


def derive(body, name, bones=None, z_range=None, keep=None, offset=0.010,
           inflate_xy=0.0, min_offset=0.0):
    """
    Copia la región del cuerpo indicada y la separa por su normal.

    `bones` selecciona por el hueso que más pesa en cada vértice, que es mucho
    más fiable que recortar por coordenadas: el brazo y el torso se solapan en
    X a la altura del hombro.
    """
    groups = {i: g.name for i, g in enumerate(body.vertex_groups)}
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    # La copia no debe arrastrar el modificador de esqueleto del cuerpo: se le
    # pone uno nuevo al enlazarla.
    for mod in list(obj.modifiers):
        obj.modifiers.remove(mod)

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()

    # 1. Filtrar por hueso y por la condición libre. Va PRIMERO porque usa los
    #    índices originales de la malla del cuerpo: en cuanto se corta el mesh
    #    esos índices dejan de valer.
    if bones is not None or keep is not None:
        doomed = []
        for v in bm.verts:
            ok = True
            if bones is not None:
                ok = _bone_of(body, v.index, groups) in bones
            if ok and keep is not None:
                ok = keep(v.co)
            if not ok:
                doomed.append(v)
        bmesh.ops.delete(bm, geom=doomed, context="VERTS")

    # 2. Cortar en altura con un PLANO, no borrando vértices. Borrar deja un
    #    borde en dientes de sierra (era el aspecto "roto" de los bajos del
    #    pantalón); el plano deja un dobladillo recto.
    if z_range is not None and bm.verts:
        for z, lower in ((z_range[0], True), (z_range[1], False)):
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            if not geom:
                break
            bmesh.ops.bisect_plane(
                bm, geom=geom, dist=1e-5,
                plane_co=Vector((0.0, 0.0, z)), plane_no=Vector((0.0, 0.0, 1.0)),
                clear_inner=lower, clear_outer=not lower,
            )

    if not bm.verts:
        bm.free()
        bpy.data.objects.remove(obj, do_unlink=True)
        return None
    bm.normal_update()

    # 3. Desvanecer el grosor hacia el borde para que la prenda "nazca" de la
    #    piel en vez de acabar en un canto flotante.
    #
    #    `min_offset` es hasta dónde puede adelgazar: una prenda EXTERIOR no
    #    puede llegar a cero, porque en el borde se metería por debajo de la
    #    interior y la camiseta asomaría en manchas por el chaleco.
    fade = _border_fade(bm, rings=2)
    for v in bm.verts:
        k = fade[v.index]
        thickness = min_offset + (offset - min_offset) * k
        if thickness <= 0.0:
            continue
        n = v.normal.copy()
        if inflate_xy:
            flat = Vector((v.co.x, v.co.y, 0.0))
            if flat.length > 1e-6:
                n += flat.normalized() * inflate_xy
        if n.length < 1e-6:
            continue
        v.co += n.normalized() * thickness
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def _border_fade(bm, rings=2):
    """
    Factor de grosor por vértice: 0 justo en el borde abierto y 1 a `rings`
    aristas de distancia. Es lo que convierte un corte en un dobladillo.
    """
    bm.verts.ensure_lookup_table()
    fade = [1.0] * len(bm.verts)
    frontier = {v.index for v in bm.verts if any(len(e.link_faces) < 2 for e in v.link_edges)}
    level = {i: 0 for i in frontier}
    current = frontier
    for step in range(1, rings + 1):
        nxt = set()
        for i in current:
            for e in bm.verts[i].link_edges:
                other = e.other_vert(bm.verts[i]).index
                if other not in level:
                    level[other] = step
                    nxt.add(other)
        current = nxt
    for i, step in level.items():
        fade[i] = step / (rings + 1.0)
    return fade


def front_y(obj, x, z, start=3.0):
    """
    Altura Y de la superficie DELANTERA de una pieza en (x, z).

    Colocar una bolsa del chaleco "a ojo" con una fracción del ancho del pecho
    la deja flotando o hundida en cuanto cambia la forma. Lanzando un rayo
    contra la prenda ya construida, el detalle se apoya siempre donde toca.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    origin = Vector((x - obj.location.x, start, z - obj.location.z))
    hit, loc, _nor, _idx = ev.ray_cast(origin, Vector((0.0, -1.0, 0.0)))
    return None if not hit else loc.y + obj.location.y


def back_y(obj, x, z, start=-3.0):
    """Igual que `front_y` pero por detrás (la espalda del personaje)."""
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    origin = Vector((x - obj.location.x, start, z - obj.location.z))
    hit, loc, _nor, _idx = ev.ray_cast(origin, Vector((0.0, 1.0, 0.0)))
    return None if not hit else loc.y + obj.location.y


def side_x(obj, y, z, side, start=3.0):
    """Superficie lateral en (y, z) para el lado indicado (-1 izq, +1 der)."""
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    origin = Vector((side * start - obj.location.x, y - obj.location.y, z - obj.location.z))
    hit, loc, _nor, _idx = ev.ray_cast(origin, Vector((-side, 0.0, 0.0)))
    return None if not hit else loc.x + obj.location.x


def radial_hit(obj, center, angle, clearance=0.0, plane_y=0.0, reach=0.8):
    """
    Punto de la superficie en la dirección `angle` del plano XZ, medido con un
    rayo desde fuera hacia el centro.

    Colocar una diadema sobre una elipse calculada "de memoria" la mete dentro
    del cráneo en unos sitios y la saca en otros, porque la cabeza no es una
    elipse perfecta. Con un rayo contra la malla real siempre queda apoyada.
    """
    d = Vector((math.cos(angle), 0.0, math.sin(angle)))
    origin = Vector((center[0], plane_y, center[1])) + d * reach
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    local = origin - obj.location
    hit, loc, _nor, _idx = ev.ray_cast(local, -d)
    if not hit:
        return None
    world = Vector(loc) + obj.location
    return world + d * clearance


def sweep(name, points, half_y, half_t):
    """
    Barre una sección rectangular a lo largo de una polilínea del plano XZ.
    Una diadema hecha con cajas sueltas se ve como un peine; barrida es una
    cinta continua.
    """
    if len(points) < 2:
        return None
    verts, faces = [], []
    ring_starts = []
    for i, pt in enumerate(points):
        nxt = points[min(i + 1, len(points) - 1)]
        prv = points[max(i - 1, 0)]
        tangent = Vector((nxt.x - prv.x, 0.0, nxt.z - prv.z))
        if tangent.length < 1e-9:
            tangent = Vector((1.0, 0.0, 0.0))
        tangent.normalize()
        # Perpendicular a la cinta dentro del plano XZ.
        perp = Vector((-tangent.z, 0.0, tangent.x))
        ring_starts.append(len(verts))
        for sy, st in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            v = Vector(pt) + Vector((0.0, sy * half_y, 0.0)) + perp * (st * half_t)
            verts.append((v.x, v.y, v.z))
    for i in range(len(points) - 1):
        a, b = ring_starts[i], ring_starts[i + 1]
        for k in range(4):
            j = (k + 1) % 4
            faces.append((a + k, a + j, b + j, b + k))
    faces.append((ring_starts[0] + 3, ring_starts[0] + 2, ring_starts[0] + 1, ring_starts[0]))
    last = ring_starts[-1]
    faces.append((last, last + 1, last + 2, last + 3))
    obj = new_object(name, verts, faces)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def arc_hit(obj, center_yz, angle, clearance=0.0, plane_x=0.0, reach=0.8):
    """
    Como `radial_hit` pero en el plano YZ (de delante, por arriba, hacia
    atrás) a una X fija. Es el plano por el que pasa una correa de hombro:
    del pecho, sobre el deltoides, a la espalda.

    Hace falta distinguirlo del plano XZ porque un rayo vertical lanzado
    cerca del eje del cuerpo golpea la CABEZA, no el hombro, y la correa
    acababa subiendo hasta la coronilla.
    """
    d = Vector((0.0, math.cos(angle), math.sin(angle)))
    origin = Vector((plane_x, center_yz[0], center_yz[1])) + d * reach
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    hit, loc, _nor, _idx = ev.ray_cast(origin - obj.location, -d)
    if not hit:
        return None
    return Vector(loc) + obj.location + d * clearance


def sweep_yz(name, points, half_x, half_t):
    """Barre una sección rectangular por una polilínea del plano YZ."""
    if len(points) < 2:
        return None
    verts, faces = [], []
    starts = []
    for i, pt in enumerate(points):
        nxt = points[min(i + 1, len(points) - 1)]
        prv = points[max(i - 1, 0)]
        tangent = Vector((0.0, nxt.y - prv.y, nxt.z - prv.z))
        if tangent.length < 1e-9:
            tangent = Vector((0.0, 1.0, 0.0))
        tangent.normalize()
        perp = Vector((0.0, -tangent.z, tangent.y))
        starts.append(len(verts))
        for sx, st in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            v = Vector(pt) + Vector((sx * half_x, 0.0, 0.0)) + perp * (st * half_t)
            verts.append((v.x, v.y, v.z))
    for i in range(len(points) - 1):
        a, b = starts[i], starts[i + 1]
        for k in range(4):
            j = (k + 1) % 4
            faces.append((a + k, a + j, b + j, b + k))
    faces.append((starts[0] + 3, starts[0] + 2, starts[0] + 1, starts[0]))
    last = starts[-1]
    faces.append((last, last + 1, last + 2, last + 3))
    obj = new_object(name, verts, faces)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def transfer_weights(body, obj):
    """
    Copia los pesos del cuerpo a una pieza modelada aparte. Sin esto, un
    chaleco no sabría doblarse con la cintura.
    """
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.data_transfer(
        data_type="VGROUP_WEIGHTS", use_create=True,
        vert_mapping="POLYINTERP_NEAREST",
        layers_select_src="ALL", layers_select_dst="NAME",
    )
    bpy.ops.object.select_all(action="DESELECT")
    return obj


def shell(name, rings, segments=16, cap_bottom=True, cap_top=True):
    verts, faces = rings_to_mesh(rings, segments=segments,
                                 cap_bottom=cap_bottom, cap_top=cap_top)
    obj = new_object(name, verts, faces)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def box(name, w, d, h, loc, rot=(0.0, 0.0, 0.0), bevel=0.006):
    """Caja redondeada: la forma base de bolsillos, hebillas y placas."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= d
        v.co.z *= h
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=bevel,
                        segments=2, profile=0.7, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def join(objects, name):
    """Une varias piezas en una sola malla (menos llamadas de dibujo)."""
    objects = [o for o in objects if o is not None]
    if not objects:
        return None
    if len(objects) == 1:
        objects[0].name = name
        objects[0].data.name = name
        return objects[0]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    out = bpy.context.view_layer.objects.active
    out.name = name
    out.data.name = name
    bpy.ops.object.select_all(action="DESELECT")
    return out


def bake_transforms(objects):
    """Mete la transformación del objeto en la malla (obligatorio con skin)."""
    for obj in objects:
        if obj is None:
            continue
        obj.data.transform(obj.matrix_basis)
        obj.data.update()
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = (0.0, 0.0, 0.0)
        obj.scale = (1.0, 1.0, 1.0)


# ============================================================ constructores
#
# Cada constructor recibe el cuerpo ya enlazado al esqueleto y devuelve las
# piezas del cosmético. Las prendas ajustadas se derivan del cuerpo; las que
# tienen volumen propio se modelan y luego reciben los pesos por transferencia.

# Separación de cada capa respecto a la piel, en metros. Es lo que evita que
# una prenda exterior quede DENTRO de la interior: el chaleco tiene que estar
# claramente por fuera de la sudadera, no a un milímetro.
LAYER = {
    "skin": 0.000,
    "inner": 0.011,     # camiseta, sudadera
    "outer": 0.030,     # chaleco, chaqueta
    "legs": 0.012,
    "hands": 0.007,
    "shoe": 0.012,
    "sole": 0.019,
}

TORSO_BONES = {"hips", "spine", "chest"}
ARM_BONES = {"shoulder.L", "shoulder.R", "upperarm.L", "upperarm.R"}
FOREARM_BONES = {"forearm.L", "forearm.R"}
LEG_BONES = {"thigh.L", "thigh.R", "shin.L", "shin.R"}
HAND_BONES = {"hand.L", "hand.R"}
FOOT_BONES = {"foot.L", "foot.R", "toe.L", "toe.R"}
HEAD_BONES = {"head"}


def _mat(channel_or_rgba, name=None, roughness=0.75, metallic=0.0):
    if isinstance(channel_or_rgba, str):
        return materials.recolor(channel_or_rgba, roughness=roughness, metallic=metallic)
    return materials.fixed(name, channel_or_rgba, roughness=roughness, metallic=metallic)


# ------------------------------------------------------------------ camisetas

def top_tee(body):
    """Camiseta de manga corta, ceñida al cuerpo."""
    torso = derive(body, "_fresh_tee", bones=TORSO_BONES | ARM_BONES,
                   z_range=(P.Y_HIP - 0.035, P.Y_NECK + 0.012), offset=LAYER["inner"])
    return [torso] if torso else []


def top_hoodie(body):
    """
    Sudadera: cubre torso y brazos hasta la muñeca, con capucha caída en la
    nuca y puños. Es la prenda clara de la referencia.
    """
    shellobj = derive(body, "_fresh_hoodie",
                      bones=TORSO_BONES | ARM_BONES | FOREARM_BONES,
                      z_range=(P.Y_HIP - 0.055, P.Y_NECK + 0.020), offset=LAYER["inner"])
    pieces = [shellobj]
    # Capucha caída: bulto detrás del cuello (+Y de Blender es el frente, así
    # que la nuca está en -Y).
    hood = shell("_fresh_hood", [
        Ring(0.000, P.SHOULDER_W * 0.62, P.SHOULDER_W * 0.34, n=2.6),
        Ring(0.045, P.SHOULDER_W * 0.70, P.SHOULDER_W * 0.42, n=2.5),
        Ring(0.090, P.SHOULDER_W * 0.58, P.SHOULDER_W * 0.36, n=2.6),
    ], segments=14)
    hood.location = (0.0, -P.CHEST_W * 0.62, P.Y_NECK - 0.045)
    pieces.append(hood)
    # Cuello alto.
    collar = shell("_fresh_hcollar", [
        Ring(0.000, P.SHOULDER_W * 0.46, P.SHOULDER_W * 0.40, n=3.0),
        Ring(0.038, P.SHOULDER_W * 0.48, P.SHOULDER_W * 0.42, n=3.0),
    ], segments=14, cap_bottom=False, cap_top=False)
    collar.location = (0.0, 0.0, P.Y_NECK - 0.010)
    pieces.append(collar)
    return pieces


# ------------------------------------------------------------- chaleco táctico

def outer_vest(body):
    """
    Chaleco táctico: la pieza que más define la silueta. Placas de pecho y
    espalda con bolsas, hombreras y cinchas.

    Los detalles se apoyan lanzando un rayo contra la propia coraza, no con
    fracciones del ancho del pecho: así ni flotan ni se hunden.
    """
    # Solo el tronco: es un porta-placas, no un abrigo. Dejar los deltoides
    # fuera es lo que permite ver la prenda interior en los hombros, como en
    # la referencia. Los hombros los cruzan dos correas, más abajo.
    # Se incluyen las clavículas (no los deltoides): así la placa llega hasta
    # el alto del pecho y de la espalda, pero el hombro sigue enseñando la
    # prenda interior.
    base = derive(body, "_fresh_vest", bones=TORSO_BONES | {"shoulder.L", "shoulder.R"},
                  z_range=(P.Y_HIP + 0.014, P.Y_NECK - 0.014),
                  offset=LAYER["outer"], inflate_xy=0.008,
                  min_offset=LAYER["inner"] + 0.004)
    if base is None:
        return []
    bpy.context.view_layer.update()
    pieces = [base]

    def on_front(name, w, d, h, x, z, rot=(0.0, 0.0, 0.0)):
        y = front_y(base, x, z)
        if y is None:
            return None
        return box(name, w, d, h, (x, y + d * 0.55, z), rot=rot)

    def on_back(name, w, d, h, x, z):
        y = back_y(base, x, z)
        if y is None:
            return None
        return box(name, w, d, h, (x, y - d * 0.55, z))

    # Bolsas del pecho.
    for side, tag in ((-1, "L"), (1, "R")):
        pieces.append(on_front(f"_fresh_pouch{tag}", P.CHEST_W * 0.30, 0.018, 0.044,
                               side * P.CHEST_W * 0.44, P.Y_CHEST + 0.008))
    # Bolsa central baja y radio.
    pieces.append(on_front("_fresh_pouchC", P.CHEST_W * 0.32, 0.020, 0.030,
                           0.0, P.Y_WAIST + 0.024))
    pieces.append(on_front("_fresh_radio", 0.020, 0.014, 0.040,
                           P.CHEST_W * 0.62, P.Y_CHEST + 0.048))
    # Bolsa trasera.
    pieces.append(on_back("_fresh_pack", P.CHEST_W * 0.58, 0.020, 0.052,
                          0.0, P.Y_CHEST - 0.010))
    # Cinchas horizontales delante y detrás.
    for z in (P.Y_CHEST + 0.046, P.Y_WAIST + 0.006):
        pieces.append(on_front("_fresh_web", P.CHEST_W * 0.88, 0.008, 0.009, 0.0, z))
        pieces.append(on_back("_fresh_webb", P.CHEST_W * 0.80, 0.008, 0.009, 0.0, z))
    # Correas de hombro: son la superficie del propio hombro engordada, igual
    # que el resto de prendas. Lanzar rayos para colocarlas era frágil, porque
    # cerca del eje del cuerpo el rayo golpea la cabeza y la correa subía hasta
    # la coronilla.
    for side, tag in ((-1, "L"), (1, "R")):
        lo, hi = P.SHOULDER_X * 0.34, P.SHOULDER_X * 0.88

        def band(co, side=side, lo=lo, hi=hi):
            return lo <= co.x * side <= hi and co.z >= P.Y_SHOULDER - 0.045

        strap = derive(body, f"_fresh_strap{tag}",
                       bones=TORSO_BONES | ARM_BONES, keep=band,
                       offset=LAYER["outer"] + 0.006,
                       min_offset=LAYER["outer"] + 0.002)
        if strap is not None:
            pieces.append(strap)
    return pieces


def outer_jacket(body):
    """Chaqueta abierta: cuerpo y mangas completas, cuello y solapa."""
    base = derive(body, "_fresh_jacket",
                  bones=TORSO_BONES | ARM_BONES | FOREARM_BONES,
                  z_range=(P.Y_HIP - 0.075, P.Y_NECK + 0.010),
                  offset=LAYER["outer"] * 0.8, min_offset=LAYER["inner"] + 0.004)
    pieces = [base]
    collar = shell("_fresh_jcollar", [
        Ring(0.000, P.SHOULDER_W * 0.52, P.SHOULDER_W * 0.46, n=2.8),
        Ring(0.050, P.SHOULDER_W * 0.60, P.SHOULDER_W * 0.54, n=2.8),
    ], segments=14, cap_bottom=False, cap_top=False)
    collar.location = (0.0, 0.0, P.Y_NECK - 0.014)
    pieces.append(collar)
    # Cremallera central.
    pieces.append(box("_fresh_zip", 0.008, 0.008, P.TORSO_H * 0.78,
                      (0.0, P.CHEST_W * 0.86, P.Y_HIP + P.TORSO_H * 0.46)))
    return pieces


# ------------------------------------------------------------------ pantalones

def bottom_cargo(body):
    """Pantalón cargo: bolsillos de muslo y rodilleras, apoyados en la tela."""
    base = derive(body, "_fresh_cargo", bones=LEG_BONES | {"hips", "spine"},
                  z_range=(P.Y_ANKLE + 0.030, P.Y_HIP + 0.056),
                  offset=LAYER["legs"], inflate_xy=0.006)
    if base is None:
        return []
    bpy.context.view_layer.update()
    pieces = [base]
    for side, tag in ((-1, "L"), (1, "R")):
        # Bolsillo lateral del muslo.
        thigh_z = P.Y_HIP - P.THIGH * 0.46
        x = side_x(base, 0.004, thigh_z, side)
        if x is not None:
            pieces.append(box(f"_fresh_cpock{tag}", 0.012, P.THIGH_R * 0.78, P.THIGH * 0.26,
                              (x + side * 0.006, 0.004, thigh_z)))
        # Rodillera por delante de la rodilla.
        y = front_y(base, side * P.KNEE_X, P.Y_KNEE + 0.010)
        if y is not None:
            pieces.append(box(f"_fresh_knee{tag}", P.THIGH_R * 0.86, 0.014, 0.042,
                              (side * P.KNEE_X, y + 0.006, P.Y_KNEE + 0.010)))
    belt = shell("_fresh_belt", [
        Ring(0.000, P.WAIST_W + 0.018, P.WAIST_W * 0.88 + 0.016, n=3.6),
        Ring(0.022, P.WAIST_W + 0.020, P.WAIST_W * 0.88 + 0.018, n=3.6),
    ], segments=16, cap_bottom=False, cap_top=False)
    belt.location = (0.0, 0.0, P.Y_HIP + 0.030)
    pieces.append(belt)
    yb = front_y(base, 0.0, P.Y_HIP + 0.040)
    if yb is not None:
        pieces.append(box("_fresh_buckle", 0.024, 0.009, 0.017, (0.0, yb + 0.008, P.Y_HIP + 0.040)))
    return pieces


def bottom_jeans(body):
    """Vaquero ceñido, con cinturón fino."""
    base = derive(body, "_fresh_jeans", bones=LEG_BONES | {"hips", "spine"},
                  z_range=(P.Y_ANKLE + 0.034, P.Y_HIP + 0.052), offset=LAYER["legs"] * 0.75)
    if base is None:
        return []
    pieces = [base]
    belt = shell("_fresh_jbelt", [
        Ring(0.000, P.WAIST_W + 0.014, P.WAIST_W * 0.88 + 0.012, n=3.6),
        Ring(0.016, P.WAIST_W + 0.016, P.WAIST_W * 0.88 + 0.014, n=3.6),
    ], segments=16, cap_bottom=False, cap_top=False)
    belt.location = (0.0, 0.0, P.Y_HIP + 0.026)
    pieces.append(belt)
    return pieces


# --------------------------------------------------------------------- manos

def hands_gloves(body):
    """Guantes tácticos: la mano engordada, con puño y placa de nudillos."""
    base = derive(body, "_fresh_glove", bones=HAND_BONES, offset=LAYER["hands"],
                  inflate_xy=0.002)
    if base is None:
        return []
    bpy.context.view_layer.update()
    pieces = [base]
    for side, tag in ((-1, "L"), (1, "R")):
        cuff = shell(f"_fresh_cuff{tag}", [
            Ring(0.000, P.ARM_R * 1.16, P.ARM_R * 1.02, n=3.2),
            Ring(0.024, P.ARM_R * 1.24, P.ARM_R * 1.08, n=3.2),
            Ring(0.040, P.ARM_R * 1.06, P.ARM_R * 0.94, n=3.2),
        ], segments=12)
        cuff.location = (side * P.WRIST_X, 0.0, P.Y_WRIST - 0.004)
        pieces.append(cuff)
    return pieces


# ------------------------------------------------------------------- zapatos

def _shoe_base(body, name, offset, top_z):
    """La forma del zapato ES el pie del modelo, engordado. Así nunca asoma."""
    return derive(body, name, bones=FOOT_BONES | {"shin.L", "shin.R"},
                  z_range=(-0.02, top_z), offset=offset, inflate_xy=0.004)


def shoes_sneakers(body):
    """Zapatilla gruesa de suela clara, como la de la referencia."""
    base = _shoe_base(body, "_fresh_snk", LAYER["shoe"], P.Y_ANKLE + 0.030)
    if base is None:
        return []
    bpy.context.view_layer.update()
    pieces = [base]
    for side, tag in ((-1, "L"), (1, "R")):
        # Caña baja por encima del tobillo.
        cuff = shell(f"_fresh_snkcuff{tag}", [
            Ring(0.000, P.THIGH_R * 0.62, P.THIGH_R * 0.66, n=3.0),
            Ring(0.026, P.THIGH_R * 0.58, P.THIGH_R * 0.62, n=3.0),
        ], segments=12, cap_top=False)
        cuff.location = (side * P.ANKLE_X, 0.004, P.Y_ANKLE + 0.008)
        pieces.append(cuff)
    return pieces


def shoes_sneakers_sole(body):
    """Suela clara: pieza aparte porque lleva su propio material."""
    base = derive(body, "_fresh_sole", bones=FOOT_BONES,
                  z_range=(-0.02, 0.016), offset=LAYER["sole"],
                  min_offset=LAYER["shoe"] + 0.003)
    return [base] if base else []


def shoes_boots(body):
    """Bota táctica: como la zapatilla pero con caña sobre el tobillo."""
    base = _shoe_base(body, "_fresh_boot", LAYER["shoe"], P.Y_ANKLE + 0.024)
    if base is None:
        return []
    bpy.context.view_layer.update()
    pieces = [base]
    for side, tag in ((-1, "L"), (1, "R")):
        shaft = shell(f"_fresh_shaft{tag}", [
            Ring(0.000, P.THIGH_R * 0.70, P.THIGH_R * 0.74, n=3.0),
            Ring(0.048, P.THIGH_R * 0.66, P.THIGH_R * 0.70, n=3.0),
            Ring(0.064, P.THIGH_R * 0.60, P.THIGH_R * 0.64, n=3.0),
        ], segments=12, cap_top=False)
        shaft.location = (side * P.ANKLE_X, 0.003, P.Y_ANKLE + 0.004)
        pieces.append(shaft)
        # Cordonera.
        pieces.append(box(f"_fresh_lace{tag}", P.THIGH_R * 0.50, 0.010, 0.030,
                          (side * P.ANKLE_X, P.THIGH_R * 0.62, P.Y_ANKLE + 0.016)))
    return pieces


# --------------------------------------------------------------------- pelo

def _hair_cap(body, name, top, keep_front=False, offset=0.011, hairline=0.58):
    """
    Casquete derivado del cráneo: se ajusta a la cabeza sea cual sea su forma.

    Hay que descartar dos zonas a mano: la CARA (o el pelo taparía los ojos) y
    las OREJAS, que forman parte de la malla de la cabeza y saldrían cubiertas
    de pelo como dos bultos.
    """
    def keep(co):
        z_rel = (co.z - P.Y_CHIN) / P.HEAD_H
        if keep_front:
            # Un gorro se apoya sobre la cabeza entera; no hay que recortarle
            # nada, y el corte de orejas le dejaría dos muescas en los lados.
            return True
        if abs(co.x) > P.HEAD_W * 0.86 and 0.20 < z_rel < 0.54:
            return False                      # oreja
        return not (co.y > P.HEAD_D * 0.26 and z_rel < hairline)
    return derive(body, name, bones=HEAD_BONES,
                  z_range=(P.Y_CHIN + P.HEAD_H * top, P.Y_CROWN + 0.02),
                  keep=keep, offset=offset)


def _lock(name, azimuth, z_top, length, width, thick, tilt):
    """Mechón: prisma que nace en el cráneo y acaba en punta."""
    W, D = P.HEAD_W, P.HEAD_D
    rings = [
        Ring(0.0, width, thick, n=3.2),
        Ring(-length * 0.36, width * 0.94, thick * 1.02, n=3.0),
        Ring(-length * 0.72, width * 0.62, thick * 0.80, n=3.0),
        Ring(-length, width * 0.10, thick * 0.12, n=3.0),
    ]
    verts, faces = rings_to_mesh(rings, segments=8)
    ct, st = math.cos(tilt), math.sin(tilt)
    ca, sa = math.cos(-azimuth), math.sin(-azimuth)
    ox, oy = math.sin(azimuth) * W * 0.95, math.cos(azimuth) * D * 0.95
    out = []
    for (x, y, z) in verts:
        y2, z2 = y * ct - z * st, y * st + z * ct
        out.append((x * ca - y2 * sa + ox, x * sa + y2 * ca + oy, z2 + z_top))
    obj = new_object(name, out, faces)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def hair_short(body):
    """
    Corte militar corto: el de la referencia.

    Devuelve DOS partes. El casquete va pegado al cráneo y cabe bajo cualquier
    gorro; los mechones dan silueta pero atravesarían una gorra, así que el
    cliente los oculta cuando el jugador lleva algo en la cabeza.
    """
    cap = _hair_cap(body, "_fresh_hairs", 0.30, offset=0.009, hairline=0.56)
    locks = []
    for i in range(7):
        f = (i / 6.0) * 2.0 - 1.0
        locks.append(_lock(f"_fresh_slock{i}", f * 1.15,
                           P.Y_CHIN + P.HEAD_H * 0.615, P.HEAD_H * 0.125,
                           P.HEAD_W * 0.25, P.HEAD_D * 0.055, 0.62))
    return {"Cap": [cap], "Locks": locks}


def hair_spiky(body):
    """Puntas: mechones largos hacia arriba y flequillo en pico."""
    cap = _hair_cap(body, "_fresh_hairp", 0.32, offset=0.013, hairline=0.58)
    pieces = [cap]
    for i in range(7):
        f = (i / 6.0) * 2.0 - 1.0
        pieces.append(_lock(f"_fresh_plock{i}", f * 1.25,
                            P.Y_CHIN + P.HEAD_H * 0.74,
                            P.HEAD_H * (0.22 if i % 2 == 0 else 0.16),
                            P.HEAD_W * 0.21, P.HEAD_D * 0.075, 0.16))
    for side in (-1, 1):
        pieces.append(_lock(f"_fresh_psb{side}", side * 1.60,
                            P.Y_CHIN + P.HEAD_H * 0.66, P.HEAD_H * 0.20,
                            P.HEAD_W * 0.13, P.HEAD_D * 0.070, 0.06))
    return pieces


def hair_ponytail(body):
    """Recogido: casquete liso y coleta en la nuca."""
    cap = _hair_cap(body, "_fresh_hairt", 0.26, offset=0.013, hairline=0.60)
    pieces = [cap]
    tail = shell("_fresh_tail", [
        Ring(0.000, P.HEAD_W * 0.15, P.HEAD_D * 0.15, n=2.6),
        Ring(-P.HEAD_H * 0.16, P.HEAD_W * 0.22, P.HEAD_D * 0.22, n=2.5),
        Ring(-P.HEAD_H * 0.34, P.HEAD_W * 0.17, P.HEAD_D * 0.17, n=2.6),
        Ring(-P.HEAD_H * 0.46, P.HEAD_W * 0.05, P.HEAD_D * 0.05, n=2.8),
    ], segments=12)
    tail.location = (0.0, -P.HEAD_D * 0.92, P.Y_CHIN + P.HEAD_H * 0.62)
    tail.rotation_euler = (0.42, 0.0, 0.0)
    pieces.append(tail)
    for side in (-1, 1):
        pieces.append(_lock(f"_fresh_tsb{side}", side * 1.55,
                            P.Y_CHIN + P.HEAD_H * 0.58, P.HEAD_H * 0.16,
                            P.HEAD_W * 0.11, P.HEAD_D * 0.060, 0.05))
    return {"Cap": [cap], "Locks": pieces}


# --------------------------------------------------------------- cabeza

def headwear_cap(body):
    """
    Gorra táctica: casquete de perfil bajo y visera ancha inclinada hacia
    abajo. Es la prenda que más identifica al personaje de la referencia.
    """
    crown = _hair_cap(body, "_fresh_cap", 0.545, keep_front=True, offset=0.020)
    if crown is None:
        return []
    pieces = [crown]
    # Visera: placa ancha y plana. El personaje mira hacia +Y, así que la
    # visera va en +Y; girando sobre X en negativo, la punta baja.
    brim = box("_fresh_brim", P.HEAD_W * 0.94, P.HEAD_D * 0.62, 0.011,
               (0.0, P.HEAD_D * 0.86, P.Y_CHIN + P.HEAD_H * 0.545),
               rot=(-0.26, 0.0, 0.0), bevel=0.010)
    pieces.append(brim)
    # Refuerzo frontal de la visera (solo delante: un aro completo alrededor
    # de la cabeza convierte la gorra en casco).
    front = box("_fresh_capfront", P.HEAD_W * 0.80, 0.014, 0.026,
                (0.0, P.HEAD_D * 0.74, P.Y_CHIN + P.HEAD_H * 0.545), bevel=0.006)
    pieces.append(front)
    # Botón de la coronilla.
    pieces.append(box("_fresh_capbtn", 0.016, 0.016, 0.010,
                      (0.0, -P.HEAD_D * 0.04, P.Y_CROWN - 0.004), bevel=0.005))
    return pieces


def headwear_beanie(body):
    """Gorro de punto, con el borde vuelto."""
    crown = _hair_cap(body, "_fresh_beanie", 0.50, keep_front=True, offset=0.022)
    pieces = [crown]
    brim = shell("_fresh_bbrim", [
        Ring(0.000, P.HEAD_W * 1.02, P.HEAD_D * 1.02, n=2.6),
        Ring(0.034, P.HEAD_W * 1.05, P.HEAD_D * 1.05, n=2.6),
        Ring(0.058, P.HEAD_W * 1.00, P.HEAD_D * 1.00, n=2.6),
    ], segments=18, cap_bottom=False, cap_top=False)
    brim.location = (0.0, 0.0, P.Y_CHIN + P.HEAD_H * 0.58)
    pieces.append(brim)
    return pieces


def headwear_helmet(body):
    """Casco táctico con raíles laterales."""
    crown = _hair_cap(body, "_fresh_helm", 0.47, keep_front=True, offset=0.028)
    pieces = [crown]
    for side, tag in ((-1, "L"), (1, "R")):
        pieces.append(box(f"_fresh_rail{tag}", 0.010, P.HEAD_D * 0.70, 0.016,
                          (side * P.HEAD_W * 1.00, -P.HEAD_D * 0.05,
                           P.Y_CHIN + P.HEAD_H * 0.74)))
    # Soporte frontal para visión nocturna.
    pieces.append(box("_fresh_nvg", 0.030, 0.026, 0.020,
                      (0.0, P.HEAD_D * 0.94, P.Y_CHIN + P.HEAD_H * 0.80)))
    return pieces


def eyewear_goggles(body):
    """Gafas tácticas sobre los ojos, con correa alrededor de la cabeza."""
    pieces = []
    z = P.Y_CHIN + P.HEAD_H * 0.32
    for side, tag in ((-1, "L"), (1, "R")):
        lens = shell(f"_fresh_lens{tag}", [
            Ring(0.000, P.HEAD_W * 0.26, 0.016, n=3.2),
            Ring(0.018, P.HEAD_W * 0.24, 0.015, n=3.2),
        ], segments=14)
        lens.location = (side * P.HEAD_W * 0.36, P.HEAD_D * 0.80, z)
        lens.rotation_euler = (math.radians(90), 0.0, -side * 0.34)
        pieces.append(lens)
    bridge = box("_fresh_bridge", P.HEAD_W * 0.18, 0.016, 0.018,
                 (0.0, P.HEAD_D * 0.84, z))
    pieces.append(bridge)
    # Correa: anillo alrededor de la cabeza a la altura de los ojos, apoyado
    # en la superficie real y barrido como una cinta.
    ring = []
    for i in range(25):
        a = (i / 24.0) * math.tau
        d = Vector((math.sin(a), math.cos(a), 0.0))
        origin = Vector((0.0, 0.0, z)) + d * 0.8
        deps = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(deps)
        hit, loc, _n, _i = ev.ray_cast(origin - body.location, -d)
        if hit:
            ring.append(Vector(loc) + body.location + d * 0.010)
    if len(ring) > 2:
        verts, faces = [], []
        for i, pt in enumerate(ring):
            nxt = ring[(i + 1) % len(ring)]
            prv = ring[i - 1]
            t = (nxt - prv)
            t.z = 0.0
            if t.length < 1e-9:
                t = Vector((1.0, 0.0, 0.0))
            t.normalize()
            base = len(verts)
            for dz in (-0.011, 0.011):
                for dn in (-0.007, 0.007):
                    n = Vector((-t.y, t.x, 0.0)) * dn
                    verts.append((pt.x + n.x, pt.y + n.y, pt.z + dz))
            del base
        n = len(ring)
        for i in range(n):
            a, b = i * 4, ((i + 1) % n) * 4
            for k, j in ((0, 1), (1, 3), (3, 2), (2, 0)):
                faces.append((a + k, a + j, b + j, b + k))
        strap = new_object("_fresh_gstrap", verts, faces)
        for poly in strap.data.polygons:
            poly.use_smooth = False
        pieces.append(strap)
    return pieces


def headacc_headset(body):
    """
    Auriculares de diadema. La banda se apoya en la superficie REAL del cráneo
    con holgura suficiente para pasar por encima de una gorra.
    """
    pieces = []
    z = P.Y_CHIN + P.HEAD_H * 0.36
    plane_y = -P.HEAD_D * 0.06
    for side, tag in ((-1, "L"), (1, "R")):
        cup = shell(f"_fresh_cup{tag}", [
            Ring(0.000, P.HEAD_H * 0.15, P.HEAD_D * 0.30, n=3.2),
            Ring(0.020, P.HEAD_H * 0.16, P.HEAD_D * 0.32, n=3.2),
            Ring(0.034, P.HEAD_H * 0.13, P.HEAD_D * 0.26, n=3.2),
        ], segments=14)
        cup.location = (side * P.HEAD_W * 1.02, plane_y, z)
        cup.rotation_euler = (0.0, side * math.radians(90), 0.0)
        pieces.append(cup)

    # Arco de oreja a oreja pasando por la coronilla, barrido como una cinta
    # continua. La holgura tiene que dejar pasar una gorra por debajo.
    center = (0.0, P.Y_CHIN + P.HEAD_H * 0.50)
    path = []
    for i in range(25):
        t = math.pi * (i / 24.0)
        # La holgura es la justa para pasar por encima de una gorra (que
        # sobresale 0,020 del cráneo) sin quedar flotando en el aire.
        point = radial_hit(body, center, t, clearance=0.032, plane_y=plane_y)
        if point is not None:
            path.append(point)
    band = sweep("_fresh_band", path, half_y=0.013, half_t=0.010)
    if band is not None:
        pieces.append(band)

    # Micrófono hacia delante desde el casco derecho.
    pieces.append(box("_fresh_mic", 0.010, P.HEAD_D * 0.62, 0.010,
                      (P.HEAD_W * 0.88, P.HEAD_D * 0.32, z - 0.032),
                      rot=(0.0, 0.0, -0.36)))
    return pieces


# ------------------------------------------------------------------ mochila

def back_backpack(body):
    """
    Mochila pequeña. VA EN LA ESPALDA: en Blender el personaje mira hacia +Y,
    así que la espalda es -Y. Colocarla en +Y la pone sobre el pecho, que es
    justo el error que tenía el sistema anterior.
    """
    pieces = []
    body_pack = shell("_fresh_pack", [
        Ring(0.000, P.CHEST_W * 0.70, 0.052, n=3.6),
        Ring(0.055, P.CHEST_W * 0.78, 0.060, n=3.6),
        Ring(0.115, P.CHEST_W * 0.72, 0.054, n=3.6),
    ], segments=14)
    body_pack.location = (0.0, -(P.CHEST_W * 0.70 + 0.052), P.Y_CHEST - 0.030)
    pieces.append(body_pack)
    # Tapa y correas de hombro (pasan por delante del pecho).
    pieces.append(box("_fresh_flap", P.CHEST_W * 0.62, 0.052, 0.022,
                      (0.0, -(P.CHEST_W * 0.70 + 0.056), P.Y_CHEST + 0.058)))
    for side, tag in ((-1, "L"), (1, "R")):
        pieces.append(box(f"_fresh_bstrap{tag}", 0.018, 0.012, P.TORSO_H * 0.52,
                          (side * P.CHEST_W * 0.52, P.CHEST_W * 0.66,
                           P.Y_CHEST - 0.020), rot=(0.16, 0.0, 0.0)))
    return pieces


# ============================================================== catálogo
#
# (id, constructor, material, hueso rígido o None).
# Un "hueso rígido" significa que la pieza NO se deforma: se cuelga entera de
# ese hueso. Es lo correcto para un casco o unas gafas, que son sólidos.

ITEMS = [
    ("top_tee", top_tee, ("secondary", 0.86), None),
    ("top_hoodie", top_hoodie, ("secondary", 0.90), None),
    ("outer_vest", outer_vest, ("primary", 0.82), None),
    ("outer_jacket", outer_jacket, ("primary", 0.80), None),
    ("bottom_cargo", bottom_cargo, ("primary", 0.88), None),
    ("bottom_jeans", bottom_jeans, ("primary", 0.84), None),
    ("hands_gloves", hands_gloves, (BLACK, "Glove", 0.62), None),
    ("shoes_sneakers", shoes_sneakers, (NAVY_SOFT, "Sneaker", 0.68), None),
    ("shoes_boots", shoes_boots, (BLACK, "Boot", 0.66), None),
    ("hair_short", hair_short, ("hair", 0.70), "head"),
    ("hair_spiky", hair_spiky, ("hair", 0.70), "head"),
    ("hair_ponytail", hair_ponytail, ("hair", 0.70), "head"),
    ("headwear_cap", headwear_cap, ("primary", 0.74), "head"),
    ("headwear_beanie", headwear_beanie, ("secondary", 0.92), "head"),
    ("headwear_helmet", headwear_helmet, ("primary", 0.62), "head"),
    ("eyewear_goggles", eyewear_goggles, (GREY, "Goggles", 0.30), "head"),
    ("headacc_headset", headacc_headset, (BLACK, "Headset", 0.55), "head"),
    ("back_backpack", back_backpack, ("primary", 0.86), "chest"),
]


def _weight(body, obj, rigid_bone):
    """
    Pone los pesos de una prenda ya unida.

    Ojo con esto: al unir una pieza derivada (que trae los grupos del cuerpo)
    con cajas modeladas aparte (que no traen ninguno), las cajas se quedarían
    con peso cero y el esqueleto las mandaría al origen del mundo. Por eso los
    pesos se recalculan SIEMPRE sobre la malla ya unida.
    """
    if rigid_bone:
        obj.vertex_groups.clear()
        group = obj.vertex_groups.new(name=rigid_bone)
        group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    else:
        transfer_weights(body, obj)
    return obj


def build_all(body):
    """
    Construye todo el guardarropa sobre el cuerpo ya enlazado.
    Devuelve (objetos, piezas_rigidas) para que el ensamblador sepa cuáles
    necesitan transferencia de pesos y cuáles se cuelgan de un hueso.
    """
    made = []
    for cosmetic_id, builder, mat_spec, rigid_bone in ITEMS:
        result = builder(body)
        # Un constructor puede devolver una lista (una sola pieza) o un
        # diccionario parte -> piezas, para cosméticos que el cliente necesita
        # poder ocultar por partes (el pelo bajo un gorro, por ejemplo).
        parts = result if isinstance(result, dict) else {"Main": result}
        if isinstance(mat_spec[0], str):
            mat = materials.recolor(mat_spec[0], roughness=mat_spec[1])
        else:
            mat = materials.fixed(mat_spec[1], mat_spec[0], roughness=mat_spec[2])
        any_made = False
        for part_name, pieces in parts.items():
            pieces = [p for p in pieces if p is not None]
            if not pieces:
                continue
            bake_transforms(pieces)
            obj = join(pieces, f"{cosmetic_id}__{part_name}")
            materials.assign(obj, mat)
            _weight(body, obj, rigid_bone)
            made.append((obj, rigid_bone))
            any_made = True
        if not any_made:
            print(f"[guardarropa] AVISO: {cosmetic_id} no generó geometría")

    # La suela clara de las zapatillas es una pieza suelta con su material.
    sole = join(shoes_sneakers_sole(body), "shoes_sneakers__Sole")
    if sole:
        bake_transforms([sole])
        materials.assign(sole, materials.fixed("Sneaker_Sole", SOLE, roughness=0.74))
        _weight(body, sole, None)
        made.append((sole, None))
    return made
