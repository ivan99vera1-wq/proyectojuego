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
function sleeve(c: PartContext, thickness: number, upperTo: number, lowerTo = 0, color?: string): void {
  const p = c.p;
  const mat = c.cloth(color ?? c.colors.primary);
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

/** Camiseta base: capa interior que cubre el torso y tapa la piel. */
function baseShirt(c: PartContext, color: string, sleeveTo: number, lowerTo = 0): void {
  const p = c.p, T = p.torsoH;
  attach(c.rig.torso, shell(torsoProfile(p), T * -0.10, T * 0.94, 0.012, 0.2), c.cloth(color));
  const mat = c.cloth(color);
  for (const shoulder of [c.rig.shoulderL, c.rig.shoulderR]) {
    attach(shoulder, shell(armUpperProfile(p), -p.upperArm * sleeveTo, 0.050, 0.011, 0.2), mat);
  }
  if (lowerTo > 0) {
    for (const elbow of [c.rig.elbowL, c.rig.elbowR]) {
      attach(elbow, shell(armLowerProfile(p), -p.foreArm * lowerTo, 0.018, 0.011, 0.2), mat);
    }
  }
  c.hide('torso');
  if (sleeveTo >= 0.95) c.hide('armUpper');
}

export const CLOTHING_PARTS: Partial<Record<CosmeticId, PartBuilder>> = {
  // --------------------------------------------- camisetas (capa interior)
  top_tee: (c) => baseShirt(c, c.colors.primary, 0.55),
  top_longsleeve: (c) => baseShirt(c, c.colors.primary, 1.0, 0.85),

  top_sailor: (c) => {
    const p = c.p, T = p.torsoH;
    baseShirt(c, shade(c.colors.primary, 0.72), 0.62);
    // Cuello marinero: solapa cuadrada sobre la espalda.
    const collar = place(loft([
      { y: 0, w: p.shoulderHalf * 0.62, d: p.chestHalf * 0.46, n: 3.8, crease: true },
      { y: T * 0.14, w: p.shoulderHalf * 0.78, d: p.chestHalf * 0.58, n: 3.4 },
    ], { segments: 16 }), 0, T * 0.78, -p.chestHalf * 0.24);
    attach(c.rig.torso, bakeAO(collar, 0.22), c.cloth(c.colors.secondary));
    const tie = place(loft([
      { y: 0, w: p.chestHalf * 0.06, d: p.chestHalf * 0.04, n: 2.6 },
      { y: -T * 0.20, w: p.chestHalf * 0.22, d: p.chestHalf * 0.10, n: 2.8, crease: true },
    ], { segments: 10 }), 0, T * 0.82, p.chestHalf * 0.70);
    attach(c.rig.torso, tie, c.cloth(c.colors.secondary));
  },

  // ------------------------------------------- chaquetas y chalecos (capa exterior)
  outer_hoodie: (c) => {
    const p = c.p, T = p.torsoH;
    const cloth = c.cloth(c.colors.primary);
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.14, T * 0.94, 0.020, 0.2), cloth);
    sleeve(c, 0.019, 1.0, 0.55);
    // Cuello alto: tapa la unión con la cabeza.
    const collar = place(loft([
      { y: 0, w: p.shoulderHalf * 0.52, d: p.shoulderHalf * 0.49, n: 2.6, crease: true },
      { y: T * 0.16, w: p.shoulderHalf * 0.54, d: p.shoulderHalf * 0.51, n: 2.6 },
    ], { segments: 16 }), 0, T * 0.94, -0.004);
    attach(c.rig.torso, bakeAO(collar, 0.2), c.cloth(shade(c.colors.primary, -0.08)));
    // Capucha caída sobre la espalda.
    const hood = place(blob(p.chestHalf * 0.96, T * 0.30, p.chestHalf * 0.62, 2.6, 14, 8), 0, T * 0.92, -p.chestHalf * 0.56, 0.35, 0, 0);
    attach(c.rig.torso, bakeAO(hood, 0.22), c.cloth(shade(c.colors.primary, -0.12)));
    // Bolsillo delantero y cordones: detalles que dicen "sudadera".
    const pocket = place(loft([
      { y: T * 0.16, w: p.waistHalf * 0.90, d: p.waistHalf * 0.84, n: 3.4, crease: true },
      { y: T * 0.34, w: p.waistHalf * 0.96, d: p.waistHalf * 0.88, n: 3.2 },
    ], { segments: 16 }), 0, 0, p.waistHalf * 0.18);
    attach(c.rig.torso, bakeAO(pocket, 0.2), c.cloth(shade(c.colors.primary, -0.18)));
    const cordMat = c.mat(shade(c.colors.secondary, 0.2));
    for (const s of [-1, 1]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(p.chestHalf * 0.035, p.chestHalf * 0.035, T * 0.22, 6), cordMat);
      cord.position.set(s * p.chestHalf * 0.22, T * 0.78, p.chestHalf * 0.62);
      c.rig.torso.add(cord);
    }
    c.hide('armUpper');
  },

  outer_jacket: (c) => {
    const p = c.p, T = p.torsoH;
    const color = shade(c.colors.primary, -0.18);
    const cloth = c.cloth(color, { roughness: 0.6 });
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.06, T * 0.92, 0.022, 0.5), cloth);
    sleeve(c, 0.021, 1.0, 0.95, color);
    // Solapas y cremallera: leen como chaqueta incluso en silueta.
    const lapelMat = c.cloth(shade(color, -0.22), { roughness: 0.6 });
    for (const s of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(p.chestHalf * 0.34, T * 0.44, p.chestHalf * 0.10), lapelMat);
      lapel.position.set(s * p.chestHalf * 0.30, T * 0.62, p.chestHalf * 0.72);
      lapel.rotation.z = s * 0.14;
      lapel.castShadow = true;
      c.rig.torso.add(lapel);
    }
    const zip = new THREE.Mesh(new THREE.BoxGeometry(p.chestHalf * 0.07, T * 0.90, p.chestHalf * 0.06), c.mat(shade(c.colors.secondary, 0.2), { metalness: 0.6, roughness: 0.3 }));
    zip.position.set(0, T * 0.44, p.chestHalf * 0.76);
    c.rig.torso.add(zip);
    const cuffMat = c.cloth(shade(color, -0.35));
    for (const elbow of [c.rig.elbowL, c.rig.elbowR]) {
      attach(elbow, shell(armLowerProfile(p), -p.foreArm, -p.foreArm * 0.84, 0.026, 0.5), cuffMat);
    }
    c.hide('armUpper');
  },

  outer_vest_tactical: (c) => {
    const p = c.p, T = p.torsoH;
    // Chaleco: capa gruesa y angulosa que ensancha el pecho.
    const vestColor = shade(c.colors.secondary, -0.5);
    attach(c.rig.torso, shell(torsoProfile(p), T * 0.10, T * 0.88, 0.030, 0.9), c.cloth(vestColor, { roughness: 0.85 }));
    const pouchMat = c.cloth(shade(c.colors.secondary, -0.66), { roughness: 0.9 });
    for (const s of [-1, 1]) {
      const pouch = place(loft([
        { y: 0, w: p.chestHalf * 0.30, d: p.chestHalf * 0.16, n: 4.0, crease: true },
        { y: T * 0.16, w: p.chestHalf * 0.32, d: p.chestHalf * 0.18, n: 4.0 },
      ], { segments: 12 }), s * p.chestHalf * 0.46, T * 0.30, p.chestHalf * 0.78);
      attach(c.rig.torso, bakeAO(pouch, 0.2), pouchMat);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(p.shoulderHalf * 0.34, T * 0.10, p.shoulderHalf * 0.96), pouchMat);
      strap.position.set(s * p.shoulderHalf * 0.58, T * 0.88, 0);
      strap.castShadow = true;
      c.rig.torso.add(strap);
    }
    // Radio al hombro.
    const radio = new THREE.Mesh(new THREE.BoxGeometry(p.chestHalf * 0.20, T * 0.22, p.chestHalf * 0.14), pouchMat);
    radio.position.set(-p.chestHalf * 0.62, T * 0.74, p.chestHalf * 0.40);
    radio.castShadow = true;
    c.rig.torso.add(radio);
  },

  // ----------------------------------------------------------- piernas
  bottom_cargo: (c) => {
    const p = c.p, T = p.torsoH;
    const color = shade(c.colors.secondary, -0.35);
    const mat = c.cloth(color, { roughness: 0.9 });
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.18, T * 0.26, 0.011, 0.4), mat);
    trouserLegs(c, color, 0.016, 1.0, 1.0);
    // Bolsillos cargo laterales: volumen reconocible en la silueta.
    const pocketMat = c.cloth(shade(color, -0.14), { roughness: 0.92 });
    for (const [hip, s] of [[c.rig.hipL, -1], [c.rig.hipR, 1]] as const) {
      const pocket = place(loft([
        { y: -p.thigh * 0.62, w: p.thighRadius * 0.40, d: p.thighRadius * 0.52, n: 4.0, crease: true },
        { y: -p.thigh * 0.34, w: p.thighRadius * 0.44, d: p.thighRadius * 0.56, n: 4.0 },
      ], { segments: 12 }), s * p.thighRadius * 0.96, 0, 0);
      attach(hip, bakeAO(pocket, 0.2), pocketMat);
    }
    belt(c, shade(color, -0.5));
    c.hide('legUpper', 'legLower');
  },

  bottom_jeans: (c) => {
    const p = c.p, T = p.torsoH;
    const color = shade(c.colors.secondary, -0.55);
    const mat = c.cloth(color, { roughness: 0.85 });
    attach(c.rig.torso, shell(torsoProfile(p), T * -0.18, T * 0.24, 0.011, 0.4), mat);
    trouserLegs(c, color, 0.013, 1.0, 1.0);
    belt(c, shade(color, 0.25));
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

  shoes_hightops: (c) => {
    const p = c.p;
    const upper = c.cloth(shade(c.colors.primary, 0.35));
    const sole = c.cloth('#f0f2f6', { roughness: 0.6 });
    for (const ankle of [c.rig.ankleL, c.rig.ankleR]) {
      attach(ankle, shell(footProfile(p), -p.ankleH * 0.80, 0.034, 0.013, 0.2, false), upper);
      attach(ankle, shell(footProfile(p), -p.ankleH - 0.012, -p.ankleH * 0.62, 0.020, 0.5, false), sole);
    }
    // Caña alta: sube por encima del tobillo.
    for (const knee of [c.rig.kneeL, c.rig.kneeR]) {
      attach(knee, shell(legLowerProfile(p), -p.shin, -p.shin * 0.74, 0.020, 0.3), upper);
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
  hands_gloves: (c) => { glove(c, 1.0); c.hide('hand'); },
  hands_fingerless: (c) => { glove(c, 0.62); },

  // ---------------------------------------------------------- espalda
  back_backpack: (c) => {
    const p = c.p, T = p.torsoH;
    const mat = c.cloth(shade(c.colors.secondary, -0.4), { roughness: 0.9 });
    const bag = place(loft([
      { y: -T * 0.20, w: p.chestHalf * 0.78, d: p.chestHalf * 0.36, n: 4.0, crease: true },
      { y: -T * 0.05, w: p.chestHalf * 0.88, d: p.chestHalf * 0.44, n: 3.6 },
      { y: T * 0.22, w: p.chestHalf * 0.86, d: p.chestHalf * 0.44, n: 3.6 },
      { y: T * 0.32, w: p.chestHalf * 0.72, d: p.chestHalf * 0.36, n: 3.8 },
    ], { segments: 16 }), 0, 0, -p.chestHalf * 0.50);
    attach(c.rig.back, bakeAO(bag, 0.24), mat);
    const strapMat = c.cloth(shade(c.colors.secondary, -0.62), { roughness: 0.9 });
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(p.shoulderHalf * 0.26, T * 0.62, p.chestHalf * 0.22), strapMat);
      strap.position.set(s * p.shoulderHalf * 0.50, T * 0.58, p.chestHalf * 0.52);
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
      ], { segments: 12 }), s * p.chestHalf * 0.62, T * 0.10, -p.chestHalf * 0.34, 0, s * 0.55, s * 0.30);
      attach(c.rig.back, bakeAO(wing, 0.18), mat);
    }
  },

  // -------------------------------------------------------- accesorios
  accessory_scarf: (c) => {
    const p = c.p, T = p.torsoH;
    const mat = c.cloth(c.colors.primary, { roughness: 0.92 });
    const collar = place(loft([
      { y: -0.012, w: p.shoulderHalf * 0.54, d: p.shoulderHalf * 0.50, n: 2.8, crease: true },
      { y: 0.016, w: p.shoulderHalf * 0.60, d: p.shoulderHalf * 0.56, n: 2.6 },
      { y: 0.044, w: p.shoulderHalf * 0.56, d: p.shoulderHalf * 0.52, n: 2.6, crease: true },
    ], { segments: 16 }), 0, T * 0.98, 0);
    attach(c.rig.torso, bakeAO(collar, 0.24), mat);
    const tail = place(loft([
      { y: -T * 0.48, w: p.chestHalf * 0.22, d: p.chestHalf * 0.09, n: 3.2, crease: true },
      { y: -T * 0.20, w: p.chestHalf * 0.24, d: p.chestHalf * 0.10, n: 3.0 },
      { y: 0, w: p.chestHalf * 0.20, d: p.chestHalf * 0.09, n: 3.0 },
    ], { segments: 12 }), p.chestHalf * 0.34, T * 0.92, p.chestHalf * 0.60, 0.16, 0, 0.12);
    attach(c.rig.torso, bakeAO(tail, 0.22), mat);
  },

  accessory_mask: (c) => {
    // Braga de cuello: sube hasta media cara, engancha al cuello (no a la cabeza)
    // para que gire con el torso como una prenda real.
    const p = c.p, T = p.torsoH;
    const mat = c.cloth(shade(c.colors.secondary, -0.45), { roughness: 0.92 });
    const tube = place(loft([
      { y: 0, w: p.shoulderHalf * 0.58, d: p.shoulderHalf * 0.54, n: 2.8, crease: true },
      { y: 0.045, w: p.shoulderHalf * 0.50, d: p.shoulderHalf * 0.47, n: 2.6 },
      { y: 0.090, w: p.shoulderHalf * 0.52, d: p.shoulderHalf * 0.50, n: 2.6, crease: true },
    ], { segments: 16 }), 0, T * 0.96, 0);
    attach(c.rig.torso, bakeAO(tube, 0.22), mat);
  },
};

/** Cinturón en la cintura, común a varios pantalones. */
function belt(c: PartContext, color: string): void {
  const p = c.p, T = p.torsoH;
  const b = new THREE.Mesh(new THREE.TorusGeometry(p.waistHalf * 1.02, p.waistHalf * 0.10, 6, 20), c.mat(color));
  b.rotation.x = Math.PI / 2;
  b.scale.set(1, 0.76, 1);
  b.position.y = T * 0.22;
  c.rig.torso.add(b);
}

/** Guante sobre la mano; `coverage` 1 = dedos cubiertos, < 1 = sin dedos. */
function glove(c: PartContext, coverage: number): void {
  const p = c.p;
  const mat = c.cloth(shade(c.colors.secondary, -0.55), { roughness: 0.8 });
  for (const [hand, s] of [[c.rig.handL, -1], [c.rig.handR, 1]] as const) {
    attach(hand, shell(handProfile(p), -p.hand * coverage, 0.010, 0.008, 0.3, false), mat);
    const thumb = place(loft([
      { y: 0, w: p.armRadius * 0.30, d: p.armRadius * 0.28, n: 2.6 },
      { y: -p.armRadius * 0.48 * coverage, w: p.armRadius * 0.28, d: p.armRadius * 0.26, n: 2.6 },
      { y: -p.armRadius * 0.76 * coverage, w: p.armRadius * 0.16, d: p.armRadius * 0.16, n: 2.6 },
    ], { segments: 8 }), -s * p.armRadius * 0.60, -p.hand * 0.24, p.armRadius * 0.18, 0, 0, s * 0.75);
    attach(hand, bakeAO(thumb, 0.2), mat);
    const cuff = place(loft([
      { y: 0.004, w: p.armRadius * 0.66, d: p.armRadius * 0.58, n: 3.0 },
      { y: 0.026, w: p.armRadius * 0.70, d: p.armRadius * 0.62, n: 3.0, crease: true },
    ], { segments: 12 }), 0, 0, 0);
    attach(hand, bakeAO(cuff, 0.2), c.cloth(shade(c.colors.secondary, -0.32)));
  }
}
