"""
=====================================================================
 ESQUELETO DEL PERSONAJE BASE
=====================================================================
 Un único armature para TODO: cuerpo, cara y (más adelante) ropa y
 accesorios. Los nombres de hueso son los estándar de la industria
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

# Punta del pie: hacia delante (+Y) y casi a ras de suelo.
TOE_FORWARD = 0.075
TOE_HEIGHT = 0.012


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


def skin(meshes, armature):
    """
    Enlaza las mallas al esqueleto con pesos automáticos y deja un modificador
    Armature en cada una. Esto SÍ produce mallas con skin en el GLB, que es lo
    que el cliente necesita para deformar hombros, codos y rodillas.
    """
    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
        mode = "pesos automáticos"
    except RuntimeError:
        # El cálculo por calor falla en mallas con geometría suelta; las
        # envolventes dan un resultado peor pero nunca dejan el modelo sin pesos.
        bpy.ops.object.parent_set(type="ARMATURE_ENVELOPE")
        mode = "envolventes (falló el cálculo por calor)"
    bpy.ops.object.select_all(action="DESELECT")
    return mode


def parent_rigid(objects, armature, bone_name):
    """
    Cuelga una pieza de un solo hueso, sin deformarla. Para lo que es rígido:
    ojos, cejas, boca, gafas, cascos. Se hace con un grupo de vértices al 100 %
    para que el GLB salga con skin y el cliente no tenga que tratarlo aparte.

    OJO — la trampa que costó encontrar: al exportar a glTF, una malla CON SKIN
    ignora la transformación de su nodo. Si el iris está colocado moviendo el
    objeto, en el GLB aparece en el origen de la malla y el ojo se descompone.
    Por eso aquí se hornea la transformación en los vértices antes de enlazar.
    """
    for obj in objects:
        obj.data.transform(obj.matrix_basis)
        obj.data.update()
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = (0.0, 0.0, 0.0)
        obj.scale = (1.0, 1.0, 1.0)
    for obj in objects:
        obj.vertex_groups.clear()
        group = obj.vertex_groups.new(name=bone_name)
        group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
        if obj.parent is not armature:
            obj.parent = armature
            obj.matrix_parent_inverse = armature.matrix_world.inverted()
        if not any(m.type == "ARMATURE" for m in obj.modifiers):
            mod = obj.modifiers.new("Armature", "ARMATURE")
            mod.object = armature
    return objects


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
