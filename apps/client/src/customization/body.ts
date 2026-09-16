import * as THREE from 'three';
import { bakeAO, blob, loft, merge, place } from './geometry.js';
import {
  armLowerProfile, armUpperProfile, footProfile, handProfile, headProfile, headSurfaceZ,
  legLowerProfile, legUpperProfile, torsoProfile,
} from './profiles.js';
import type { ChibiRig, Proportions } from './rig.js';
import { proportionsKey } from './rig.js';
import type { AvatarConfig } from '@game/shared';

/**
 * =====================================================================
 *  CUERPO DEL PERSONAJE BASE
 * =====================================================================
 *  Anatomía estilizada del único personaje de TinyStrike. Cada pieza se
 *  construye con secciones superelípticas para que la silueta tenga
 *  cambios de volumen reales: mandíbula, hombros, cintura, codo, rodilla,
 *  tobillo y pie. Nada es una cápsula ni una esfera.
 *
 *  Los PERFILES son públicos a propósito: la ropa se construye inflando
 *  el mismo perfil del cuerpo, así una prenda abraza la anatomía en vez
 *  de flotar sobre ella, y una chaqueta gruesa ensancha de verdad la
 *  silueta.
 *
 *  Las geometrías se cachean por proporciones: todos los jugadores con
 *  los mismos sliders comparten los mismos buffers en GPU. Por eso la
 *  caché es la dueña de las geometrías y un avatar solo libera lo suyo.
 * =====================================================================
 */

export type BodyRegion =
  | 'head' | 'neck' | 'torso'
  | 'armUpper' | 'armLower' | 'hand'
  | 'legUpper' | 'legLower' | 'foot';

export interface BodyParts {
  /** Mallas de piel por región, para poder ocultarlas bajo la ropa. */
  region: Record<BodyRegion, THREE.Mesh[]>;
  all: THREE.Mesh[];
}

// Los perfiles viven en profiles.ts y se reexportan para que la ropa los use.
export {
  headProfile, torsoProfile, armUpperProfile, armLowerProfile, handProfile,
  legUpperProfile, legLowerProfile, footProfile,
  sliceProfile, inflateProfile, lerpRing, ringAt, headSurfaceZ,
} from './profiles.js';

// ---------------------------------------------------------- construcción

interface BodyGeometries {
  head: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  armUpper: THREE.BufferGeometry;
  armLower: THREE.BufferGeometry;
  handL: THREE.BufferGeometry;
  handR: THREE.BufferGeometry;
  legUpper: THREE.BufferGeometry;
  legLower: THREE.BufferGeometry;
  foot: THREE.BufferGeometry;
}

const cache = new Map<string, BodyGeometries>();

function headGeometry(p: Proportions): THREE.BufferGeometry {
  const H = p.headH, W = p.headHalfW, D = p.headHalfD;
  const skull = loft(headProfile(p), { segments: 26 });
  // Orejas: conchas aplanadas pegadas a las sienes.
  const ears = [-1, 1].map((s) =>
    place(blob(W * 0.10, H * 0.062, D * 0.055, 2.2, 10, 6), s * W * 0.93, H * 0.38, -D * 0.06, 0, 0, s * 0.18),
  );
  // Nariz: un botón discreto, suficiente para dar perfil.
  const noseY = H * 0.30;
  const nose = place(blob(W * 0.085, H * 0.038, D * 0.085, 2.4, 10, 6), 0, noseY, headSurfaceZ(p, noseY) - W * 0.03);
  return bakeAO(merge([skull, ...ears, nose]), 0.20);
}

function neckGeometry(p: Proportions): THREE.BufferGeometry {
  const r = p.shoulderHalf * 0.44;
  return bakeAO(loft([
    { y: -0.018, w: r * 1.18, d: r * 1.05, n: 2.6 },
    { y: 0.010, w: r * 1.00, d: r * 0.92, n: 2.6 },
    { y: p.neckH + 0.014, w: r * 0.94, d: r * 0.88, n: 2.6 },
  ], { segments: 14 }), 0.26);
}

/** Mano chibi tipo manopla: palma con volumen y pulgar separado. */
function handGeometry(p: Proportions, side: number): THREE.BufferGeometry {
  const r = p.armRadius;
  const palm = loft(handProfile(p), { segments: 14 });
  const thumb = place(
    loft([
      { y: 0, w: r * 0.26, d: r * 0.24, n: 2.6 },
      { y: -r * 0.42, w: r * 0.24, d: r * 0.22, n: 2.6 },
      { y: -r * 0.70, w: r * 0.14, d: r * 0.14, n: 2.6 },
    ], { segments: 10 }),
    -side * r * 0.60, -p.hand * 0.24, r * 0.18, 0, 0, side * 0.75,
  );
  return bakeAO(merge([palm, thumb]), 0.24);
}

function geometriesFor(p: Proportions, key: string): BodyGeometries {
  const hit = cache.get(key);
  if (hit) return hit;
  const g: BodyGeometries = {
    head: headGeometry(p),
    neck: neckGeometry(p),
    torso: bakeAO(loft(torsoProfile(p), { segments: 22 }), 0.22),
    armUpper: bakeAO(loft(armUpperProfile(p), { segments: 14 }), 0.22),
    armLower: bakeAO(loft(armLowerProfile(p), { segments: 14 }), 0.22),
    handL: handGeometry(p, -1),
    handR: handGeometry(p, 1),
    legUpper: bakeAO(loft(legUpperProfile(p), { segments: 14 }), 0.22),
    legLower: bakeAO(loft(legLowerProfile(p), { segments: 14 }), 0.22),
    foot: bakeAO(loft(footProfile(p), { segments: 16 }), 0.26),
  };
  cache.set(key, g);
  return g;
}

/**
 * Cuelga la anatomía del rig. Devuelve las mallas agrupadas por región para
 * que las prendas puedan ocultar la piel que cubren.
 */
export function buildBody(
  rig: ChibiRig,
  p: Proportions,
  sliders: AvatarConfig['sliders'],
  matFor: (region: BodyRegion) => THREE.Material,
): BodyParts {
  const g = geometriesFor(p, proportionsKey(sliders));
  const region: Record<BodyRegion, THREE.Mesh[]> = {
    head: [], neck: [], torso: [], armUpper: [], armLower: [], hand: [], legUpper: [], legLower: [], foot: [],
  };
  const all: THREE.Mesh[] = [];
  const attach = (parent: THREE.Object3D, geo: THREE.BufferGeometry, r: BodyRegion): void => {
    const m = new THREE.Mesh(geo, matFor(r));
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = r;
    parent.add(m);
    region[r].push(m);
    all.push(m);
  };

  attach(rig.head, g.head, 'head');
  attach(rig.neck, g.neck, 'neck');
  attach(rig.torso, g.torso, 'torso');
  attach(rig.shoulderL, g.armUpper, 'armUpper');
  attach(rig.shoulderR, g.armUpper, 'armUpper');
  attach(rig.elbowL, g.armLower, 'armLower');
  attach(rig.elbowR, g.armLower, 'armLower');
  attach(rig.handL, g.handL, 'hand');
  attach(rig.handR, g.handR, 'hand');
  attach(rig.hipL, g.legUpper, 'legUpper');
  attach(rig.hipR, g.legUpper, 'legUpper');
  attach(rig.kneeL, g.legLower, 'legLower');
  attach(rig.kneeR, g.legLower, 'legLower');
  attach(rig.ankleL, g.foot, 'foot');
  attach(rig.ankleR, g.foot, 'foot');

  return { region, all };
}

/** Solo para tests y herramientas: vacía la caché de geometría del cuerpo. */
export function clearBodyCache(): void {
  for (const g of cache.values()) for (const geo of Object.values(g)) geo.dispose();
  cache.clear();
}
