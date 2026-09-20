"""
=====================================================================
 PROPORCIONES DEL PERSONAJE BASE DE TINYSTRIKE
=====================================================================
 Estas medidas NO son inventadas: salen de medir el modelo base
 masculino (`assets/source/Chibi Base Mesh Character.blend`) una vez
 normalizado por `build_base.py` a la altura de la cápsula de juego.
 El procedimiento está en `docs/PERSONAJE.md`.

 Son la fuente de verdad y DEBEN coincidir con:
   packages/config/src/gameplay.ts       -> player.capsuleHeight / capsuleRadius
   apps/client/src/customization/rig.ts  -> BASE

 Convención de Blender: Z es la altura y el personaje mira hacia +Y.
 Al exportar a glTF con "+Y up", +Y de Blender se convierte en -Z de
 glTF, que es la dirección de avance en el juego.
=====================================================================
"""

# --- reparto vertical (metros) --------------------------------------
# El modelo base es un chibi masculino de 4 cabezas: la cabeza ocupa el
# 38,7 % de la altura, el tronco es corto y las piernas llegan al 40 %.
TOTAL = 1.20
HEAD_H = 0.465      # del mentón a la coronilla (medido: 38,7 %)
NECK_H = 0.045      # del alto de hombros al mentón
TORSO_H = 0.215     # de la cadera a la base del cuello
LEG_LEN = 0.475     # del suelo a la entrepierna

assert abs(HEAD_H + NECK_H + TORSO_H + LEG_LEN - TOTAL) < 1e-6

# --- alturas absolutas de las articulaciones ------------------------
# Medidas sobre la malla: el tobillo y la rodilla son los mínimos de
# grosor de la pierna, la entrepierna es la altura a la que las piernas
# dejan de tocarse y el mentón es la franja más estrecha del cuello.
Y_ANKLE = 0.077
Y_KNEE = 0.245
Y_HIP = LEG_LEN                      # 0.475
Y_WAIST = 0.513                      # cintura: el torso más estrecho
Y_CHEST = 0.613
Y_SHOULDER = 0.665                   # centro de la articulación del hombro
Y_ELBOW = 0.565                      # medido: el punto más fino entre brazo y antebrazo
Y_WRIST = 0.476                      # medido: el estrechamiento antes de la mano
Y_NECK = Y_HIP + TORSO_H             # 0.690
Y_CHIN = Y_NECK + NECK_H             # 0.735
Y_CROWN = Y_CHIN + HEAD_H            # 1.200

# Fracción del torso a la que cae el hombro. El cliente usa el mismo
# número (`SHOULDER_T` en rig.ts) para colocar su jerarquía de huesos.
SHOULDER_T = (Y_SHOULDER - Y_HIP) / TORSO_H      # 0.8837

THIGH = Y_HIP - Y_KNEE               # 0.230
SHIN = Y_KNEE - Y_ANKLE              # 0.168

# --- anchos (semiejes) ----------------------------------------------
HEAD_W = 0.232      # semiancho de la cabeza
HEAD_D = 0.218      # semiprofundidad media (la nuca sobresale más que la cara)
HIP_W = 0.078
WAIST_W = 0.063
CHEST_W = 0.114
SHOULDER_W = 0.114

# Separación lateral de las articulaciones respecto al eje.
SHOULDER_X = 0.132
ELBOW_X = 0.172     # el brazo cuelga abierto: el codo va más fuera que el hombro
WRIST_X = 0.221
HIP_X = 0.047
KNEE_X = 0.046
ANKLE_X = 0.053

# Longitudes de los huesos (distancia real entre articulaciones).
UPPER_ARM = 0.108
FOREARM = 0.102
HAND_LEN = 0.116
ARM_R = 0.030       # radio medio del antebrazo
THIGH_R = 0.034

# --- referencias de la hitbox (solo para verificación) --------------
CAPSULE_HEIGHT = 1.20
CAPSULE_RADIUS = 0.35
HEAD_HITBOX_R = 0.30
HEAD_HITBOX_Y = CAPSULE_HEIGHT - HEAD_HITBOX_R * 0.9   # 0.930
