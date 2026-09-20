import * as THREE from 'three';
import { BODY_SLIDERS, GAMEPLAY } from '@game/config';
import type { AvatarConfig } from '@game/shared';


/**
 * =====================================================================
 *  RIG DEL PERSONAJE BASE (único personaje de TinyStrike)
 * =====================================================================
 *  Aquí viven TODAS las medidas del cuerpo y la jerarquía de huesos.
 *  Ni el cuerpo ni un cosmético inventan posiciones: piden un socket.
 *
 *  Regla de oro: la altura total SIEMPRE es la de la cápsula de juego
 *  (`GAMEPLAY.player.capsuleHeight`). Los sliders reparten esa altura
 *  entre cabeza, torso y piernas, pero nunca la cambian. Así la silueta
 *  visible siempre cae dentro de la hitbox y ningún jugador es más
 *  pequeño (ni más difícil de acertar) que otro.
 * =====================================================================
 */

const TOTAL = GAMEPLAY.player.capsuleHeight; // 1.20 m

/**
 * Z de la superficie de la cara a una altura dada de la cabeza (Z negativo es
 * el frente). La cabeza se aproxima por un elipsoide: basta para colocar el
 * punto de anclaje de las gafas, y evita arrastrar un módulo entero de
 * perfiles que ya no usa nadie más.
 */
function headSurfaceZ(p: Proportions, yLocal: number): number {
  const half = p.headH * 0.5;
  const t = Math.min(1, Math.abs(yLocal - half) / half);
  return -p.headHalfD * Math.sqrt(Math.max(0, 1 - t * t));
}

/** Medidas de referencia del personaje base, en metros. */
export const BASE = {
  /**
   * Reparto vertical. headH + neckH + torsoH + legLen = TOTAL.
   * IMPORTANTE: estos números deben coincidir con
   * `assets/blender/lib/proportions.py`, que a su vez sale de MEDIR el modelo
   * base masculino. Si aquí y allí no coinciden, los cosméticos quedan
   * descolocados respecto a los huesos del personaje.
   */
  headH: 0.465,
  neckH: 0.045,
  torsoH: 0.215,
  legLen: 0.475,

  /** Semianchos del torso a distintas alturas (definen la silueta). */
  hipHalf: 0.078,
  waistHalf: 0.063,
  chestHalf: 0.114,
  shoulderHalf: 0.114,

  /** Cabeza. */
  headHalfW: 0.232,
  headHalfD: 0.218,

  /** Brazo: hombro → codo → muñeca → punta de la mano. */
  upperArm: 0.108,
  foreArm: 0.102,
  hand: 0.116,
  armRadius: 0.030,

  /** Pierna: cadera → rodilla → tobillo → suelo. */
  thigh: 0.230,
  shin: 0.168,
  ankleH: 0.077,
  thighRadius: 0.034,

  /** Separación de las articulaciones respecto al eje. */
  shoulderX: 0.132,
  hipX: 0.047,
} as const;

/**
 * Altura del hombro dentro del torso, como fracción de `torsoH`.
 * Tiene que ser EXACTAMENTE la misma que `Y_SHOULDER` en
 * `assets/blender/lib/proportions.py`, o el brazo del GLB pivotaría por
 * un punto que no es su articulación.
 */
export const SHOULDER_T = 0.8837;

/** Proporciones finales tras aplicar los sliders del jugador. */
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
  /** Multiplicador de anchura del cuerpo (torso y extremidades). */
  width: number;
  /** Multiplicador del tamaño de los ojos. */
  eyeScale: number;
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

const norm = (v: number, key: keyof typeof BODY_SLIDERS): number => {
  const d = BODY_SLIDERS[key];
  return Math.min(1, Math.max(0, (v - d.min) / (d.max - d.min)));
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Convierte los sliders del avatar en medidas concretas.
 * `headSize` y `height` reparten la altura; el torso absorbe la diferencia,
 * de modo que el total permanece clavado en la altura de la cápsula.
 */
export function deriveProportions(sliders: AvatarConfig['sliders']): Proportions {
  const headK = lerp(0.90, 1.10, norm(sliders.headSize, 'headSize'));
  const legK = lerp(0.92, 1.08, norm(sliders.height, 'height'));
  const width = lerp(0.90, 1.14, norm(sliders.bodyWidth, 'bodyWidth'));
  const eyeScale = lerp(0.78, 1.26, norm(sliders.eyeSize, 'eyeSize'));

  const headH = BASE.headH * headK;
  const legLen = BASE.legLen * legK;
  const neckH = BASE.neckH;
  // El torso cuadra la altura total: nunca se sale de la cápsula.
  const torsoH = Math.max(0.16, TOTAL - headH - neckH - legLen);

  const legScale = legLen / BASE.legLen;
  const thigh = BASE.thigh * legScale;
  const shin = BASE.shin * legScale;
  const ankleH = BASE.ankleH * legScale;
  const torsoScale = torsoH / BASE.torsoH;

  const hip = legLen;
  const shoulder = hip + torsoH * SHOULDER_T;
  const chin = hip + torsoH + neckH;

  return {
    totalHeight: TOTAL,
    headH,
    headHalfW: BASE.headHalfW * headK,
    headHalfD: BASE.headHalfD * headK,
    neckH, torsoH, legLen, thigh, shin, ankleH, width, eyeScale,
    hipHalf: BASE.hipHalf * width,
    waistHalf: BASE.waistHalf * width,
    chestHalf: BASE.chestHalf * width,
    shoulderHalf: BASE.shoulderHalf * width,
    shoulderX: BASE.shoulderX * width,
    hipX: BASE.hipX * width,
    upperArm: BASE.upperArm * torsoScale,
    foreArm: BASE.foreArm * torsoScale,
    hand: BASE.hand,
    armRadius: BASE.armRadius * width,
    thighRadius: BASE.thighRadius * width,
    y: {
      hip,
      waist: hip + torsoH * 0.1767,
      chest: hip + torsoH * 0.6419,
      shoulder,
      neck: hip + torsoH,
      chin,
      crown: chin + headH,
      knee: ankleH + shin,
      ankle: ankleH,
    },
  };
}

/**
 * Proporciones exactas del modelo de Blender, sin tocar por los sliders.
 * El GLB viene horneado a estas medidas y trae el origen de cada pieza en su
 * articulación: si el rig del cliente se moviera con los sliders, las piezas
 * quedarían descolocadas.
 */
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
    width: 1,
    eyeScale: 1,
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
      waist: hip + BASE.torsoH * 0.1767,
      chest: hip + BASE.torsoH * 0.6419,
      shoulder: hip + BASE.torsoH * SHOULDER_T,
      neck: hip + BASE.torsoH,
      chin,
      crown: chin + BASE.headH,
      knee: BASE.ankleH + BASE.shin,
      ankle: BASE.ankleH,
    },
  };
}

/** Clave de caché: dos avatares con los mismos sliders comparten geometría. */
export function proportionsKey(sliders: AvatarConfig['sliders']): string {
  const q = (v: number) => Math.round(v * 40) / 40;
  return `${q(sliders.headSize)}|${q(sliders.height)}|${q(sliders.bodyWidth)}|${q(sliders.eyeSize)}`;
}

/**
 * Huesos y puntos de anclaje del personaje. Cada cosmético se engancha a uno
 * de estos grupos; ninguno toca posiciones absolutas.
 */
export interface ChibiRig {
  root: THREE.Group;
  /** Cadera: raíz del cuerpo, sube y baja al agacharse. */
  hips: THREE.Group;
  /** Torso completo (pivota en la cadera). */
  torso: THREE.Group;
  /** Pecho, a la altura del esternón: chalecos, mochilas frontales. */
  chest: THREE.Group;
  /** Espalda, mirando hacia -Z: mochilas, bomba. */
  back: THREE.Group;
  /** Base del cuello: bufandas, cuellos de chaqueta. */
  neck: THREE.Group;
  /** Cabeza (pivota en la base del cuello). */
  head: THREE.Group;

  hairSocket: THREE.Group;
  headwearSocket: THREE.Group;
  eyewearSocket: THREE.Group;
  headAccessorySocket: THREE.Group;
  eyeSocket: THREE.Group;
  browSocket: THREE.Group;
  mouthSocket: THREE.Group;
  earSocketL: THREE.Group;
  earSocketR: THREE.Group;

  /**
   * Clavículas. Existen para repartir los giros grandes del brazo: subir el
   * hombro 140 grados de golpe retuerce la malla y hunde el deltoides. Con
   * una parte del giro en la clavícula, el hombro se mantiene con volumen.
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

/** Crea la jerarquía de huesos vacía a partir de unas proporciones. */
export function buildRig(p: Proportions): ChibiRig {
  const root = group('chibi');
  const hips = group('hips', 0, p.y.hip);
  root.add(hips);

  const torso = group('torso');
  hips.add(torso);
  // La cara mira hacia -Z, así que el PECHO está en -Z y la ESPALDA en +Z.
  // Estaban al revés: por eso una mochila salía sobre el pecho.
  const chest = group('chest', 0, p.torsoH * 0.62, -p.chestHalf * 0.62);
  const back = group('back', 0, p.torsoH * 0.58, p.chestHalf * 0.60);
  const neck = group('neck', 0, p.torsoH, -0.004);
  torso.add(chest, back, neck);

  const head = group('head', 0, p.neckH);
  neck.add(head);

  // Rasgos faciales: anclados a la superficie real del cráneo para que ni se
  // hundan dentro de la cabeza ni floten por delante.
  const faceY = p.headH * 0.37;
  const browY = faceY + p.headH * 0.135;
  const mouthY = faceY - p.headH * 0.175;
  const inset = p.headHalfW * 0.11;
  void inset;
  const hairSocket = group('hairSocket');
  const headwearSocket = group('headwearSocket');
  const eyewearSocket = group('eyewearSocket', 0, faceY + p.headH * 0.012, headSurfaceZ(p, faceY) + inset * 0.25);
  const headAccessorySocket = group('headAccessorySocket', 0, p.headH * 0.42, -0.005);
  const eyeSocket = group('eyeSocket', 0, faceY, 0);
  const browSocket = group('browSocket', 0, browY, 0);
  const mouthSocket = group('mouthSocket', 0, mouthY, 0);
  const earSocketL = group('earSocketL', -p.headHalfW * 0.94, p.headH * 0.38, -0.012);
  const earSocketR = group('earSocketR', p.headHalfW * 0.94, p.headH * 0.38, -0.012);
  head.add(hairSocket, headwearSocket, eyewearSocket, headAccessorySocket, eyeSocket, browSocket, mouthSocket, earSocketL, earSocketR);

  // Brazos: clavícula → hombro → codo → mano, cada uno su propio pivote.
  const armY = p.torsoH * SHOULDER_T;
  const clavicleL = group('clavicleL', -p.shoulderHalf * 0.22, armY + 0.022);
  const clavicleR = group('clavicleR', p.shoulderHalf * 0.22, armY + 0.022);
  const shoulderL = group('shoulderL', -p.shoulderX + p.shoulderHalf * 0.22, -0.022);
  const shoulderR = group('shoulderR', p.shoulderX - p.shoulderHalf * 0.22, -0.022);
  const elbowL = group('elbowL', 0, -p.upperArm);
  const elbowR = group('elbowR', 0, -p.upperArm);
  const handL = group('handL', 0, -p.foreArm);
  const handR = group('handR', 0, -p.foreArm);
  const gripR = group('gripR', 0, -p.hand * 0.42, 0.012);
  shoulderL.add(elbowL); elbowL.add(handL);
  shoulderR.add(elbowR); elbowR.add(handR);
  handR.add(gripR);
  clavicleL.add(shoulderL); clavicleR.add(shoulderR);
  torso.add(clavicleL, clavicleR);

  // Piernas: cadera → rodilla → tobillo.
  const hipL = group('hipL', -p.hipX, 0);
  const hipR = group('hipR', p.hipX, 0);
  const kneeL = group('kneeL', 0, -p.thigh);
  const kneeR = group('kneeR', 0, -p.thigh);
  const ankleL = group('ankleL', 0, -p.shin);
  const ankleR = group('ankleR', 0, -p.shin);
  hipL.add(kneeL); kneeL.add(ankleL);
  hipR.add(kneeR); kneeR.add(ankleR);
  hips.add(hipL, hipR);

  return {
    root, hips, torso, chest, back, neck, head,
    hairSocket, headwearSocket, eyewearSocket, headAccessorySocket, eyeSocket, browSocket, mouthSocket, earSocketL, earSocketR,
    clavicleL, clavicleR, shoulderL, shoulderR, elbowL, elbowR, handL, handR, gripR,
    hipL, hipR, kneeL, kneeR, ankleL, ankleR,
  };
}


/**
 * =====================================================================
 *  RIG A PARTIR DEL ESQUELETO DEL MODELO
 * =====================================================================
 *  Cuando el personaje llega de Blender como malla con skin, el rig NO
 *  se inventa: se adopta el esqueleto del GLB. Cada hueso pasa a ocupar
 *  el sitio que antes tenía un grupo vacío, así que todo el código de
 *  animación y de cosméticos sigue funcionando sin cambios.
 *
 *  Esto funciona porque los huesos salen de Blender con sus ejes locales
 *  alineados con los del mundo. Lo garantiza `flatten_orientations` en
 *  assets/blender/lib/rig.py y lo comprueba tools/check-bone-axes.mjs.
 * =====================================================================
 */

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

/** Huesos sin los que el personaje no se puede animar, ya normalizados. */
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
 * Monta un ChibiRig sobre los huesos del modelo. Devuelve también los huesos
 * que falten: si el modelo se reexporta mal, preferimos un aviso claro a un
 * personaje que se mueve raro sin explicación.
 */
export function rigFromSkeleton(
  bones: Map<string, THREE.Bone>,
  modelRoot: THREE.Object3D,
  p: Proportions,
): SkeletonRig | null {
  const missing = REQUIRED_BONES.filter((name) => !bones.has(boneKey(name)));
  if (missing.length) return { rig: buildRig(p), missing };

  const root = group('chibi');
  root.add(modelRoot);

  const rig = { root } as ChibiRig;
  for (const [normalized, key] of Object.entries(BONE_LOOKUP)) {
    (rig as unknown as Record<string, THREE.Object3D>)[key] = bones.get(normalized)!;
  }

  // Puntos de anclaje de los cosméticos. Son grupos vacíos colgados del hueso
  // que les toca; como los huesos no están rotados, su posición local es
  // simplemente la diferencia de alturas respecto al hueso padre.
  const socket = (name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group => {
    const g = group(name, x, y, z);
    parent.add(g);
    return g;
  };

  const chestBone = rig.chest;
  // +Z es la espalda (el personaje mira hacia -Z).
  rig.back = socket('back', chestBone, 0, 0, p.chestHalf * 0.60);

  // La cabeza pivota en la barbilla, igual que en el rig procedural, así que
  // los desplazamientos de los rasgos son los mismos de siempre.
  const faceY = p.headH * 0.37;
  const browY = faceY + p.headH * 0.135;
  const mouthY = faceY - p.headH * 0.175;
  const inset = p.headHalfW * 0.11;
  rig.hairSocket = socket('hairSocket', rig.head);
  rig.headwearSocket = socket('headwearSocket', rig.head);
  rig.eyewearSocket = socket('eyewearSocket', rig.head, 0, faceY + p.headH * 0.012,
                             headSurfaceZ(p, faceY) + inset * 0.25);
  rig.headAccessorySocket = socket('headAccessorySocket', rig.head, 0, p.headH * 0.42, -0.005);
  rig.eyeSocket = socket('eyeSocket', rig.head, 0, faceY, 0);
  rig.browSocket = socket('browSocket', rig.head, 0, browY, 0);
  rig.mouthSocket = socket('mouthSocket', rig.head, 0, mouthY, 0);
  rig.earSocketL = socket('earSocketL', rig.head, -p.headHalfW * 0.94, p.headH * 0.38, -0.012);
  rig.earSocketR = socket('earSocketR', rig.head, p.headHalfW * 0.94, p.headH * 0.38, -0.012);

  // Punto de agarre del arma dentro de la mano derecha.
  rig.gripR = socket('gripR', rig.handR, 0, -p.hand * 0.42, 0.012);

  return { rig, missing: [] };
}
