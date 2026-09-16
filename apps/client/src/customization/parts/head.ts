import * as THREE from 'three';
import type { CosmeticId } from '@game/config';
import { bakeAO, blob, loft, merge, place, type Ring } from '../geometry.js';
import { headProfile, headSurfaceAt, headSurfaceYaw, inflateProfile, sliceProfile } from '../profiles.js';
import { attach, shade, type PartBuilder, type PartContext } from '../context.js';

/**
 * =====================================================================
 *  PIEZAS DE CABEZA: pelo, ojos, rostro, gorros y gafas
 * =====================================================================
 *  El pelo y los gorros se construyen inflando el perfil del cráneo, de
 *  modo que se apoyan en la cabeza real y cada uno cambia la silueta de
 *  una forma distinta (puntas, melena, afro, casco…).
 * =====================================================================
 */

/** Casquete que sigue la forma del cráneo entre dos alturas relativas. */
function skullCap(c: PartContext, from: number, to: number, inflate: number, nBoost = 0): THREE.BufferGeometry {
  const H = c.p.headH;
  const rings = inflateProfile(sliceProfile(headProfile(c.p), H * from, H * to), inflate, nBoost);
  // El borde inferior se afina: así el pelo se funde con la cabeza en vez de
  // terminar en un corte recto de casco.
  if (rings.length > 1) rings[0] = { ...rings[0]!, w: rings[0]!.w - inflate * 0.55, d: (rings[0]!.d ?? rings[0]!.w) - inflate * 0.55 };
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

export const HEAD_PARTS: Partial<Record<CosmeticId, PartBuilder>> = {
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
      spikes.push(place(
        strand(H * 0.34, W * 0.135, 0.12),
        Math.cos(a) * rad, H * 0.82, Math.sin(a) * rad * 0.95,
        Math.sin(a) * tilt, 0, -Math.cos(a) * tilt,
      ));
    }
    // Flequillo en pico: evita el corte horizontal de "casco" en la frente.
    const fringe = place(loft([
      { y: H * 0.47, w: W * 0.26, d: D * 0.22, n: 2.4, z: D * 0.56, crease: true },
      { y: H * 0.55, w: W * 0.62, d: D * 0.34, n: 2.8, z: D * 0.50 },
      { y: H * 0.65, w: W * 0.80, d: D * 0.44, n: 2.8, z: D * 0.42 },
    ], { segments: 14 }), 0, 0, 0);
    const tufts = [-1, 1].map((s) => place(
      loft([
        { y: H * 0.49, w: W * 0.14, d: D * 0.18, n: 2.4, crease: true },
        { y: H * 0.60, w: W * 0.24, d: D * 0.28, n: 2.6 },
      ], { segments: 10 }), s * W * 0.72, 0, D * 0.30));
    attach(c.rig.hairSocket, bakeAO(merge([cap, fringe, ...tufts, ...sideburns(c, 0.34, 0.58, 0.016), nape(c, 0.18, 0.56, 0.015), ...spikes]), 0.2), m);
  },

  hair_bob: (c) => {
    const m = c.cloth(c.colors.hair);
    const H = c.p.headH, W = c.p.headHalfW, D = c.p.headHalfD;
    const cap = skullCap(c, 0.34, 1.0, 0.018);
    // Melena: dos paneles que enmarcan la cara y bajan hasta la mandíbula.
    const sides = [-1, 1].map((s) =>
      place(loft([
        { y: H * 0.10, w: W * 0.16, d: D * 0.50, n: 2.8, z: -D * 0.06 },
        { y: H * 0.26, w: W * 0.19, d: D * 0.62, n: 2.6, z: -D * 0.04 },
        { y: H * 0.46, w: W * 0.20, d: D * 0.66, n: 2.6 },
        { y: H * 0.62, w: W * 0.17, d: D * 0.58, n: 2.6 },
      ], { segments: 12 }), s * W * 0.90, 0, 0),
    );
    // Flequillo recto sobre la frente.
    const fringe = place(loft([
      { y: H * 0.42, w: W * 0.72, d: D * 0.34, n: 3.2, z: D * 0.52, crease: true },
      { y: H * 0.56, w: W * 0.82, d: D * 0.40, n: 3.0, z: D * 0.46 },
      { y: H * 0.66, w: W * 0.80, d: D * 0.42, n: 3.0, z: D * 0.40 },
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
    const geo = bakeAO(merge([cap, tail, nape(c, 0.18, 0.50, 0.015), ...sideburns(c, 0.34, 0.54, 0.015)]), 0.2);
    attach(c.rig.hairSocket, geo, m);
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
    const puff = place(blob(W * 1.34, H * 0.62, W * 1.30, 2.6, 18, 11), 0, H * 0.66, -W * 0.06);
    const cap = skullCap(c, 0.42, 0.66, 0.030);
    attach(c.rig.hairSocket, bakeAO(merge([puff, cap, nape(c, 0.20, 0.46, 0.018)]), 0.22), m);
  },

  // ------------------------------------------------------------- ojos
  eyes_round: (c) => buildEyes(c, { w: 1.0, h: 1.0, tilt: 0.0, lash: 1.0 }),
  eyes_sharp: (c) => buildEyes(c, { w: 1.14, h: 0.74, tilt: 0.26, lash: 1.25 }),
  eyes_star: (c) => buildEyes(c, { w: 1.06, h: 1.06, tilt: 0.05, lash: 0.9, star: true }),

  // ------------------------------------------------------------ rostro
  face_neutral: (c) => { buildBrows(c, 0.0, 1.0); buildMouth(c, 'neutral'); },
  face_smile: (c) => { buildBrows(c, 0.12, 0.95); buildMouth(c, 'smile'); buildBlush(c); },
  face_freckles: (c) => {
    buildBrows(c, 0.06, 1.05);
    buildMouth(c, 'smile');
    const W = c.p.headHalfW, H = c.p.headH;
    const m = c.mat(shade(c.colors.skin, -0.35));
    const dots: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const s = i < 4 ? -1 : 1;
      const k = i % 4;
      const fx = s * W * (0.30 + k * 0.13);
      const fy = H * 0.30 - (k % 2) * H * 0.028;
      dots.push(place(blob(W * 0.035, W * 0.030, W * 0.030, 2.2, 6, 4), fx, fy, headSurfaceAt(c.p, fy, fx) - W * 0.015));
    }
    attach(c.rig.head, merge(dots), m);
  },

  // ------------------------------------------------------------ gorros
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
    const inner = c.mat(shade(c.colors.primary, 0.42));
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
    // Visera corta sobre la frente.
    const brim = place(loft([
      { y: 0, w: W * 0.84, d: D * 0.30, n: 3.4, crease: true },
      { y: H * 0.05, w: W * 0.88, d: D * 0.34, n: 3.2 },
    ], { segments: 16 }), 0, H * 0.50, D * 0.72, -0.28, 0, 0);
    attach(c.rig.head, bakeAO(merge([shell, brim]), 0.2), m);
    // Raíles laterales: dan lectura de casco táctico en silueta.
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
      // Patilla hacia la oreja.
      const arm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.035, W * 0.035, D * 0.86), m);
      arm.position.set(s * W * 0.62, H * 0.02, -D * 0.34);
      arm.castShadow = true;
      c.rig.eyewearSocket.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.16, W * 0.035, W * 0.035), m);
    c.rig.eyewearSocket.add(bridge);
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
    strap.rotation.y = Math.PI / 2;
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, 0, -D * 0.34);
    c.rig.eyewearSocket.add(strap);
  },
};

// ------------------------------------------------------------- helpers

interface EyeStyle { w: number; h: number; tilt: number; lash: number; star?: boolean; }

/**
 * Ojo chibi: esclerótica, iris, pupila, brillo y línea de pestañas.
 * La pestaña superior es lo que hace que el ojo se lea como diseñado y no
 * como una bola pegada a la cara.
 */
function buildEyes(c: PartContext, style: EyeStyle): void {
  const W = c.p.headHalfW;
  const holder = new THREE.Group();
  holder.scale.setScalar(c.p.eyeScale);
  c.rig.eyeSocket.add(holder);

  const white = c.mat('#fdfdfd', { roughness: 0.35 });
  const iris = c.mat(c.colors.eyes, { roughness: 0.22 });
  const pupil = c.mat('#1a1420', { roughness: 0.3 });
  const shine = c.mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.1 });
  const lashMat = c.mat(shade(c.colors.hair, -0.45), { roughness: 0.5 });

  const spacing = W * 0.325;
  const ew = W * 0.30 * style.w;
  const eh = W * 0.34 * style.h;
  const faceY = c.rig.eyeSocket.position.y;

  for (const s of [-1, 1]) {
    // Cada ojo se apoya en el punto exacto de la mejilla y se orienta con la
    // normal de la superficie: ni hundido ni atravesando el lateral.
    const x = s * spacing;
    const eye = new THREE.Group();
    eye.position.set(x, 0, headSurfaceAt(c.p, faceY, x) - ew * 0.12);
    eye.rotation.set(0, headSurfaceYaw(c.p, faceY, x), -s * style.tilt);
    holder.add(eye);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), white);
    sclera.scale.set(ew, eh, ew * 0.34);
    eye.add(sclera);

    const irisMesh = style.star
      ? new THREE.Mesh(new THREE.OctahedronGeometry(ew * 0.62), iris)
      : new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), iris);
    if (!style.star) irisMesh.scale.set(ew * 0.60, eh * 0.60, ew * 0.22);
    else irisMesh.scale.set(1, 1, 0.45);
    irisMesh.position.z = ew * 0.20;
    eye.add(irisMesh);

    const pup = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), pupil);
    pup.scale.set(ew * 0.26, eh * 0.32, ew * 0.12);
    pup.position.z = ew * 0.27;
    eye.add(pup);

    const hi = new THREE.Mesh(new THREE.SphereGeometry(ew * 0.20, 8, 6), shine);
    hi.position.set(-s * ew * 0.28, eh * 0.36, ew * 0.31);
    eye.add(hi);

    // Pestaña superior: arco grueso que define la forma del ojo.
    const lash = new THREE.Mesh(new THREE.TorusGeometry(ew * 0.94, ew * 0.115 * style.lash, 6, 14, Math.PI * 0.92), lashMat);
    lash.position.set(0, eh * 0.26, ew * 0.06);
    lash.rotation.set(0.18, 0, Math.PI * 0.07);
    lash.scale.set(1, style.h, 0.7);
    lash.castShadow = true;
    eye.add(lash);
  }
}

/** Cejas: dos trazos angulados. Dan casi toda la expresión del personaje. */
function buildBrows(c: PartContext, raise: number, thickness: number): void {
  const W = c.p.headHalfW;
  const m = c.mat(shade(c.colors.hair, -0.25), { roughness: 0.6 });
  const browY = c.rig.browSocket.position.y;
  for (const s of [-1, 1]) {
    const x = s * W * 0.345;
    const brow = new THREE.Mesh(new THREE.BoxGeometry(W * 0.34, W * 0.080 * thickness, W * 0.06), m);
    brow.position.set(x, W * 0.04 * raise, headSurfaceAt(c.p, browY, x) - W * 0.02);
    brow.rotation.set(0, headSurfaceYaw(c.p, browY, x), -s * 0.16);
    brow.castShadow = true;
    c.rig.browSocket.add(brow);
  }
}

function buildMouth(c: PartContext, kind: 'neutral' | 'smile'): void {
  const W = c.p.headHalfW;
  const z = headSurfaceAt(c.p, c.rig.mouthSocket.position.y, 0) - W * 0.03;
  const m = c.mat('#8a4a4a', { roughness: 0.5 });
  if (kind === 'smile') {
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(W * 0.13, W * 0.032, 6, 14, Math.PI), m);
    mouth.rotation.z = Math.PI;
    mouth.position.z = z;
    c.rig.mouthSocket.add(mouth);
  } else {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(W * 0.20, W * 0.045, W * 0.05), m);
    mouth.position.z = z;
    c.rig.mouthSocket.add(mouth);
  }
}

function buildBlush(c: PartContext): void {
  const W = c.p.headHalfW, D = c.p.headHalfD, H = c.p.headH;
  const m = c.mat('#ef8f9e', { transparent: true, opacity: 0.38, roughness: 0.9 });
  void D;
  for (const s of [-1, 1]) {
    const x = s * W * 0.66;
    const y = H * 0.30;
    const b = new THREE.Mesh(new THREE.SphereGeometry(W * 0.14, 10, 8), m);
    b.scale.set(1, 0.55, 0.22);
    b.position.set(x, y, headSurfaceAt(c.p, y, x) - W * 0.02);
    b.rotation.y = headSurfaceYaw(c.p, y, x);
    c.rig.head.add(b);
  }
}
