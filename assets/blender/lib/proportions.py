"""
=====================================================================
 PROPORCIONES DEL PERSONAJE DE CHIBISTRIKE
=====================================================================
 Estas medidas salen de MEDIR el modelo base una vez normalizado por
 `build_base.py` a la altura de la cápsula de juego. No son inventadas.

 Son la fuente de verdad y deben coincidir con:
   packages/config/src/gameplay.ts       -> player.capsuleHeight / capsuleRadius
   apps/client/src/customization/rig.ts  -> BASE

 Convención de Blender: Z es la altura y el personaje mira hacia +Y.
 Al exportar a glTF con "+Y up", +Y de Blender se convierte en -Z de
 glTF, que es la dirección de avance en el juego.
=====================================================================
"""

TOTAL = 1.20

# --- alturas de las articulaciones, medidas sobre la malla ----------
Y_ANKLE = 0.078
Y_KNEE = 0.243
Y_HIP = 0.455
Y_WAIST = 0.545
Y_CHEST = 0.618
Y_SHOULDER = 0.648
Y_NECK = 0.672
Y_CHIN = 0.675          # franja más estrecha entre cabeza y hombros
Y_CROWN = 1.200

HEAD_H = Y_CROWN - Y_CHIN        # 0.525, el 43,8 % de la altura
NECK_H = Y_CHIN - Y_NECK
TORSO_H = Y_NECK - Y_HIP
LEG_LEN = Y_HIP

# Fracción del torso a la que cae el hombro. El cliente usa el mismo número
# (`SHOULDER_T` en rig.ts) para colocar su jerarquía de huesos.
SHOULDER_T = (Y_SHOULDER - Y_HIP) / TORSO_H

THIGH = Y_HIP - Y_KNEE
SHIN = Y_KNEE - Y_ANKLE

# --- anchos (semiejes) ----------------------------------------------
HEAD_W = 0.228
HEAD_D = 0.233
HIP_W = 0.105
WAIST_W = 0.100
CHEST_W = 0.130
SHOULDER_W = 0.135

# --- separación lateral de las articulaciones -----------------------
SHOULDER_X = 0.130
ELBOW_X = 0.168
WRIST_X = 0.188
HIP_X = 0.072
KNEE_X = 0.082
ANKLE_X = 0.090

# --- alturas de las articulaciones del brazo ------------------------
Y_ELBOW = 0.522
Y_WRIST = 0.428

UPPER_ARM = Y_SHOULDER - Y_ELBOW
FOREARM = Y_ELBOW - Y_WRIST
HAND_LEN = 0.062
ARM_R = 0.040
THIGH_R = 0.052

# --- pie -------------------------------------------------------------
TOE_FORWARD = 0.095      # el pie apunta hacia +Y (el frente)
TOE_HEIGHT = 0.014

# --- referencias de la hitbox (solo para verificación) --------------
CAPSULE_HEIGHT = 1.20
CAPSULE_RADIUS = 0.35
HEAD_HITBOX_R = 0.30
HEAD_HITBOX_Y = CAPSULE_HEIGHT - HEAD_HITBOX_R * 0.9
