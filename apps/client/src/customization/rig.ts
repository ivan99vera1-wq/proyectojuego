import * as THREE from 'three';
import { BODY_SLIDERS, GAMEPLAY } from '@game/config';
import type { AvatarConfig } from '@game/shared';
import { headSurfaceZ } from './profiles.js';

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

/** Medidas de referencia del personaje base, en metros. */
export const BASE = {
  /**
   * Reparto vertical. headH + neckH + torsoH + legLen = TOTAL.
   * IMPORTANTE: estos números deben coincidir con
   * `assets/blender/lib/proportions.py`, porque el modelo exportado desde
   * Blender trae el origen de cada pieza puesto en su articulación. Si aquí
   * y allí no coinciden, las piezas del GLB quedan descolocadas.
   */
  headH: 0.440,
  neckH: 0.022,
  torsoH: 0.268,
  legLen: 0.470,

  /** Semianchos del torso a distintas alturas (definen la silueta). */
  hipHalf: 0.122,
  waistHalf: 0.104,
  chestHalf: 0.140,
  shoulderHalf: 0.152,

  /** Cabeza. */
  headHalfW: 0.213,
  headHalfD: 0.196,

  /** Brazo: hombro → codo → muñeca → punta de la mano. */
  upperArm: 0.115,
  foreArm: 0.105,
  hand: 0.080,
  armRadius: 0.058,

  /** Pierna: cadera → rodilla → tobillo → suelo. */
  thigh: 0.215,
  shin: 0.170,
  ankleH: 0.085,
  thighRadius: 0.070,

  /** Separación de las articulaciones respecto al eje. */
  shoulderX: 0.163,
  hipX: 0.076,
} as const;

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
  const shoulder = hip + torsoH * 0.79;
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
      waist: hip + torsoH * 0.21,
      chest: hip + torsoH * 0.62,
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
  return deriveProportions({ headSize: 0.65, eyeSize: 0.5, bodyWidth: 0.5083, height: 0.55 });
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
  const chest = group('chest', 0, p.torsoH * 0.62, p.chestHalf * 0.62);
  const back = group('back', 0, p.torsoH * 0.58, -p.chestHalf * 0.60);
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
  const eyewearSocket = group('eyewearSocket', 0, faceY + p.headH * 0.012, headSurfaceZ(p, faceY) - inset * 0.25);
  const headAccessorySocket = group('headAccessorySocket', 0, p.headH * 0.42, -0.005);
  const eyeSocket = group('eyeSocket', 0, faceY, 0);
  const browSocket = group('browSocket', 0, browY, 0);
  const mouthSocket = group('mouthSocket', 0, mouthY, 0);
  const earSocketL = group('earSocketL', -p.headHalfW * 0.94, p.headH * 0.38, -0.012);
  const earSocketR = group('earSocketR', p.headHalfW * 0.94, p.headH * 0.38, -0.012);
  head.add(hairSocket, headwearSocket, eyewearSocket, headAccessorySocket, eyeSocket, browSocket, mouthSocket, earSocketL, earSocketR);

  // Brazos: hombro → codo → mano, cada uno su propio pivote.
  const armY = p.torsoH * 0.78;
  const shoulderL = group('shoulderL', -p.shoulderX, armY);
  const shoulderR = group('shoulderR', p.shoulderX, armY);
  const elbowL = group('elbowL', 0, -p.upperArm);
  const elbowR = group('elbowR', 0, -p.upperArm);
  const handL = group('handL', 0, -p.foreArm);
  const handR = group('handR', 0, -p.foreArm);
  const gripR = group('gripR', 0, -p.hand * 0.42, 0.012);
  shoulderL.add(elbowL); elbowL.add(handL);
  shoulderR.add(elbowR); elbowR.add(handR);
  handR.add(gripR);
  torso.add(shoulderL, shoulderR);

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
    shoulderL, shoulderR, elbowL, elbowR, handL, handR, gripR,
    hipL, hipR, kneeL, kneeR, ankleL, ankleR,
  };
}
