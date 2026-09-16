import * as THREE from 'three';
import type { CosmeticId } from '@game/config';
import { bakeAO, loft, merge, place, type Ring } from '../geometry.js';
import { headProfile, inflateProfile, sliceProfile } from '../profiles.js';
import { attach, shade, type PartBuilder, type PartContext } from '../context.js';

/**
 * =====================================================================
 *  PELO, GORROS, GAFAS Y ACCESORIOS DE CABEZA
 * =====================================================================
 *  Se construyen inflando el perfil del cráneo: cada pieza se apoya en la
 *  cabeza real y cambia la silueta de una forma distinta. Ese es el
 *  criterio de aceptación: Pelo A ≠ Pelo B también en negro.
 * =====================================================================
 */

/** Casquete que sigue la forma del cráneo entre dos alturas relativas. */
function skullCap(c: PartContext, from: number, to: number, inflate: number, nBoost = 0): THREE.BufferGeometry {
  const H = c.p.headH;
  const rings = inflateProfile(sliceProfile(headProfile(c.p), H * from, H * to), inflate, nBoost);
  // El borde inferior se afina: el pelo se funde con la cabeza en vez de
  // terminar en un corte recto de casco.
  if (rings.length > 1) {
    rings[0] = { ...rings[0]!, w: rings[0]!.w - inflate * 0.55, d: (rings[0]!.d ?? rings[0]!.w) - inflate * 0.55 };
  }
  return bakeAO(loft(rings, { segments: 24 }), 0.20);
}

/**
 * Nuca: cubre la parte trasera y baja de la cabeza. Se consigue colapsando la
 * mitad delantera de los anillos (`front` casi 0), que queda dentro del cráneo
 * y por tanto invisible, dejando solo la concha trasera.
 */
function nape(c: PartContext, from: number, to: number, inflate: number): THREE.BufferGeometry {
  const H = c.p.headH;
  const rings = inflateProfile(sliceProfile(headProfile(c.p), H * from, H * to), inflate)
    .map((r, i) => ({ ...r, front: 0.08, crease: i === 0 }));
  return bakeAO(loft(rings, { segments: 20 }), 0.2);
}

/** Patillas: bajan el pelo por delante de las orejas y rompen la línea recta. */
function sideburns(c: PartContext, from: number, to: number, inflate: number): THREE.BufferGeometry[] {
  const H = c.p.headH, W = c.p.headHalfW, D = c.p.headHalfD;
  return [-1, 1].map((s) => place(loft([
    { y: H * from, w: W * 0.13, d: D * 0.30, n: 2.6, crease: true },
    { y: H * (from + to) / 2, w: W * 0.16, d: D * 0.40, n: 2.6 },
    { y: H * to, w: W * 0.17, d: D * 0.44, n: 2.6 },
  ], { segments: 10 }), s * (W * 0.86 + inflate), 0, -D * 0.04));
}

/** Mechón cónico ligeramente curvado. */
function strand(len: number, r: number, bend = 0.3): THREE.BufferGeometry {
  const rings: Ring[] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    rings.push({ y: len * t, w: r * (1 - t * 0.92), d: r * (1 - t * 0.92), n: 2.4, z: bend * len * t * t });
  }
  return loft(rings, { segments: 8 });
}

export const HAIR_PARTS: Partial<Record<CosmeticId, PartBuilder>> = {
  // ------------------------------------------------------------- pelo
  hair_spiky: (c) => {
    const m = c.cloth(c.colors.hair);
    const H = c.p.headH, W = c.p.headHalfW, D = c.p.headHalfD;
    const cap = skullCap(c, 0.53, 1.0, 0.016);
    const spikes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const rad = W * 0.66;
      const tilt = 0.55;
      spikes.push(place(strand(H * 0.34, W * 0.135, 0.12),
        Math.cos(a) * rad, H * 0.82, Math.sin(a) * rad * 0.95,
        Math.sin(a) * tilt, 0, -Math.cos(a) * tilt));
    }
    // Flequillo en pico: evita el corte horizontal de "casco" en la frente.
    const fringe = place(loft([
      { y: H * 0.47, w: W * 0.26, d: D * 0.22, n: 2.4, z: D * 0.56, crease: true },
      { y: H * 0.55, w: W * 0.62, d: D * 0.34, n: 2.8, z: D * 0.50 },
      { y: H * 0.65, w: W * 0.80, d: D * 0.44, n: 2.8, z: D * 0.42 },
    ], { segments: 14 }), 0, 0, 0);
    const tufts = [-1, 1].map((s) => place(loft([
      { y: H * 0.49, w: W * 0.14, d: D * 0.18, n: 2.4, crease: true },
      { y: H * 0.60, w: W * 0.24, d: D * 0.28, n: 2.6 },
    ], { segments: 10 }), s * W * 0.72, 0, D * 0.30));
    attach(c.rig.hairSocket, bakeAO(merge([cap, fringe, ...tufts, ...sideburns(c, 0.34, 0.58, 0.016), nape(c, 0.18, 0.56, 0.015), ...spikes]), 0.2), m);
  },

  hair_buzz: (c) => {
    // Rapado: pegado al cráneo, silueta casi limpia pero con hairline marcada.
    const m = c.cloth(c.colors.hair, { roughness: 0.95 });
    attach(c.rig.hairSocket, bakeAO(merge([
      skullCap(c, 0.46, 1.0, 0.007),
      nape(c, 0.16, 0.50, 0.006),
      ...sideburns(c, 0.30, 0.50, 0.006),
    ]), 0.2), m);
  },

  hair_bob: (c) => {
    const m = c.cloth(c.colors.hair);
    const H = c.p.headH, W = c.p.headHalfW, D = c.p.headHalfD;
    const cap = skullCap(c, 0.34, 1.0, 0.018);
    // Melena: dos paneles que enmarcan la cara y bajan hasta la mandíbula.
    const sides = [-1, 1].map((s) => place(loft([
      { y: H * 0.10, w: W * 0.16, d: D * 0.50, n: 2.8, z: -D * 0.06 },
      { y: H * 0.26, w: W * 0.19, d: D * 0.62, n: 2.6, z: -D * 0.04 },
      { y: H * 0.46, w: W * 0.20, d: D * 0.66, n: 2.6 },
      { y: H * 0.62, w: W * 0.17, d: D * 0.58, n: 2.6 },
    ], { segments: 12 }), s * W * 0.90, 0, 0));
    // Flequillo recto sobre la frente.
    const fringe = place(loft([
      { y: H * 0.45, w: W * 0.72, d: D * 0.34, n: 3.2, z: D * 0.52, crease: true },
      { y: H * 0.58, w: W * 0.82, d: D * 0.40, n: 3.0, z: D * 0.46 },
      { y: H * 0.68, w: W * 0.80, d: D * 0.42, n: 3.0, z: D * 0.40 },
    ], { segments: 14 }), 0, 0, 0);
    attach(c.rig.hairSocket, bakeAO(merge([cap, ...sides, fringe, nape(c, 0.14, 0.38, 0.017)]), 0.2), m);
  },

  hair_ponytail: (c) => {
    const m = c.cloth(c.colors.hair);
    const H = c.p.headH, W = c.p.headHalfW, D = c.p.headHalfD;
    const cap = skullCap(c, 0.46, 1.0, 0.016);
    // Coleta: sale de la nuca, cae y se afina.
    const tail = place(loft([
      { y: 0, w: W * 0.20, d: W * 0.20, n: 2.4 },
      { y: -H * 0.22, w: W * 0.30, d: W * 0.30, n: 2.4 },
      { y: -H * 0.52, w: W * 0.26, d: W * 0.26, n: 2.4 },
      { y: -H * 0.78, w: W * 0.10, d: W * 0.10, n: 2.4 },
    ], { segments: 12 }), 0, H * 0.74, -D * 0.92, -0.42, 0, 0);
    attach(c.rig.hairSocket, bakeAO(merge([cap, tail, nape(c, 0.18, 0.50, 0.015), ...sideburns(c, 0.34, 0.54, 0.015)]), 0.2), m);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(W * 0.22, W * 0.055, 6, 14), c.mat(c.colors.secondary));
    tie.position.set(0, H * 0.70, -D * 0.86);
    tie.rotation.x = Math.PI / 2 - 0.42;
    tie.castShadow = true;
    c.rig.hairSocket.add(tie);
  },

  hair_afro: (c) => {
    const m = c.cloth(c.colors.hair);
    const H = c.p.headH, W = c.p.headHalfW;
    // Volumen redondo grande: cambia la silueta de forma inconfundible.
    // El volumen crece hacia arriba y hacia atrás: la cara sigue despejada.
    const puff = place(loft([
      { y: -H * 0.30, w: W * 0.60, d: W * 0.58, n: 2.5, front: 0.50, z: -W * 0.16 },
      { y: -H * 0.10, w: W * 1.00, d: W * 0.98, n: 2.5, front: 0.56, z: -W * 0.16 },
      { y: H * 0.10, w: W * 1.20, d: W * 1.18, n: 2.5, front: 0.60, z: -W * 0.16 },
      { y: H * 0.28, w: W * 1.14, d: W * 1.12, n: 2.5, front: 0.62, z: -W * 0.16 },
      { y: H * 0.42, w: W * 0.82, d: W * 0.80, n: 2.5, front: 0.68, z: -W * 0.16 },
      { y: H * 0.50, w: W * 0.30, d: W * 0.30, n: 2.5, front: 0.80, z: -W * 0.16 },
    ], { segments: 20 }), 0, H * 0.62, 0);
    attach(c.rig.hairSocket, bakeAO(merge([puff, skullCap(c, 0.42, 0.66, 0.030), nape(c, 0.20, 0.46, 0.018)]), 0.22), m);
  },

  // ------------------------------------------------------------ gorros
  headwear_cap: (c) => {
    const H = c.p.headH, W = c.p.headHalfW, D = c.p.headHalfD;
    const m = c.cloth(c.colors.secondary, { roughness: 0.8 });
    const crown = skullCap(c, 0.50, 1.0, 0.018);
    // Visera larga hacia delante: silueta inconfundible de gorra.
    const peak = place(loft([
      { y: 0, w: W * 0.74, d: D * 0.62, n: 3.6, crease: true },
      { y: H * 0.035, w: W * 0.80, d: D * 0.66, n: 3.4 },
    ], { segments: 18 }), 0, H * 0.52, D * 0.80, -0.20, 0, 0);
    attach(c.rig.head, bakeAO(merge([crown, peak]), 0.2), m);
    const button = new THREE.Mesh(new THREE.SphereGeometry(W * 0.07, 8, 6), c.mat(shade(c.colors.secondary, -0.3)));
    button.position.y = H * 1.01;
    c.rig.head.add(button);
  },

  headwear_beanie: (c) => {
    const m = c.cloth(c.colors.secondary);
    const H = c.p.headH, W = c.p.headHalfW;
    const cap = skullCap(c, 0.44, 1.0, 0.020);
    // Vuelta del gorro: anillo más grueso con arista dura.
    const brim = bakeAO(loft(inflateProfile(
      sliceProfile(headProfile(c.p), H * 0.42, H * 0.56), 0.030,
    ).map((r, i, arr) => (i === arr.length - 1 ? { ...r, crease: true } : r)), { segments: 22 }), 0.2);
    attach(c.rig.head, bakeAO(merge([cap, brim]), 0.2), m);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(W * 0.30, 12, 10), c.mat(shade(c.colors.secondary, 0.45)));
    pom.position.y = H * 1.04;
    pom.castShadow = true;
    c.rig.head.add(pom);
  },

  headwear_cat_ears: (c) => {
    const outer = c.mat(c.colors.primary);
    const inner = c.mat('#ffb6c1');
    const H = c.p.headH, W = c.p.headHalfW;
    const band = new THREE.Mesh(new THREE.TorusGeometry(W * 0.96, W * 0.055, 6, 20), outer);
    band.rotation.x = Math.PI / 2;
    band.position.y = H * 0.66;
    band.castShadow = true;
    c.rig.head.add(band);
    for (const s of [-1, 1]) {
      const ear = place(loft([
        { y: 0, w: W * 0.30, d: W * 0.16, n: 2.4 },
        { y: H * 0.16, w: W * 0.20, d: W * 0.11, n: 2.4 },
        { y: H * 0.30, w: W * 0.03, d: W * 0.02, n: 2.4 },
      ], { segments: 10 }), s * W * 0.58, H * 0.86, -W * 0.05, 0, 0, -s * 0.30);
      attach(c.rig.head, bakeAO(ear, 0.2), outer);
      const cup = place(loft([
        { y: 0, w: W * 0.16, d: W * 0.06, n: 2.4 },
        { y: H * 0.20, w: W * 0.02, d: W * 0.02, n: 2.4 },
      ], { segments: 8 }), s * W * 0.58, H * 0.90, W * 0.02, 0, 0, -s * 0.30);
      attach(c.rig.head, cup, inner);
    }
  },

  headwear_helmet_tactical: (c) => {
    const H = c.p.headH, W = c.p.headHalfW, D = c.p.headHalfD;
    const m = c.cloth(shade(c.colors.secondary, -0.45), { roughness: 0.55 });
    const shell = skullCap(c, 0.46, 1.0, 0.024, 0.5);
    const brim = place(loft([
      { y: 0, w: W * 0.84, d: D * 0.30, n: 3.4, crease: true },
      { y: H * 0.05, w: W * 0.88, d: D * 0.34, n: 3.2 },
    ], { segments: 16 }), 0, H * 0.50, D * 0.72, -0.28, 0, 0);
    attach(c.rig.head, bakeAO(merge([shell, brim]), 0.2), m);
    const rail = c.mat(shade(c.colors.secondary, -0.62), { roughness: 0.45 });
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(W * 0.10, H * 0.07, D * 0.80), rail);
      r.position.set(s * W * 1.04, H * 0.66, -D * 0.08);
      r.castShadow = true;
      c.rig.head.add(r);
    }
  },

  // ------------------------------------------------------------- gafas
  eyewear_round: (c) => {
    const W = c.p.headHalfW, D = c.p.headHalfD, H = c.p.headH;
    const m = c.mat(shade(c.colors.secondary, -0.6), { roughness: 0.35, metalness: 0.5 });
    const glass = c.mat('#bfe9ff', { transparent: true, opacity: 0.35, roughness: 0.15 });
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(W * 0.30, W * 0.045, 6, 18), m);
      ring.position.set(s * W * 0.33, 0, 0);
      ring.castShadow = true;
      c.rig.eyewearSocket.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(W * 0.30, 16), glass);
      lens.position.set(s * W * 0.33, 0, -W * 0.01);
      c.rig.eyewearSocket.add(lens);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.035, W * 0.035, D * 0.86), m);
      arm.position.set(s * W * 0.62, H * 0.02, -D * 0.34);
      arm.castShadow = true;
      c.rig.eyewearSocket.add(arm);
    }
    c.rig.eyewearSocket.add(new THREE.Mesh(new THREE.BoxGeometry(W * 0.16, W * 0.035, W * 0.035), m));
  },

  eyewear_goggles: (c) => {
    const W = c.p.headHalfW, D = c.p.headHalfD;
    const frame = c.cloth(shade(c.colors.secondary, -0.66), { roughness: 0.6 });
    const glass = c.mat('#8fd6b4', { roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.7 });
    for (const s of [-1, 1]) {
      const cup = place(loft([
        { y: -W * 0.20, w: W * 0.28, d: W * 0.10, n: 3.2, crease: true },
        { y: 0, w: W * 0.31, d: W * 0.13, n: 3.0 },
        { y: W * 0.20, w: W * 0.28, d: W * 0.10, n: 3.2 },
      ], { segments: 14 }), s * W * 0.34, 0, 0);
      attach(c.rig.eyewearSocket, bakeAO(cup, 0.2), frame);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(W * 0.23, 12, 10), glass);
      lens.scale.set(1, 0.85, 0.30);
      lens.position.set(s * W * 0.34, 0, W * 0.10);
      c.rig.eyewearSocket.add(lens);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(W * 1.02, W * 0.055, 6, 22), frame);
    strap.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    strap.position.z = -D * 0.30;
    c.rig.eyewearSocket.add(strap);
  },

  eyewear_visor: (c) => {
    const W = c.p.headHalfW, D = c.p.headHalfD, H = c.p.headH;
    const glow = c.colors.secondary;
    const band = place(loft([
      { y: -H * 0.045, w: W * 0.96, d: D * 0.58, n: 3.6, crease: true },
      { y: H * 0.045, w: W * 1.00, d: D * 0.62, n: 3.4 },
    ], { segments: 18 }), 0, 0, -D * 0.30);
    attach(c.rig.eyewearSocket, band, c.mat(glow, { emissive: glow, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.9 }));
    const strap = new THREE.Mesh(new THREE.TorusGeometry(W * 0.98, W * 0.05, 6, 20), c.mat(shade(glow, -0.7)));
    strap.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    strap.position.z = -D * 0.34;
    c.rig.eyewearSocket.add(strap);
  },

  // ------------------------------------------- accesorios de cabeza
  headacc_headset: (c) => {
    const W = c.p.headHalfW, H = c.p.headH, D = c.p.headHalfD;
    const shellMat = c.cloth(shade(c.colors.primary, -0.35), { roughness: 0.55 });
    const padMat = c.mat('#20242e', { roughness: 0.9 });
    // Diadema: arco de oreja a oreja, achatado para apoyarse en la coronilla
    // en vez de flotar por encima (la cabeza es un elipsoide, no una esfera).
    const bandR = W * 1.03;
    const band = new THREE.Mesh(new THREE.TorusGeometry(bandR, W * 0.075, 8, 22, Math.PI), shellMat);
    band.rotation.z = 0;
    band.scale.y = Math.max(0.35, (H * 0.99 - c.rig.headAccessorySocket.position.y) / bandR);
    band.castShadow = true;
    c.rig.headAccessorySocket.add(band);
    for (const s of [-1, 1]) {
      const cup = place(loft([
        { y: -H * 0.10, w: W * 0.20, d: W * 0.22, n: 3.0, crease: true },
        { y: 0, w: W * 0.23, d: W * 0.25, n: 2.8 },
        { y: H * 0.10, w: W * 0.19, d: W * 0.21, n: 3.0 },
      ], { segments: 12 }), s * W * 1.06, 0, -D * 0.04, 0, 0, Math.PI / 2);
      attach(c.rig.headAccessorySocket, bakeAO(cup, 0.2), shellMat);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(W * 0.17, 10, 8), padMat);
      pad.scale.set(0.45, 1, 1.05);
      pad.position.set(s * W * 0.94, 0, -D * 0.04);
      c.rig.headAccessorySocket.add(pad);
    }
    // Micrófono de varilla.
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.025, W * 0.025, W * 0.95, 6), padMat);
    boom.position.set(-W * 0.78, -H * 0.13, D * 0.36);
    boom.rotation.set(0.5, 0, 0.8);
    c.rig.headAccessorySocket.add(boom);
  },

  headacc_earmuffs: (c) => {
    const W = c.p.headHalfW, H = c.p.headH, D = c.p.headHalfD;
    const m = c.cloth(shade(c.colors.secondary, -0.55), { roughness: 0.85 });
    const bandR = W * 1.01;
    const band = new THREE.Mesh(new THREE.TorusGeometry(bandR, W * 0.085, 8, 20, Math.PI), m);
    band.scale.y = Math.max(0.35, (H * 0.98 - c.rig.headAccessorySocket.position.y) / bandR);
    band.castShadow = true;
    c.rig.headAccessorySocket.add(band);
    for (const s of [-1, 1]) {
      const cup = place(loft([
        { y: -H * 0.13, w: W * 0.26, d: W * 0.27, n: 3.6, crease: true },
        { y: H * 0.13, w: W * 0.26, d: W * 0.27, n: 3.6 },
      ], { segments: 12 }), s * W * 1.02, 0, -D * 0.04, 0, 0, Math.PI / 2);
      attach(c.rig.headAccessorySocket, bakeAO(cup, 0.2), m);
    }
  },
};
