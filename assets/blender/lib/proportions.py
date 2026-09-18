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
# Proporciones tipo Brawl Stars: cabeza enorme, cuerpo corto y rechoncho,
# extremidades cortas y gruesas. La cabeza ocupa el 43 % de la altura.
TOTAL = 1.20
HEAD_H = 0.520      # del mentón a la coronilla
NECK_H = 0.012      # prácticamente nulo: la cabeza se apoya en los hombros
TORSO_H = 0.245     # de la cadera a la base del cuello
LEG_LEN = 0.423     # del suelo a la articulación de la cadera

assert abs(HEAD_H + NECK_H + TORSO_H + LEG_LEN - TOTAL) < 1e-6

# --- alturas absolutas de las articulaciones ------------------------
Y_ANKLE = 0.103
Y_KNEE = 0.248
Y_HIP = LEG_LEN                      # 0.423
Y_WAIST = Y_HIP + TORSO_H * 0.21
Y_CHEST = Y_HIP + TORSO_H * 0.62
Y_SHOULDER = Y_HIP + TORSO_H * 0.72
Y_NECK = Y_HIP + TORSO_H             # 0.668
Y_CHIN = Y_NECK + NECK_H             # 0.680
Y_CROWN = Y_CHIN + HEAD_H            # 1.200

THIGH = Y_HIP - Y_KNEE               # 0.175
SHIN = Y_KNEE - Y_ANKLE              # 0.145

# --- anchos (semiejes) ----------------------------------------------
HEAD_W = 0.235      # semiancho de la cabeza
HEAD_D = 0.212      # semiprofundidad de la cabeza
HIP_W = 0.128
WAIST_W = 0.120
CHEST_W = 0.146
SHOULDER_W = 0.152

# El hombro va MUY por fuera del torso: es lo que separa el brazo del cuerpo
# y lo que hace que la silueta tenga hueco entre brazo y tronco.
SHOULDER_X = 0.190
HIP_X = 0.070

# Extremidades cortas y gruesas.
UPPER_ARM = 0.104
FOREARM = 0.092
HAND_LEN = 0.080
ARM_R = 0.062
THIGH_R = 0.076

# --- referencias de la hitbox (solo para verificación) --------------
CAPSULE_HEIGHT = 1.20
CAPSULE_RADIUS = 0.35
HEAD_HITBOX_R = 0.30
HEAD_HITBOX_Y = CAPSULE_HEIGHT - HEAD_HITBOX_R * 0.9   # 0.948
