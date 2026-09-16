import * as THREE from 'three';
import type { CosmeticId } from '@game/config';
import { blob, merge, place } from '../geometry.js';
import { headSurfaceAt, headSurfaceYaw } from '../profiles.js';
import { attach, shade, type PartBuilder, type PartContext } from '../context.js';

/**
 * =====================================================================
 *  RASGOS DE LA CARA: ojos, cejas, boca y detalles de piel
 * =====================================================================
 *  Todos se apoyan en la superficie real del cráneo (`headSurfaceAt`) y
 *  se orientan con su normal (`headSurfaceYaw`), así que ni se hunden en
 *  la cabeza ni asoman por el lateral al cambiar de talla.
 * =====================================================================
 */

interface EyeStyle { w: number; h: number; tilt: number; lash: number; star?: boolean; lidDrop?: number; }

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

    // Párpado caído para la mirada cansada.
    if (style.lidDrop) {
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), c.mat(c.colors.skin, { roughness: 0.8 }));
      lid.scale.set(ew * 1.02, eh * style.lidDrop, ew * 0.40);
      lid.position.set(0, eh * (1 - style.lidDrop), ew * 0.02);
      eye.add(lid);
    }
  }
}

/** Cejas: dos trazos angulados. Dan casi toda la expresión del personaje. */
function buildBrows(c: PartContext, opts: { raise: number; thickness: number; angle: number; arch?: boolean }): void {
  const W = c.p.headHalfW;
  const m = c.mat(shade(c.colors.hair, -0.25), { roughness: 0.6 });
  const browY = c.rig.browSocket.position.y;
  for (const s of [-1, 1]) {
    const x = s * W * 0.345;
    const geo = opts.arch
      ? new THREE.TorusGeometry(W * 0.19, W * 0.042 * opts.thickness, 5, 10, Math.PI * 0.62)
      : new THREE.BoxGeometry(W * 0.34, W * 0.080 * opts.thickness, W * 0.06);
    const brow = new THREE.Mesh(geo, m);
    brow.position.set(x, W * 0.04 * opts.raise, headSurfaceAt(c.p, browY, x) - W * 0.02);
    brow.rotation.set(0, headSurfaceYaw(c.p, browY, x), -s * opts.angle + (opts.arch ? Math.PI * 0.19 : 0));
    brow.castShadow = true;
    c.rig.browSocket.add(brow);
  }
}

type MouthKind = 'neutral' | 'smile' | 'smirk' | 'open';

function buildMouth(c: PartContext, kind: MouthKind): void {
  const W = c.p.headHalfW;
  const z = headSurfaceAt(c.p, c.rig.mouthSocket.position.y, 0) - W * 0.03;
  const m = c.mat('#8a4a4a', { roughness: 0.5 });
  let mesh: THREE.Mesh;
  switch (kind) {
    case 'smile':
      mesh = new THREE.Mesh(new THREE.TorusGeometry(W * 0.13, W * 0.032, 6, 14, Math.PI), m);
      mesh.rotation.z = Math.PI;
      break;
    case 'smirk':
      mesh = new THREE.Mesh(new THREE.TorusGeometry(W * 0.12, W * 0.030, 6, 12, Math.PI * 0.7), m);
      mesh.rotation.set(0, 0, Math.PI * 1.15);
      mesh.position.x = W * 0.03;
      break;
    case 'open':
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), c.mat('#5c2b2b', { roughness: 0.6 }));
      mesh.scale.set(W * 0.11, W * 0.085, W * 0.05);
      break;
    default:
      mesh = new THREE.Mesh(new THREE.BoxGeometry(W * 0.20, W * 0.045, W * 0.05), m);
  }
  mesh.position.z = z;
  c.rig.mouthSocket.add(mesh);
}

/** Mancha sobre la piel de la cara, pegada a la superficie. */
function cheekPatch(c: PartContext, color: string, opacity: number, size: number, y: number, xFactor: number): void {
  const W = c.p.headHalfW;
  const m = c.mat(color, { transparent: opacity < 1, opacity, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const x = s * W * xFactor;
    const b = new THREE.Mesh(new THREE.SphereGeometry(W * size, 10, 8), m);
    b.scale.set(1, 0.55, 0.22);
    b.position.set(x, y, headSurfaceAt(c.p, y, x) - W * 0.02);
    b.rotation.y = headSurfaceYaw(c.p, y, x);
    c.rig.head.add(b);
  }
}

export const FACE_PARTS: Partial<Record<CosmeticId, PartBuilder>> = {
  // ------------------------------------------------------------- ojos
  eyes_round: (c) => buildEyes(c, { w: 1.0, h: 1.0, tilt: 0.0, lash: 1.0 }),
  eyes_sharp: (c) => buildEyes(c, { w: 1.14, h: 0.74, tilt: 0.26, lash: 1.25 }),
  eyes_tired: (c) => buildEyes(c, { w: 1.02, h: 0.92, tilt: -0.14, lash: 1.1, lidDrop: 0.42 }),
  eyes_star: (c) => buildEyes(c, { w: 1.06, h: 1.06, tilt: 0.05, lash: 0.9, star: true }),

  // ------------------------------------------------------------ cejas
  brows_straight: (c) => buildBrows(c, { raise: 0, thickness: 1.0, angle: 0.14 }),
  brows_thick: (c) => buildBrows(c, { raise: -0.2, thickness: 1.6, angle: 0.12 }),
  brows_angry: (c) => buildBrows(c, { raise: -0.5, thickness: 1.25, angle: -0.34 }),
  brows_arched: (c) => buildBrows(c, { raise: 0.35, thickness: 0.9, angle: 0.10, arch: true }),

  // ------------------------------------------------------------- boca
  mouth_neutral: (c) => buildMouth(c, 'neutral'),
  mouth_smile: (c) => buildMouth(c, 'smile'),
  mouth_smirk: (c) => buildMouth(c, 'smirk'),
  mouth_open: (c) => buildMouth(c, 'open'),

  // -------------------------------------------------- detalles de piel
  face_clean: () => { /* la piel base ya es el acabado limpio */ },
  face_blush: (c) => cheekPatch(c, '#ef8f9e', 0.38, 0.14, c.p.headH * 0.30, 0.66),
  face_freckles: (c) => {
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
  face_warpaint: (c) => {
    const W = c.p.headHalfW, H = c.p.headH;
    const m = c.mat(shade(c.colors.secondary, -0.7), { roughness: 0.95 });
    // Banda ancha sobre los ojos, de sien a sien.
    for (const s of [-1, 1]) {
      const x = s * W * 0.50;
      const y = H * 0.37;
      const band = new THREE.Mesh(new THREE.SphereGeometry(W * 0.30, 10, 8), m);
      band.scale.set(1, 0.30, 0.20);
      band.position.set(x, y, headSurfaceAt(c.p, y, x) - W * 0.03);
      band.rotation.y = headSurfaceYaw(c.p, y, x);
      c.rig.head.add(band);
    }
  },
};
