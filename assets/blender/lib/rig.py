"""
=====================================================================
 ESQUELETO DEL PERSONAJE BASE
=====================================================================
 Los nombres de hueso son los estándar de la industria
 (mixamo-like) para que cualquier herramienta externa los entienda:

     root  hips  spine  chest  neck  head
     shoulder.L/R  upperarm.L/R  forearm.L/R  hand.L/R
     thigh.L/R  shin.L/R  foot.L/R  toe.L/R

 El cliente NO inventa posiciones: lee este esqueleto del GLB y mapea
 cada hueso a una clave de su rig (ver BONE_TO_RIG). Si se renombra un
 hueso aquí, hay que renombrarlo allí.

 Convención de lados: el personaje mira hacia +Y, así que su derecha
 es +X y su izquierda -X.
=====================================================================
"""
import bpy
from mathutils import Vector

from . import proportions as P

# La punta del pie y su altura salen de las proporciones medidas.
TOE_FORWARD = P.TOE_FORWARD
TOE_HEIGHT = P.TOE_HEIGHT


def _spine_bones():
    return [
        ("root", (0, 0, 0), (0, P.HEAD_D * 0.5, 0), None),
        ("hips", (0, 0, P.Y_HIP), (0, 0, P.Y_WAIST), "root"),
        ("spine", (0, 0, P.Y_WAIST), (0, 0, P.Y_CHEST), "hips"),
        ("chest", (0, 0, P.Y_CHEST), (0, 0, P.Y_NECK), "spine"),
        ("neck", (0, 0, P.Y_NECK), (0, 0, P.Y_CHIN), "chest"),
        ("head", (0, 0, P.Y_CHIN), (0, 0, P.Y_CROWN), "neck"),
    ]


def _limb_bones():
    out = []
    for sign, tag in ((-1, "L"), (1, "R")):
        out += [
            # Clavícula: nace junto al cuello y termina en la articulación real
            # del hombro. Sin ella el brazo no puede encogerse ni elevarse.
            (f"shoulder.{tag}", (sign * P.SHOULDER_W * 0.22, 0, P.Y_SHOULDER + 0.022),
             (sign * P.SHOULDER_X, 0, P.Y_SHOULDER), "chest"),
            (f"upperarm.{tag}", (sign * P.SHOULDER_X, 0, P.Y_SHOULDER),
             (sign * P.ELBOW_X, 0, P.Y_ELBOW), f"shoulder.{tag}"),
            (f"forearm.{tag}", (sign * P.ELBOW_X, 0, P.Y_ELBOW),
             (sign * P.WRIST_X, 0, P.Y_WRIST), f"upperarm.{tag}"),
            (f"hand.{tag}", (sign * P.WRIST_X, 0, P.Y_WRIST),
             (sign * P.WRIST_X, 0, P.Y_WRIST - P.HAND_LEN), f"forearm.{tag}"),
            (f"thigh.{tag}", (sign * P.HIP_X, 0, P.Y_HIP),
             (sign * P.KNEE_X, 0, P.Y_KNEE), "hips"),
            (f"shin.{tag}", (sign * P.KNEE_X, 0, P.Y_KNEE),
             (sign * P.ANKLE_X, 0, P.Y_ANKLE), f"thigh.{tag}"),
            (f"foot.{tag}", (sign * P.ANKLE_X, 0, P.Y_ANKLE),
             (sign * P.ANKLE_X, TOE_FORWARD, TOE_HEIGHT), f"shin.{tag}"),
            (f"toe.{tag}", (sign * P.ANKLE_X, TOE_FORWARD, TOE_HEIGHT),
             (sign * P.ANKLE_X, TOE_FORWARD + 0.045, TOE_HEIGHT), f"foot.{tag}"),
        ]
    return out


def bone_table():
    return _spine_bones() + _limb_bones()


# Hueso de Blender -> clave del rig del cliente (apps/client/src/customization/rig.ts).
BONE_TO_RIG = {
    "hips": "hips", "spine": "torso", "chest": "chest", "neck": "neck", "head": "head",
    "upperarm.L": "shoulderL", "upperarm.R": "shoulderR",
    "forearm.L": "elbowL", "forearm.R": "elbowR",
    "hand.L": "handL", "hand.R": "handR",
    "thigh.L": "hipL", "thigh.R": "hipR",
    "shin.L": "kneeL", "shin.R": "kneeR",
    "foot.L": "ankleL", "foot.R": "ankleR",
}


def build_armature(name="Armature"):
    """Crea el esqueleto en la escena activa y lo devuelve en modo objeto."""
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    created = {}
    for bone_name, head, tail, parent in bone_table():
        bone = data.edit_bones.new(bone_name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        # Roll 0: los ejes locales del hueso quedan alineados con los del mundo
        # tanto como permite su dirección. Es lo que hace predecible el signo
        # de las rotaciones tanto aquí como en el cliente.
        bone.roll = 0.0
        if parent:
            bone.parent = created[parent]
            bone.use_connect = (Vector(head) - created[parent].tail).length < 1e-6
        created[bone_name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


# Huesos que NO deforman la malla: solo sirven de raíz o de referencia.
NON_DEFORMING = {"root"}


def _segment_distance(p, a, b):
    """Distancia de un punto al segmento a-b."""
    ab = b - a
    denom = ab.dot(ab)
    t = 0.0 if denom < 1e-12 else max(0.0, min(1.0, (p - a).dot(ab) / denom))
    return (p - (a + ab * t)).length


def skin(meshes, armature, smoothing=14):
    """
    Enlaza las mallas al esqueleto y calcula los pesos.

    Los pesos NO los calcula Blender. Su método por calor necesita una
    superficie cerrada y coherente, y con esta malla (viene de una
    herramienta generativa y además le hemos abierto un boquete al quitar el
    martillo) devuelve todos los pesos a cero sin dar ningún error. El método
    de envolventes sí funciona, pero deforma fatal: estira la cabeza y rompe
    la cara.

    Lo que se hace aquí es lo que haría un artista a mano, automatizado:

      1. cada vértice se asigna entero al hueso cuyo segmento tiene más
         cerca;
      2. esa asignación se suaviza promediando con los vértices VECINOS,
         muchas veces. En las articulaciones eso crea el degradado que hace
         que el codo o la rodilla se doblen de forma natural.

    El paso 2 es seguro porque solo promedia a través de ARISTAS de la malla:
    la mano no puede contagiar peso al muslo aunque pasen cerca, porque no
    están conectados.
    """
    bones = [b for b in armature.data.bones if b.name not in NON_DEFORMING]
    segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in bones]
    index = {name: i for i, (name, _h, _t) in enumerate(segs)}

    for mesh in meshes:
        me = mesh.data
        n_verts = len(me.vertices)
        # 1. Asignación rígida al hueso más cercano.
        weights = [[0.0] * len(segs) for _ in range(n_verts)]
        for vi, v in enumerate(me.vertices):
            co = v.co
            best, bestd = 0, 1e9
            for bi, (_name, h, t) in enumerate(segs):
                d = _segment_distance(co, h, t)
                if d < bestd:
                    bestd, best = d, bi
            weights[vi][best] = 1.0

        # 2. Suavizado por vecindad de malla.
        neigh = [[] for _ in range(n_verts)]
        for e in me.edges:
            a, b = e.vertices
            neigh[a].append(b)
            neigh[b].append(a)
        for _ in range(smoothing):
            nxt = []
            for vi in range(n_verts):
                acc = list(weights[vi])
                for n in neigh[vi]:
                    wn = weights[n]
                    for k in range(len(acc)):
                        acc[k] += wn[k]
                total = sum(acc)
                nxt.append([x / total for x in acc] if total > 0 else weights[vi])
            weights = nxt

        # 3. Volcado: como mucho cuatro huesos por vértice, que es el límite
        #    de glTF, y se descarta lo que no llegue al 1 %.
        mesh.vertex_groups.clear()
        groups = {name: mesh.vertex_groups.new(name=name) for name, _h, _t in segs}
        for vi in range(n_verts):
            row = sorted(enumerate(weights[vi]), key=lambda kv: kv[1], reverse=True)[:4]
            row = [(bi, w) for bi, w in row if w > 0.01]
            total = sum(w for _bi, w in row) or 1.0
            for bi, w in row:
                groups[segs[bi][0]].add([vi], w / total, "REPLACE")

        if mesh.parent is not armature:
            mesh.parent = armature
            mesh.matrix_parent_inverse = armature.matrix_world.inverted()
        for mod in [m for m in mesh.modifiers if m.type == "ARMATURE"]:
            mesh.modifiers.remove(mod)
        mod = mesh.modifiers.new("Armature", "ARMATURE")
        mod.object = armature
        covered = sum(1 for v in me.vertices if v.groups) / max(1, n_verts)
        print(f"[rig] {mesh.name}: pesos propios sobre {len(segs)} huesos, "
              f"{covered * 100:.1f} % de la malla cubierta")
    return "pesos calculados por cercanía y suavizado"


def flatten_orientations(armature):
    """
    Deja TODOS los huesos apuntando hacia ARRIBA (+Z de Blender) con roll 0,
    sin mover sus cabezas.

    Por qué: en glTF cada hueso guarda su transformación respecto al padre. Si
    cada hueso mira en una dirección distinta, `hueso.rotation.x` en el cliente
    gira sobre un eje distinto en cada articulación y la animación que ya
    existe dejaría de valer. Con todos los huesos alineados con los ejes del
    mundo, la rotación de un hueso significa exactamente lo mismo que la de un
    grupo normal de Three.js, y el código de animación del juego sigue igual.

    Apuntar a +Z (y no a +Y) es lo que hace que, tras la conversión a glTF con
    "+Y arriba", los ejes locales de cada hueso coincidan con los del mundo.
    Está comprobado con `tools/check-bone-axes.mjs`.

    Se ejecuta DESPUÉS de calcular los pesos. Cambiar la orientación de reposo
    mientras la pose es la de reposo no deforma la malla: el modificador
    Armature multiplica la pose por la inversa del reposo y sale la identidad.
    Los grupos de vértices y sus pesos no se tocan.
    """
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    bones = armature.data.edit_bones
    # Primero desconectar: si un hueso está conectado, mover la cola del padre
    # arrastraría la cabeza del hijo.
    for bone in bones:
        bone.use_connect = False
    for bone in bones:
        length = max(bone.length, 1e-4)
        bone.tail = bone.head + Vector((0.0, 0.0, length))
        bone.roll = 0.0
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature
