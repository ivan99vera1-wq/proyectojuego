"""
=====================================================================
 PROPORCIONES DEL PERSONAJE BASE DE TINYSTRIKE
=====================================================================
 Estas medidas son la fuente de verdad del modelo y DEBEN coincidir
 con las del juego:

   packages/config/src/gameplay.ts  -> player.capsuleHeight / capsuleRadius
   apps/client/src/customization/rig.ts -> BASE

 Regla de oro: la altura total es exactamente la de la cápsula de
 colisión (1,20 m). Así la silueta visible siempre cabe dentro de la
 hitbox y ningún jugador es más difícil de acertar que otro.

 Convención de Blender: Z es la altura, el personaje mira hacia +Y.
 Al exportar a glTF con "+Y up", +Y de Blender se convierte en -Z de
 glTF, que es justo hacia donde mira el personaje en el juego.
=====================================================================
"""

# --- reparto vertical (metros) --------------------------------------
TOTAL = 1.20
HEAD_H = 0.440      # del mentón a la coronilla
NECK_H = 0.022      # casi inexistente: la cabeza se apoya en los hombros
TORSO_H = 0.268     # de la cadera a la base del cuello
LEG_LEN = 0.470     # del suelo a la articulación de la cadera

assert abs(HEAD_H + NECK_H + TORSO_H + LEG_LEN - TOTAL) < 1e-6

# --- alturas absolutas de las articulaciones ------------------------
Y_ANKLE = 0.085
Y_KNEE = 0.255
Y_HIP = LEG_LEN                      # 0.465
Y_WAIST = Y_HIP + TORSO_H * 0.21
Y_CHEST = Y_HIP + TORSO_H * 0.62
Y_SHOULDER = Y_HIP + TORSO_H * 0.78
Y_NECK = Y_HIP + TORSO_H             # 0.710
Y_CHIN = Y_NECK + NECK_H             # 0.745
Y_CROWN = Y_CHIN + HEAD_H            # 1.200

THIGH = Y_HIP - Y_KNEE               # 0.210
SHIN = Y_KNEE - Y_ANKLE              # 0.170

# --- anchos (semiejes) ----------------------------------------------
HEAD_W = 0.213      # semiancho de la cabeza
HEAD_D = 0.196      # semiprofundidad de la cabeza
HIP_W = 0.122
WAIST_W = 0.104
CHEST_W = 0.140
SHOULDER_W = 0.152

SHOULDER_X = 0.163  # separación del hombro respecto al eje
HIP_X = 0.076

UPPER_ARM = 0.115
FOREARM = 0.105
HAND_LEN = 0.080
ARM_R = 0.058
THIGH_R = 0.070

# --- referencias de la hitbox (solo para verificación) --------------
CAPSULE_HEIGHT = 1.20
CAPSULE_RADIUS = 0.35
HEAD_HITBOX_R = 0.28
HEAD_HITBOX_Y = CAPSULE_HEIGHT - HEAD_HITBOX_R * 0.9   # 0.948
