import * as THREE from 'three';
import { GAMEPLAY } from '@game/config';

/**
 * =====================================================================
 *  MEDIDAS Y ESQUELETO DEL PERSONAJE
 * =====================================================================
 *  Hay un solo personaje y su malla viene horneada desde Blender, así
 *  que estas medidas no se calculan: se copian de
 *  `assets/blender/lib/proportions.py`, que a su vez sale de MEDIR el
 *  modelo. Si allí cambian, aquí también.
 *
 *  Regla de oro: la altura total SIEMPRE es la de la cápsula de juego
 *  (`GAMEPLAY.player.capsuleHeight`). Así la silueta visible siempre
 *  cae dentro de la hitbox.
 * =====================================================================
 */

const TOTAL = GAMEPLAY.player.capsuleHeight; // 1.20 m

export const BASE = {
  /** Reparto vertical. headH + neckH + torsoH + legLen = TOTAL. */
  headH: 0.525,
  neckH: 0.003,
  torsoH: 0.217,
  legLen: 0.455,

  /** Semianchos del torso a distintas alturas (definen la silueta). */
  hipHalf: 0.105,
  waistHalf: 0.100,
  chestHalf: 0.130,
  shoulderHalf: 0.135,

  /** Cabeza. */
  headHalfW: 0.228,
  headHalfD: 0.233,

  /** Brazo: hombro → codo → muñeca → punta de la mano. */
  upperArm: 0.126,
  foreArm: 0.094,
  hand: 0.062,
  armRadius: 0.040,

  /** Pierna: cadera → rodilla → tobillo → suelo. */
  thigh: 0.212,
  shin: 0.165,
  ankleH: 0.078,
  thighRadius: 0.052,

  /** Separación de las articulaciones respecto al eje. */
  shoulderX: 0.130,
  hipX: 0.072,
} as const;

/**
 * Altura del hombro dentro del torso, como fracción de `torsoH`.
 * Tiene que ser EXACTAMENTE la misma que `SHOULDER_T` en
 * `assets/blender/lib/proportions.py`, o el brazo del modelo pivotaría por
 * un punto que no es su articulación.
 */
export const SHOULDER_T = 0.8894;

export interface Proportions {
  totalHeight: number;
  headH: number;
  headHalfW: number;
  headHalfD: number;
  neckH: number;
  torsoH: number;
  legLen: number;
  thigh: number;
  shin: number;
  ankleH: number;
  hipHalf: number;
  waistHalf: number;
  chestHalf: number;
  shoulderHalf: number;
  shoulderX: number;
  hipX: number;
  upperArm: number;
  foreArm: number;
  hand: number;
  armRadius: number;
  thighRadius: number;
  /** Alturas absolutas de cada articulación desde el suelo. */
  y: {
    hip: number;
    waist: number;
    chest: number;
    shoulder: number;
    neck: number;
    chin: number;
    crown: number;
    knee: number;
    ankle: number;
  };
}

/** Medidas del personaje. Son fijas: no hay sliders ni variantes. */
export function baseProportions(): Proportions {
  const hip = BASE.legLen;
  const chin = hip + BASE.torsoH + BASE.neckH;
  return {
    totalHeight: TOTAL,
    headH: BASE.headH,
    headHalfW: BASE.headHalfW,
    headHalfD: BASE.headHalfD,
    neckH: BASE.neckH,
    torsoH: BASE.torsoH,
    legLen: BASE.legLen,
    thigh: BASE.thigh,
    shin: BASE.shin,
    ankleH: BASE.ankleH,
    hipHalf: BASE.hipHalf,
    waistHalf: BASE.waistHalf,
    chestHalf: BASE.chestHalf,
    shoulderHalf: BASE.shoulderHalf,
    shoulderX: BASE.shoulderX,
    hipX: BASE.hipX,
    upperArm: BASE.upperArm,
    foreArm: BASE.foreArm,
    hand: BASE.hand,
    armRadius: BASE.armRadius,
    thighRadius: BASE.thighRadius,
    y: {
      hip,
      waist: hip + BASE.torsoH * 0.41,
      chest: hip + BASE.torsoH * 0.75,
      shoulder: hip + BASE.torsoH * SHOULDER_T,
      neck: hip + BASE.torsoH,
      chin,
      crown: chin + BASE.headH,
      knee: BASE.ankleH + BASE.shin,
      ankle: BASE.ankleH,
    },
  };
}

/**
 * Huesos del personaje. Cada uno es el nodo que la animación rota; el
 * modelo llega de Blender con su propio esqueleto y estos nombres son los
 * sitios donde encajan sus huesos.
 */
export interface ChibiRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  chest: THREE.Group;
  /** Espalda, mirando hacia +Z: mochilas, bomba. */
  back: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;

  /**
   * Clavículas. Reparten los giros grandes del brazo: subir el hombro de
   * golpe retuerce la malla y hunde el deltoides.
   */
  clavicleL: THREE.Group;
  clavicleR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  /** Punto exacto donde se ancla el arma dentro de la mano derecha. */
  gripR: THREE.Group;

  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  ankleL: THREE.Group;
  ankleR: THREE.Group;
}

const group = (name: string, x = 0, y = 0, z = 0): THREE.Group => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
};

/**
 * Normaliza el nombre de un hueso.
 *
 * El cargador de glTF de Three limpia los nombres de nodo y se come los
 * puntos, así que `upperarm.L` llega como `upperarmL`. Normalizando los dos
 * lados igual, la tabla puede seguir escrita con la convención de Blender.
 */
export const boneKey = (name: string): string =>
  name.replace(/\.\d+$/, '').replace(/\./g, '').toLowerCase();

/** Hueso de Blender -> miembro del rig. Espejo de BONE_TO_RIG en rig.py. */
const BONE_TO_RIG: Record<string, keyof ChibiRig> = {
  hips: 'hips', spine: 'torso', chest: 'chest', neck: 'neck', head: 'head',
  'shoulder.L': 'clavicleL', 'shoulder.R': 'clavicleR',
  'upperarm.L': 'shoulderL', 'upperarm.R': 'shoulderR',
  'forearm.L': 'elbowL', 'forearm.R': 'elbowR',
  'hand.L': 'handL', 'hand.R': 'handR',
  'thigh.L': 'hipL', 'thigh.R': 'hipR',
  'shin.L': 'kneeL', 'shin.R': 'kneeR',
  'foot.L': 'ankleL', 'foot.R': 'ankleR',
};

const BONE_LOOKUP: Record<string, keyof ChibiRig> = Object.fromEntries(
  Object.entries(BONE_TO_RIG).map(([name, key]) => [boneKey(name), key]),
);
const REQUIRED_BONES = Object.keys(BONE_TO_RIG);

export interface SkeletonRig {
  rig: ChibiRig;
  /** Lo que falte, para poder avisar en vez de fallar en silencio. */
  missing: string[];
}

/**
 * Monta el rig sobre los huesos del modelo.
 *
 * Funciona porque los huesos salen de Blender con sus ejes locales alineados
 * con los del mundo, así que rotar un hueso significa lo mismo que rotar un
 * grupo normal. Lo garantiza `flatten_orientations` en
 * assets/blender/lib/rig.py y lo comprueba tools/check-bone-axes.mjs.
 */
export function rigFromSkeleton(
  bones: Map<string, THREE.Bone>,
  modelRoot: THREE.Object3D,
  p: Proportions,
): SkeletonRig {
  const missing = REQUIRED_BONES.filter((name) => !bones.has(boneKey(name)));
  const root = group('chibi');
  root.add(modelRoot);

  if (missing.length) {
    // Sin esqueleto utilizable se devuelve una jerarquía vacía con la misma
    // forma, para que la animación no reviente mientras se avisa del fallo.
    const empty = { root } as ChibiRig;
    for (const key of Object.values(BONE_TO_RIG)) {
      const g = group(String(key));
      root.add(g);
      (empty as unknown as Record<string, THREE.Object3D>)[key] = g;
    }
    empty.back = group('back'); root.add(empty.back);
    empty.gripR = group('gripR'); root.add(empty.gripR);
    return { rig: empty, missing };
  }

  const rig = { root } as ChibiRig;
  for (const [normalized, key] of Object.entries(BONE_LOOKUP)) {
    (rig as unknown as Record<string, THREE.Object3D>)[key] = bones.get(normalized)!;
  }

  const socket = (name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group => {
    const g = group(name, x, y, z);
    parent.add(g);
    return g;
  };
  // +Z es la espalda: el personaje mira hacia -Z.
  rig.back = socket('back', rig.chest, 0, 0, p.chestHalf * 0.60);
  // Punto de agarre del arma dentro de la mano derecha.
  rig.gripR = socket('gripR', rig.handR, 0, -p.hand * 0.42, 0.012);
  return { rig, missing: [] };
}
