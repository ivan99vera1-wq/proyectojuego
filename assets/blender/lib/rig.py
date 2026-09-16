"""
Esqueleto del personaje.

El juego anima rotando cada segmento por su articulación, así que el modelo se
exporta como piezas con el origen puesto en la articulación correspondiente.
El armature que se crea aquí vive en el .blend y sirve para dos cosas: dejar
el personaje listo para animar clips en Blender más adelante, y documentar la
jerarquía con nombres estándar.

Mapa entre huesos y grupos del rig del cliente (apps/client/src/customization/rig.ts):

    hips        -> hips
    spine       -> torso
    chest       -> chest
    neck        -> neck
    head        -> head
    upperarm.L/R-> shoulderL/R
    forearm.L/R -> elbowL/R
    hand.L/R    -> handL/R
    thigh.L/R   -> hipL/R
    shin.L/R    -> kneeL/R
    foot.L/R    -> ankleL/R
"""
import bpy
from mathutils import Vector

from . import proportions as P

BONES = [
    # (nombre, cabeza, cola, padre)
    ("root", (0, 0, 0), (0, 0, 0.08), None),
    ("hips", (0, 0, P.Y_HIP), (0, 0, P.Y_WAIST), "root"),
    ("spine", (0, 0, P.Y_WAIST), (0, 0, P.Y_CHEST), "hips"),
    ("chest", (0, 0, P.Y_CHEST), (0, 0, P.Y_NECK), "spine"),
    ("neck", (0, 0, P.Y_NECK), (0, 0, P.Y_CHIN), "chest"),
    ("head", (0, 0, P.Y_CHIN), (0, 0, P.Y_CROWN), "neck"),
]

for _s, _tag in ((-1, "L"), (1, "R")):
    BONES += [
        (f"shoulder.{_tag}", (_s * P.SHOULDER_W * 0.25, 0, P.Y_SHOULDER + 0.02),
         (_s * P.SHOULDER_X, 0, P.Y_SHOULDER), "chest"),
        (f"upperarm.{_tag}", (_s * P.SHOULDER_X, 0, P.Y_SHOULDER),
         (_s * P.SHOULDER_X, 0, P.Y_SHOULDER - P.UPPER_ARM), f"shoulder.{_tag}"),
        (f"forearm.{_tag}", (_s * P.SHOULDER_X, 0, P.Y_SHOULDER - P.UPPER_ARM),
         (_s * P.SHOULDER_X, 0, P.Y_SHOULDER - P.UPPER_ARM - P.FOREARM), f"upperarm.{_tag}"),
        (f"hand.{_tag}", (_s * P.SHOULDER_X, 0, P.Y_SHOULDER - P.UPPER_ARM - P.FOREARM),
         (_s * P.SHOULDER_X, 0, P.Y_SHOULDER - P.UPPER_ARM - P.FOREARM - P.HAND_LEN), f"forearm.{_tag}"),
        (f"thigh.{_tag}", (_s * P.HIP_X, 0, P.Y_HIP), (_s * P.HIP_X, 0, P.Y_KNEE), "hips"),
        (f"shin.{_tag}", (_s * P.HIP_X, 0, P.Y_KNEE), (_s * P.HIP_X, 0, P.Y_ANKLE), f"thigh.{_tag}"),
        (f"foot.{_tag}", (_s * P.HIP_X, 0, P.Y_ANKLE), (_s * P.HIP_X, P.THIGH_R * 1.4, 0.006), f"shin.{_tag}"),
    ]

# Piezas del modelo y hueso al que pertenecen.
PART_BONE = {
    "Head": "head", "Nose": "head", "EarL": "head", "EarR": "head", "Hair": "head",
    "Neck": "neck", "Torso": "chest",
    "ArmUpperL": "upperarm.L", "ArmUpperR": "upperarm.R",
    "ArmLowerL": "forearm.L", "ArmLowerR": "forearm.R",
    "HandL": "hand.L", "HandR": "hand.R",
    "LegUpperL": "thigh.L", "LegUpperR": "thigh.R",
    "LegLowerL": "shin.L", "LegLowerR": "shin.R",
    "FootL": "foot.L", "FootR": "foot.R",
}


def build_armature(name="Armature"):
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    created = {}
    for bone_name, head, tail, parent in BONES:
        bone = arm_data.edit_bones.new(bone_name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        if parent and parent in created:
            bone.parent = created[parent]
            bone.use_connect = False
        created[bone_name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def bind_rigid(objects, armature):
    """
    Une cada pieza a su hueso con peso rígido. Con proporciones chibi y ropa
    gruesa, los segmentos con solape en las articulaciones se leen mejor que
    una malla continua, y además es lo que el cliente ya sabe animar.
    """
    for obj in objects:
        bone = PART_BONE.get(obj.name)
        if bone is None:
            continue
        group = obj.vertex_groups.new(name=bone)
        group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
        mod = obj.modifiers.new("Esqueleto", "ARMATURE")
        mod.object = armature
        obj.parent = armature
