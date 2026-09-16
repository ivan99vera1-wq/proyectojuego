import * as THREE from 'three';
import type { CosmeticId } from '@game/config';
import { bakeAO, blob, loft, place, type Ring } from '../geometry.js';
import {
  armLowerProfile, armUpperProfile, footProfile, handProfile, inflateProfile,
  legLowerProfile, legUpperProfile, sliceProfile, torsoProfile,
} from '../profiles.js';
import { attach, shade, type PartBuilder, type PartContext } from '../context.js';

/**
 * =====================================================================
 *  ROPA Y ACCESORIOS
 * =====================================================================
 *  Cada prenda es una CAPA construida sobre el perfil del cuerpo:
 *  se recorta el tramo que cubre, se infla el grosor de la tela y se
 *  añaden los detalles que le dan carácter (capucha, bolsillos, suela).
 *
 *  Por eso una chaqueta ensancha de verdad los hombros y unas botas
 *  cambian la silueta del pie: no son un cambio de color.
 * =====================================================================
 */

type Profile = Ring[];

/** Capa de tela sobre un tramo del cuerpo, con dobladillo marcado abajo. */
function shell(profile: Profile, yMin: number, yMax: number, thickness: number, nBoost = 0, hem = true): THREE.BufferGeometry {
  const rings = inflateProfile(sliceProfile(profile, yMin, yMax), thickness, nBoost);
  if (hem && rings.length > 1) rings[0] = { ...rings[0]!, crease: true };
  return bakeAO(loft(rings, { segments: 20 }), 0.22);
}

/** Manga: cubre el brazo desde el hombro hasta la fracción indicada. */
function sleeve(c: PartContext, thickness: number, upperTo: number, lowerTo = 0): void {
  const p = c.p;
  const mat = c.cloth(c.colors.primary);
  for (const shoulder of [c.rig.shoulderL, c.rig.shoulderR]) {
    attach(shoulder, shell(armUpperProfile(p), -p.upperArm * upperTo, 0.050, thickness, 0.2), mat);
  }
  if (lowerTo > 0) {
    for (const elbow of [c.rig.elbowL, c.rig.elbowR]) {
      attach(elbow, shell(armLowerProfile(p), -p.foreArm * lowerTo, 0.018, thickness, 0.2), mat);
    }
  }
}

/** Pernera: cubre la pierna desde la cadera hasta la fracción indicada. */
function trouserLegs(c: PartContext, color: string, thickness: number, upperTo: number, lowerTo: number): void {
  const p = c.p;
  const mat = c.cloth(color);
  for (const hip of [c.rig.hipL, c.rig.hipR]) {
    attach(hip, shell(legUpperProfile(p), -p.thigh * upperTo, 0.032, thickness, 0.3), mat);
  }
  if (lowerTo > 0) {
    for (const knee of [c.rig.kneeL, c.rig.kneeR]) {
      attach(knee, shell(legLowerProfile(p), -p.shin * lowerTo, 0.026, thickness, 0.3), mat);
    }
  }
}

export const CLOTHING_PARTS: Partial<Record<CosmeticId, PartBuilder>> = {
  // ------------------------------------------------------------- torso
  top_hoodie: (c) => {
    const p = c.p, T = p.torsoH;
    const cloth = c.cloth(c.colors.primary);
    const body = shell(torsoProfile(p), T * -0.14, T * 0.94, 0.016, 0.2);
    attach(c.rig.torso, body, cloth);
    sleeve(c, 0.011, 1.0, 0.55);
    // Cuello alto: tapa la unión con la cabeza.
    const collar = place(loft([
      { y: 0, w: p.shoulderHalf * 0.50, d: p.shoulderHalf * 0.47, n: 2.6, crease: true },
      { y: T * 0.16, w: p.shoulderHalf * 0.52, d: p.shoulderHalf * 0.49, n: 2.6 },
    ], { segments: 16 }), 0, T * 0.94, -0.004);
    attach(c.rig.torso, bakeAO(collar, 0.2), c.cloth(shade(c.colors.primary, -0.08)));
    // Capucha caída sobre la espalda.
    const hood = place(blob(p.chestHalf * 0.96, T * 0.30, p.chestHalf * 0.62, 2.6, 14, 8), 0, T * 0.92, -p.chestHalf * 0.52, 0.35, 0, 0);
    attach(c.rig.torso, bakeAO(hood, 0.22), c.cloth(shade(c.colors.primary, -0.12)));
    // Bolsillo delantero y cordones: detalles que dicen "sudadera".
    const pocket = place(loft([
      { y: T * 0.16, w: p.waistHalf * 0.86, d: p.waistHalf * 0.80, n: 3.4, crease: true },
      { y: T * 0.34, w: p.waistHalf * 0.92, d: p.waistHalf * 0.84, n: 3.2 },
    ], { segments: 16 }), 0, 0, p.waistHalf * 0.18);
    attach(c.rig.torso, bakeAO(pocket, 0.2), c.cloth(shade(c.colors.primary, -0.18)));
    const cordMat = c.mat(shade(c.colors.secondary, 0.2));
    for (const s of [-1, 1]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(p.chestHalf * 0.035, p.chestHalf * 0.035, T * 0.22, 6), cordMat);
      cord.position.set(s * p.chestHalf * 0.22, T * 0.78, p.chestHalf * 0.60);
      c.rig.torso.add(cord);
    }
    c.hide('torso', 'armUpper');
  },

  top_tactical_vest: (c) => {
    const p = c.p, T = p.torsoH;
    const base = c.cloth(c.colors.primary);
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.12, T * 0.94, 0.012, 0.2), base);
    sleeve(c, 0.010, 0.55);
    // Chaleco: capa gruesa y angulosa que ensancha el pecho.
    const vestColor = shade(c.colors.secondary, -0.5);
    const vest = shell(torsoProfile(p), T * 0.12, T * 0.88, 0.030, 0.9);
    attach(c.rig.torso, vest, c.cloth(vestColor, { roughness: 0.85 }));
    // Bolsas frontales y hombreras.
    const pouchMat = c.cloth(shade(c.colors.secondary, -0.66), { roughness: 0.9 });
    for (const s of [-1, 1]) {
      const pouch = place(loft([
        { y: 0, w: p.chestHalf * 0.30, d: p.chestHalf * 0.16, n: 4.0, crease: true },
        { y: T * 0.16, w: p.chestHalf * 0.32, d: p.chestHalf * 0.18, n: 4.0 },
      ], { segments: 12 }), s * p.chestHalf * 0.46, T * 0.30, p.chestHalf * 0.72);
      attach(c.rig.torso, bakeAO(pouch, 0.2), pouchMat);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(p.shoulderHalf * 0.34, T * 0.10, p.shoulderHalf * 0.92), pouchMat);
      strap.position.set(s * p.shoulderHalf * 0.56, T * 0.86, 0);
      strap.castShadow = true;
      c.rig.torso.add(strap);
    }
    c.hide('torso');
  },

  top_sailor: (c) => {
    const p = c.p, T = p.torsoH;
    const white = c.cloth(shade(c.colors.primary, 0.72));
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.10, T * 0.94, 0.015, 0.2), white);
    sleeve(c, 0.011, 0.62);
    // Cuello marinero: solapa cuadrada sobre la espalda.
    const collar = place(loft([
      { y: 0, w: p.shoulderHalf * 0.86, d: p.chestHalf * 0.60, n: 3.8, crease: true },
      { y: T * 0.16, w: p.shoulderHalf * 1.02, d: p.chestHalf * 0.74, n: 3.4 },
    ], { segments: 16 }), 0, T * 0.78, -p.chestHalf * 0.24);
    attach(c.rig.torso, bakeAO(collar, 0.22), c.cloth(c.colors.secondary));
    const tie = place(loft([
      { y: 0, w: p.chestHalf * 0.06, d: p.chestHalf * 0.04, n: 2.6 },
      { y: -T * 0.20, w: p.chestHalf * 0.22, d: p.chestHalf * 0.10, n: 2.8, crease: true },
    ], { segments: 10 }), 0, T * 0.82, p.chestHalf * 0.70);
    attach(c.rig.torso, tie, c.cloth(c.colors.secondary));
    c.hide('torso');
  },

  // ----------------------------------------------------------- piernas
  bottom_cargo: (c) => {
    const p = c.p, T = p.torsoH;
    const color = shade(c.colors.secondary, -0.35);
    const mat = c.cloth(color, { roughness: 0.9 });
    // La cadera va por debajo de la prenda de torso para que la sudadera caiga encima.
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.18, T * 0.26, 0.011, 0.4), mat);
    trouserLegs(c, color, 0.016, 1.0, 1.0);
    // Bolsillos cargo laterales: volumen reconocible en la silueta.
    const pocketMat = c.cloth(shade(color, -0.14), { roughness: 0.92 });
    for (const [hip, s] of [[c.rig.hipL, -1], [c.rig.hipR, 1]] as const) {
      const pocket = place(loft([
        { y: -p.thigh * 0.62, w: p.thighRadius * 0.40, d: p.thighRadius * 0.52, n: 4.0, crease: true },
        { y: -p.thigh * 0.34, w: p.thighRadius * 0.44, d: p.thighRadius * 0.56, n: 4.0 },
      ], { segments: 12 }), s * p.thighRadius * 0.92, 0, 0);
      attach(hip, bakeAO(pocket, 0.2), pocketMat);
    }
    // Cinturón.
    const belt = new THREE.Mesh(new THREE.TorusGeometry(p.waistHalf * 1.02, p.waistHalf * 0.10, 6, 20), c.mat(shade(color, -0.5)));
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1, 0.76, 1);
    belt.position.y = T * 0.22;
    c.rig.torso.add(belt);
    c.hide('legUpper', 'legLower');
  },

  bottom_shorts: (c) => {
    const p = c.p, T = p.torsoH;
    const color = shade(c.colors.secondary, -0.2);
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.18, T * 0.24, 0.011, 0.4), c.cloth(color));
    trouserLegs(c, color, 0.018, 0.52, 0);
    c.hide('legUpper');
  },

  bottom_skirt: (c) => {
    const p = c.p, T = p.torsoH;
    const mat = c.cloth(c.colors.secondary);
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.10, T * 0.24, 0.011, 0.4), mat);
    // Falda acampanada: se abre hacia abajo y marca la silueta.
    const skirt = loft([
      { y: T * 0.20, w: p.waistHalf + 0.012, d: p.waistHalf * 0.78, n: 3.0 },
      { y: T * 0.02, w: p.hipHalf * 1.10, d: p.hipHalf * 0.86, n: 2.9 },
      { y: -T * 0.30, w: p.hipHalf * 1.46, d: p.hipHalf * 1.14, n: 2.8 },
      { y: -T * 0.40, w: p.hipHalf * 1.52, d: p.hipHalf * 1.18, n: 2.8, crease: true },
    ].reverse(), { segments: 22, capBottom: false });
    attach(c.rig.torso, bakeAO(skirt, 0.24), mat);
  },

  // ----------------------------------------------------------- calzado
  shoes_sneakers: (c) => {
    const p = c.p;
    const upper = c.cloth(shade(c.colors.primary, 0.55));
    const sole = c.cloth('#dfe4ec', { roughness: 0.65 });
    const accent = c.mat(c.colors.secondary);
    for (const ankle of [c.rig.ankleL, c.rig.ankleR]) {
      attach(ankle, shell(footProfile(p), -p.ankleH * 0.80, 0.030, 0.011, 0.2, false), upper);
      // Suela gruesa con arista dura: la zapatilla se lee de lejos.
      attach(ankle, shell(footProfile(p), -p.ankleH - 0.010, -p.ankleH * 0.66, 0.017, 0.5, false), sole);
      const tongue = place(blob(p.thighRadius * 0.40, p.ankleH * 0.28, p.thighRadius * 0.16, 3.0, 10, 6),
        0, p.ankleH * 0.06, p.thighRadius * 0.52);
      attach(ankle, tongue, accent);
    }
    c.hide('foot');
  },

  shoes_boots: (c) => {
    const p = c.p;
    const leather = c.cloth(shade(c.colors.secondary, -0.6), { roughness: 0.85 });
    const sole = c.cloth('#2a2d34', { roughness: 0.95 });
    for (const ankle of [c.rig.ankleL, c.rig.ankleR]) {
      attach(ankle, shell(footProfile(p), -p.ankleH * 0.78, 0.034, 0.016, 0.4, false), leather);
      attach(ankle, shell(footProfile(p), -p.ankleH - 0.012, -p.ankleH * 0.62, 0.021, 0.6, false), sole);
    }
    // Caña de la bota sobre la parte baja de la pantorrilla.
    for (const knee of [c.rig.kneeL, c.rig.kneeR]) {
      attach(knee, shell(legLowerProfile(p), -p.shin, -p.shin * 0.58, 0.020, 0.4), leather);
      const cuff = place(loft([
        { y: -p.shin * 0.62, w: p.thighRadius * 0.74, d: p.thighRadius * 0.73, n: 2.8, crease: true },
        { y: -p.shin * 0.52, w: p.thighRadius * 0.78, d: p.thighRadius * 0.77, n: 2.8 },
      ], { segments: 14 }), 0, 0, 0);
      attach(knee, bakeAO(cuff, 0.2), c.cloth(shade(c.colors.secondary, -0.38)));
    }
    c.hide('foot');
  },

  // ------------------------------------------------------------ manos
  hands_gloves: (c) => {
    const p = c.p;
    const mat = c.cloth(shade(c.colors.secondary, -0.55), { roughness: 0.8 });
    for (const [hand, s] of [[c.rig.handL, -1], [c.rig.handR, 1]] as const) {
      attach(hand, shell(handProfile(p), -p.hand, 0.010, 0.008, 0.3, false), mat);
      // Pulgar enguantado y puño.
      const thumb = place(loft([
        { y: 0, w: p.armRadius * 0.30, d: p.armRadius * 0.28, n: 2.6 },
        { y: -p.armRadius * 0.48, w: p.armRadius * 0.28, d: p.armRadius * 0.26, n: 2.6 },
        { y: -p.armRadius * 0.76, w: p.armRadius * 0.16, d: p.armRadius * 0.16, n: 2.6 },
      ], { segments: 8 }), -s * p.armRadius * 0.60, -p.hand * 0.24, p.armRadius * 0.18, 0, 0, s * 0.75);
      attach(hand, bakeAO(thumb, 0.2), mat);
      const cuff = place(loft([
        { y: 0.004, w: p.armRadius * 0.66, d: p.armRadius * 0.58, n: 3.0 },
        { y: 0.026, w: p.armRadius * 0.70, d: p.armRadius * 0.62, n: 3.0, crease: true },
      ], { segments: 12 }), 0, 0, 0);
      attach(hand, bakeAO(cuff, 0.2), c.cloth(shade(c.colors.secondary, -0.32)));
    }
    c.hide('hand');
  },

  // ---------------------------------------------------------- espalda
  back_backpack: (c) => {
    const p = c.p, T = p.torsoH;
    const mat = c.cloth(shade(c.colors.secondary, -0.4), { roughness: 0.9 });
    const bag = place(loft([
      { y: -T * 0.20, w: p.chestHalf * 0.78, d: p.chestHalf * 0.36, n: 4.0, crease: true },
      { y: -T * 0.05, w: p.chestHalf * 0.88, d: p.chestHalf * 0.44, n: 3.6 },
      { y: T * 0.22, w: p.chestHalf * 0.86, d: p.chestHalf * 0.44, n: 3.6 },
      { y: T * 0.32, w: p.chestHalf * 0.72, d: p.chestHalf * 0.36, n: 3.8 },
    ], { segments: 16 }), 0, 0, -p.chestHalf * 0.42);
    attach(c.rig.back, bakeAO(bag, 0.24), mat);
    const strapMat = c.cloth(shade(c.colors.secondary, -0.62), { roughness: 0.9 });
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(p.shoulderHalf * 0.26, T * 0.62, p.chestHalf * 0.22), strapMat);
      strap.position.set(s * p.shoulderHalf * 0.50, T * 0.58, p.chestHalf * 0.46);
      strap.rotation.x = -0.12;
      strap.castShadow = true;
      c.rig.torso.add(strap);
    }
  },

  back_wings: (c) => {
    const p = c.p, T = p.torsoH;
    const mat = c.cloth('#ffffff', { transparent: true, opacity: 0.92, roughness: 0.4, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const wing = place(loft([
        { y: -T * 0.34, w: p.chestHalf * 0.24, d: p.chestHalf * 0.10, n: 2.4 },
        { y: 0, w: p.chestHalf * 0.86, d: p.chestHalf * 0.16, n: 2.2 },
        { y: T * 0.34, w: p.chestHalf * 0.62, d: p.chestHalf * 0.12, n: 2.2 },
        { y: T * 0.54, w: p.chestHalf * 0.16, d: p.chestHalf * 0.06, n: 2.2 },
      ], { segments: 12 }), s * p.chestHalf * 0.62, T * 0.10, -p.chestHalf * 0.30, 0, s * 0.55, s * 0.30);
      attach(c.rig.back, bakeAO(wing, 0.18), mat);
    }
  },

  // -------------------------------------------------------- accesorio
  accessory_scarf: (c) => {
    const p = c.p, T = p.torsoH;
    const mat = c.cloth(c.colors.primary, { roughness: 0.92 });
    const collar = place(loft([
      { y: -0.012, w: p.shoulderHalf * 0.50, d: p.shoulderHalf * 0.46, n: 2.8, crease: true },
      { y: 0.016, w: p.shoulderHalf * 0.56, d: p.shoulderHalf * 0.52, n: 2.6 },
      { y: 0.044, w: p.shoulderHalf * 0.52, d: p.shoulderHalf * 0.48, n: 2.6, crease: true },
    ], { segments: 16 }), 0, T * 0.98, 0);
    attach(c.rig.torso, bakeAO(collar, 0.24), mat);
    const tail = place(loft([
      { y: -T * 0.48, w: p.chestHalf * 0.22, d: p.chestHalf * 0.09, n: 3.2, crease: true },
      { y: -T * 0.20, w: p.chestHalf * 0.24, d: p.chestHalf * 0.10, n: 3.0 },
      { y: 0, w: p.chestHalf * 0.20, d: p.chestHalf * 0.09, n: 3.0 },
    ], { segments: 12 }), p.chestHalf * 0.34, T * 0.92, p.chestHalf * 0.56, 0.16, 0, 0.12);
    attach(c.rig.torso, bakeAO(tail, 0.22), mat);
  },
};
