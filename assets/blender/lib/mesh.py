"""
Utilidades de modelado. La idea es la de cualquier artista: construir una
CAJA DE CONTROL de pocos polígonos y dejar que la subdivisión Catmull-Clark
la convierta en una superficie orgánica. Los pliegues (creases) devuelven
dureza donde hace falta: suela de la bota, borde de un chaleco, visera.
"""
import bmesh
import bpy
from mathutils import Vector


# ------------------------------------------------------------------ objetos

def new_object(name, verts, faces, collection=None):
    """Crea un objeto de malla a partir de vértices y caras (preferiblemente quads)."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def shade_smooth(obj, angle_deg=40.0):
    """Sombreado suave con arista automática por ángulo."""
    for poly in obj.data.polygons:
        poly.use_smooth = True
    mod = obj.modifiers.new("Suavizado", "SMOOTH_BY_ANGLE") if _has_smooth_by_angle() else None
    if mod is None:
        # En versiones sin el modificador, el ángulo se aplica al exportar.
        pass
    return obj


def _has_smooth_by_angle():
    try:
        return "SMOOTH_BY_ANGLE" in {i.identifier for i in
                                     bpy.types.Modifier.bl_rna.properties["type"].enum_items}
    except Exception:
        return False


def add_subsurf(obj, levels=2, render=None):
    mod = obj.modifiers.new("Subdividir", "SUBSURF")
    mod.levels = levels
    mod.render_levels = render if render is not None else levels
    mod.use_limit_surface = True
    return mod


def add_mirror(obj, axis=(True, False, False), clip=True):
    mod = obj.modifiers.new("Simetría", "MIRROR")
    mod.use_axis = axis
    mod.use_clip = clip
    return mod


def apply_modifiers(obj):
    """Congela los modificadores: el GLB final debe llevar geometría real."""
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError:
            obj.modifiers.remove(mod)
    return obj


# ------------------------------------------------------------------ bmesh

def crease_edges(obj, predicate, value=1.0):
    """
    Marca como pliegue las aristas que cumplan `predicate(v0, v1)`.
    Es lo que permite que una suela sea recta mientras el resto del zapato
    sigue siendo una superficie suave.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    layer = bm.edges.layers.float.get("crease") or bm.edges.layers.float.new("crease")
    for edge in bm.edges:
        a, b = edge.verts[0].co, edge.verts[1].co
        if predicate(a, b):
            edge[layer] = value
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def bevel_edges(obj, predicate, width=0.004, segments=2):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    targets = [e for e in bm.edges if predicate(e.verts[0].co, e.verts[1].co)]
    if targets:
        bmesh.ops.bevel(bm, geom=targets, offset=width, segments=segments,
                        profile=0.5, affect="EDGES")
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def join(objects, name):
    """Une varios objetos en uno solo (para exportar menos mallas)."""
    objects = [o for o in objects if o is not None]
    if not objects:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    result = bpy.context.view_layer.objects.active
    result.name = name
    result.data.name = name
    return result


# ------------------------------------------------------- caja por secciones

def superellipse(n, segments):
    """Puntos de una superelipse unitaria. n=2 elipse, n=6 casi rectángulo."""
    import math
    e = 2.0 / n
    pts = []
    for i in range(segments):
        a = (i / segments) * math.tau
        ca, sa = math.cos(a), math.sin(a)
        sx = math.copysign(abs(ca) ** e, ca)
        sy = math.copysign(abs(sa) ** e, sa)
        pts.append((sx, sy))
    return pts


class Ring:
    """Sección transversal de una pieza, a una altura dada."""

    def __init__(self, z, w, d=None, n=2.6, x=0.0, y=0.0, front=1.0, back=1.0):
        self.z = z
        self.w = w
        self.d = w if d is None else d
        self.n = n
        self.x = x
        self.y = y
        self.front = front   # multiplica la mitad delantera (+Y)
        self.back = back     # multiplica la mitad trasera (-Y)

    def points(self, segments):
        out = []
        for sx, sy in superellipse(self.n, segments):
            py = sy * self.d
            py *= self.front if py > 0 else self.back
            out.append((self.x + sx * self.w, self.y + py, self.z))
        return out


def rings_to_mesh(rings, segments=12, cap_bottom=True, cap_top=True):
    """Convierte una lista de secciones en una caja de control de quads."""
    verts, faces = [], []
    starts = []
    for ring in rings:
        starts.append(len(verts))
        verts.extend(ring.points(segments))
    for r in range(len(rings) - 1):
        a0, b0 = starts[r], starts[r + 1]
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((a0 + i, a0 + j, b0 + j, b0 + i))
    if cap_bottom:
        faces.append(tuple(range(starts[0] + segments - 1, starts[0] - 1, -1)))
    if cap_top:
        s = starts[-1]
        faces.append(tuple(range(s, s + segments)))
    return verts, faces


# --------------------------------------------------------------- cubo-esfera

def cube_sphere(n=4):
    """
    Esfera de topología cuadrangular sin polos. Es la base correcta para una
    cabeza: los polos de una esfera UV pellizcan al subdividir y arruinan la
    frente y la coronilla.
    """
    index = {}
    verts = []
    faces = []

    def key(p):
        return (round(p[0], 5), round(p[1], 5), round(p[2], 5))

    def add(p):
        k = key(p)
        if k not in index:
            index[k] = len(verts)
            verts.append(p)
        return index[k]

    def norm(p):
        v = Vector(p)
        v.normalize()
        return (v.x, v.y, v.z)

    axes = [
        ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
        ((-1, 0, 0), (0, -1, 0), (0, 0, 1)),
        ((0, 1, 0), (-1, 0, 0), (0, 0, 1)),
        ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
        ((0, 0, 1), (1, 0, 0), (0, 1, 0)),
        ((0, 0, -1), (-1, 0, 0), (0, 1, 0)),
    ]
    for normal, u, v in axes:
        grid = []
        for iu in range(n + 1):
            row = []
            for iv in range(n + 1):
                fu = iu / n * 2 - 1
                fv = iv / n * 2 - 1
                p = (normal[0] + u[0] * fu + v[0] * fv,
                     normal[1] + u[1] * fu + v[1] * fv,
                     normal[2] + u[2] * fu + v[2] * fv)
                row.append(add(norm(p)))
            grid.append(row)
        for iu in range(n):
            for iv in range(n):
                faces.append((grid[iu][iv], grid[iu + 1][iv],
                              grid[iu + 1][iv + 1], grid[iu][iv + 1]))
    return verts, faces


def deform(verts, fn):
    """Aplica una función de modelado vértice a vértice."""
    return [fn(Vector(v)) for v in verts]


def surface_y(obj, x, z, start=1.2):
    """
    Devuelve la Y de la superficie del objeto en el punto (x, z), lanzando un
    rayo desde delante. Se mide sobre la malla YA evaluada (con subdivisión),
    así que los rasgos se apoyan en la piel real y no en una estimación.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    origin = (x - obj.location.x, start, z - obj.location.z)
    hit, loc, _nor, _idx = ev.ray_cast(origin, (0.0, -1.0, 0.0))
    if not hit:
        return None
    return loc.y + obj.location.y


def surface_normal_y(obj, x, z, start=1.2):
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    origin = (x - obj.location.x, start, z - obj.location.z)
    hit, _loc, nor, _idx = ev.ray_cast(origin, (0.0, -1.0, 0.0))
    return nor if hit else None
