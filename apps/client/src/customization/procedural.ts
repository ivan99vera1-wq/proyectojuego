import * as THREE from 'three';
import type { CosmeticId } from '@game/config';
import type { AvatarConfig } from '@game/shared';

export interface ChibiParts {
  hips: THREE.Group; torso: THREE.Group; torsoMesh: THREE.Mesh;
  head: THREE.Group; headMesh: THREE.Mesh; eyes: THREE.Group; face: THREE.Group;
  hairSocket: THREE.Group; headwearSocket: THREE.Group; eyewearSocket: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; handL: THREE.Group; handR: THREE.Group;
  legL: THREE.Group; legR: THREE.Group; back: THREE.Group; neck: THREE.Group;
  legMeshes: THREE.Mesh[]; armMeshes: THREE.Mesh[];
}

export interface PartContext {
  parts: ChibiParts;
  colors: AvatarConfig['colors'];
  mat: (color: string, opts?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial;
  dims: { legLength: number; legRadius: number; torsoHeight: number; torsoWidth: number; headRadius: number; armLength: number; armRadius: number };
  bodyWidth: number;
}

type Builder = (ctx: PartContext) => void;
const R = 0.26; // headRadius

const sphere = (r: number, m: THREE.Material, w = 16, h = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), m);
const box = (x: number, y: number, z: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), m);
const cone = (r: number, h: number, m: THREE.Material, seg = 10) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
const torus = (r: number, t: number, m: THREE.Material, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 24, arc), m);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function eyePair(ctx: PartContext, make: (m: THREE.Material) => THREE.Mesh, spacing = 0.09): void {
  const m = ctx.mat(ctx.colors.eyes, { roughness: 0.3 });
  const white = ctx.mat('#ffffff', { roughness: 0.4 });
  for (const s of [-1, 1]) {
    const w = sphere(0.062, white);
    w.position.set(s * spacing, 0, 0);
    w.scale.set(1, 1.1, 0.5);
    ctx.parts.eyes.add(w);
    const iris = make(m);
    iris.position.set(s * spacing, 0, 0.03);
    ctx.parts.eyes.add(iris);
    const shine = sphere(0.014, ctx.mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }));
    shine.position.set(s * spacing + 0.018, 0.018, 0.06);
    ctx.parts.eyes.add(shine);
  }
}

/**
 * Constructores procedurales por id de cosmético. Cada uno añade mallas a los
 * sockets del chibi. Cuando exista arte GLB, se sustituyen por cargas de modelo.
 */
export const PROCEDURAL_COSMETICS: Partial<Record<CosmeticId, Builder>> = {
  // ---- cabello ----
  hair_spiky: (c) => {
    const m = c.mat(c.colors.hair);
    const cap = sphere(R * 1.04, m);
    cap.scale.set(1, 0.75, 1); cap.position.y = R * 0.28;
    c.parts.hairSocket.add(cap);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const spike = cone(0.07, 0.2, m, 6);
      spike.position.set(Math.cos(a) * R * 0.55, R * 0.85, Math.sin(a) * R * 0.55);
      spike.lookAt(new THREE.Vector3(Math.cos(a) * 2, 3, Math.sin(a) * 2));
      spike.rotateX(Math.PI / 2);
      c.parts.hairSocket.add(spike);
    }
  },
  hair_bob: (c) => {
    const m = c.mat(c.colors.hair);
    const cap = sphere(R * 1.08, m, 20, 14);
    cap.scale.set(1, 0.9, 1); cap.position.y = R * 0.1;
    c.parts.hairSocket.add(cap);
    const fringe = box(R * 1.6, R * 0.5, R * 0.5, m);
    fringe.position.set(0, R * 0.2, R * 0.8);
    c.parts.hairSocket.add(fringe);
    for (const s of [-1, 1]) {
      const side = box(R * 0.35, R * 1.2, R * 1.1, m);
      side.position.set(s * R * 1.0, -R * 0.35, -R * 0.1);
      c.parts.hairSocket.add(side);
    }
  },
  hair_ponytail: (c) => {
    const m = c.mat(c.colors.hair);
    const cap = sphere(R * 1.05, m, 20, 14);
    cap.scale.set(1, 0.8, 1); cap.position.y = R * 0.2;
    c.parts.hairSocket.add(cap);
    const tail = cyl(0.05, 0.09, R * 1.3, m);
    tail.position.set(0, -R * 0.2, -R * 1.05);
    tail.rotation.x = -0.35;
    c.parts.hairSocket.add(tail);
    const tie = torus(0.06, 0.02, c.mat(c.colors.secondary));
    tie.position.set(0, R * 0.3, -R * 0.98);
    c.parts.hairSocket.add(tie);
  },
  hair_afro: (c) => {
    const afro = sphere(R * 1.18, c.mat(c.colors.hair), 22, 16);
    afro.scale.set(1.3, 1.15, 1.05);
    afro.position.set(0, R * 0.45, -R * 0.32);
    c.parts.hairSocket.add(afro);
  },
  // ---- ojos ----
  eyes_round: (c) => eyePair(c, (m) => sphere(0.04, m)),
  eyes_sharp: (c) => eyePair(c, (m) => { const e = sphere(0.045, m); e.scale.set(1.3, 0.55, 0.6); return e; }),
  eyes_star: (c) => eyePair(c, (m) => { const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), m); e.scale.set(1, 1, 0.5); return e; }),
  // ---- cara ----
  face_neutral: (c) => {
    const mouth = box(0.06, 0.012, 0.01, c.mat('#5a3a3a'));
    c.parts.face.add(mouth);
  },
  face_smile: (c) => {
    const mouth = torus(0.045, 0.011, c.mat('#5a3a3a'), Math.PI);
    mouth.rotation.z = Math.PI;
    c.parts.face.add(mouth);
    for (const s of [-1, 1]) {
      const blush = sphere(0.03, c.mat('#ff9aa8', { transparent: true, opacity: 0.7 }));
      blush.position.set(s * 0.14, 0.04, -0.03); blush.scale.set(1, 0.6, 0.3);
      c.parts.face.add(blush);
    }
  },
  face_freckles: (c) => {
    const mouth = torus(0.04, 0.01, c.mat('#5a3a3a'), Math.PI);
    mouth.rotation.z = Math.PI;
    c.parts.face.add(mouth);
    const fm = c.mat('#b9754a');
    for (let i = 0; i < 6; i++) {
      const f = sphere(0.009, fm, 6, 6);
      f.position.set((i % 3 - 1) * 0.045 + (i > 2 ? 0.02 : -0.02) * 1.5 * (i > 2 ? 1 : -1) * 0.5, 0.05 - (i > 2 ? 0.02 : 0), 0.0);
      f.position.x += i > 2 ? 0.09 : -0.09;
      c.parts.face.add(f);
    }
  },
  // ---- gorros ----
  headwear_beanie: (c) => {
    const m = c.mat(c.colors.secondary);
    const cap = sphere(R * 1.1, m, 20, 14);
    cap.scale.set(1, 0.85, 1); cap.position.y = R * 0.05;
    c.parts.headwearSocket.add(cap);
    const band = torus(R * 1.08, 0.04, m);
    band.rotation.x = Math.PI / 2; band.position.y = -R * 0.2;
    c.parts.headwearSocket.add(band);
    const pom = sphere(0.08, c.mat('#ffffff'));
    pom.position.y = R * 1.05;
    c.parts.headwearSocket.add(pom);
  },
  headwear_cat_ears: (c) => {
    const m = c.mat(c.colors.primary);
    const inner = c.mat('#ffb6c1');
    for (const s of [-1, 1]) {
      const ear = cone(0.1, 0.2, m, 4);
      ear.position.set(s * R * 0.65, R * 0.75, 0);
      ear.rotation.z = -s * 0.35;
      c.parts.headwearSocket.add(ear);
      const inn = cone(0.05, 0.12, inner, 4);
      inn.position.set(s * R * 0.65, R * 0.72, 0.03);
      inn.rotation.z = -s * 0.35;
      c.parts.headwearSocket.add(inn);
    }
  },
  headwear_helmet_tactical: (c) => {
    const m = c.mat('#4b5320', { roughness: 0.6 });
    const cap = sphere(R * 1.12, m, 20, 14);
    cap.scale.set(1, 0.8, 1.05);
    c.parts.headwearSocket.add(cap);
    const brim = torus(R * 1.1, 0.03, m);
    brim.rotation.x = Math.PI / 2; brim.position.y = -R * 0.25;
    c.parts.headwearSocket.add(brim);
  },
  // ---- gafas ----
  eyewear_round: (c) => {
    const m = c.mat('#222222', { roughness: 0.3, metalness: 0.5 });
    for (const s of [-1, 1]) {
      const ring = torus(0.07, 0.008, m);
      ring.position.set(s * 0.09, 0, 0);
      c.parts.eyewearSocket.add(ring);
    }
    const bridge = box(0.05, 0.008, 0.008, m);
    c.parts.eyewearSocket.add(bridge);
  },
  eyewear_visor: (c) => {
    const visor = box(0.34, 0.08, 0.05, c.mat(c.colors.secondary, { emissive: c.colors.secondary, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
    visor.position.z = -0.01;
    c.parts.eyewearSocket.add(visor);
  },
  // ---- torso ----
  top_hoodie: (c) => {
    const m = c.mat(c.colors.primary);
    (c.parts.torsoMesh.material as THREE.MeshStandardMaterial).color.set(c.colors.primary);
    const hood = torus(0.13, 0.05, m);
    hood.rotation.x = Math.PI / 2; hood.position.set(0, c.dims.torsoHeight - 0.02, -0.04);
    c.parts.torso.add(hood);
    const pocket = box(0.16, 0.07, 0.02, c.mat(c.colors.secondary));
    pocket.position.set(0, c.dims.torsoHeight * 0.3, c.dims.torsoWidth / 2 * c.bodyWidth * 0.85);
    c.parts.torso.add(pocket);
    for (const am of c.parts.armMeshes) am.material = m;
  },
  top_tactical_vest: (c) => {
    (c.parts.torsoMesh.material as THREE.MeshStandardMaterial).color.set(c.colors.primary);
    const vest = box(c.dims.torsoWidth * c.bodyWidth * 1.05, c.dims.torsoHeight * 0.65, c.dims.torsoWidth * 0.8 * c.bodyWidth, c.mat('#3b4a2f', { roughness: 0.9 }));
    vest.position.y = c.dims.torsoHeight * 0.5;
    c.parts.torso.add(vest);
    const pouch = box(0.07, 0.06, 0.04, c.mat('#2c3623'));
    pouch.position.set(0.06, c.dims.torsoHeight * 0.4, c.dims.torsoWidth / 2 * c.bodyWidth * 0.9);
    c.parts.torso.add(pouch);
    const pouch2 = pouch.clone(); pouch2.position.x = -0.06; c.parts.torso.add(pouch2);
  },
  top_sailor: (c) => {
    (c.parts.torsoMesh.material as THREE.MeshStandardMaterial).color.set('#ffffff');
    const collar = box(0.3 * c.bodyWidth, 0.02, 0.22, c.mat(c.colors.secondary));
    collar.position.set(0, c.dims.torsoHeight - 0.03, -0.03);
    c.parts.torso.add(collar);
    const tie = cone(0.03, 0.09, c.mat(c.colors.primary), 3);
    tie.rotation.x = Math.PI; tie.position.set(0, c.dims.torsoHeight - 0.1, c.dims.torsoWidth / 2 * c.bodyWidth * 0.85);
    c.parts.torso.add(tie);
  },
  // ---- piernas ----
  bottom_cargo: (c) => { const m = c.mat('#6b7a4b'); for (const l of c.parts.legMeshes) l.material = m; },
  bottom_skirt: (c) => {
    const skirt = cone(0.2 * c.bodyWidth, 0.16, c.mat(c.colors.secondary), 14);
    skirt.position.y = -0.06;
    c.parts.hips.add(skirt);
    const m = c.mat(c.colors.skin); for (const l of c.parts.legMeshes) l.material = m;
  },
  bottom_shorts: (c) => {
    const m = c.mat(c.colors.secondary);
    for (const l of c.parts.legMeshes) { l.material = c.mat(c.colors.skin); }
    for (const s of [-1, 1]) {
      const sh = cyl(0.085, 0.085, 0.12, m);
      sh.position.set(s * 0.09 * c.bodyWidth, -0.06, 0);
      c.parts.hips.add(sh);
    }
  },
  // ---- calzado ----
  shoes_sneakers: (c) => {
    const m = c.mat('#ffffff'); const sole = c.mat(c.colors.secondary);
    for (const leg of [c.parts.legL, c.parts.legR]) {
      const shoe = box(0.13, 0.08, 0.2, m); shoe.position.set(0, -c.dims.legLength + 0.03, 0.03); leg.add(shoe);
      const s = box(0.14, 0.03, 0.21, sole); s.position.set(0, -c.dims.legLength - 0.01, 0.03); leg.add(s);
    }
  },
  shoes_boots: (c) => {
    const m = c.mat('#3a2a1a');
    for (const leg of [c.parts.legL, c.parts.legR]) {
      const boot = box(0.13, 0.16, 0.2, m); boot.position.set(0, -c.dims.legLength + 0.06, 0.03); leg.add(boot);
    }
  },
  // ---- espalda ----
  back_backpack: (c) => {
    const bag = box(0.2, 0.22, 0.12, c.mat(c.colors.secondary));
    bag.position.z = -0.07;
    c.parts.back.add(bag);
  },
  back_wings: (c) => {
    const m = c.mat('#ffffff', { transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI), m);
      wing.scale.set(1.3, 0.8, 0.25);
      wing.position.set(s * 0.14, 0.02, -0.04);
      wing.rotation.y = s * 0.5;
      c.parts.back.add(wing);
    }
  },
  // ---- manos ----
  hands_gloves: (c) => {
    const m = c.mat(c.colors.secondary);
    for (const h of [c.parts.handL, c.parts.handR]) { const g = sphere(0.07, m); g.position.y = 0.02; h.add(g); }
  },
  // ---- accesorio ----
  accessory_scarf: (c) => {
    const m = c.mat(c.colors.primary);
    const ring = torus(0.15, 0.045, m);
    ring.rotation.x = Math.PI / 2;
    c.parts.neck.add(ring);
    const tail = box(0.07, 0.18, 0.03, m);
    tail.position.set(0.08, -0.1, 0.1);
    c.parts.neck.add(tail);
  },
};
