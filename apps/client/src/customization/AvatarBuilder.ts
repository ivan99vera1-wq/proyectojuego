import * as THREE from 'three';
import { COSMETICS, NON_BODY_SLOTS, SLOT_ORDER, type CosmeticId, type CosmeticSlot } from '@game/config';
import type { AvatarConfig } from '@game/shared';
import { baseProportions, buildRig, deriveProportions, rigFromSkeleton, type ChibiRig, type Proportions } from './rig.js';
import { buildBody, type BodyParts, type BodyRegion } from './body.js';
import { attachCharacter, attachCosmetic, cloneSkinnedCharacter, hasCharacterModel, hasCosmetic, hasSkinnedCharacter } from './glb.js';
import { PROCEDURAL_COSMETICS, type PartContext } from './procedural.js';

/**
 * =====================================================================
 *  CONSTRUCTOR DE AVATARES
 * =====================================================================
 *  Un AvatarConfig entra, un personaje 3D sale:
 *
 *    proporciones → rig (huesos) → cuerpo (anatomía) → cosméticos
 *
 *  El cuerpo es siempre el mismo personaje base. Lo único que cambia
 *  entre jugadores son las proporciones, los colores y las piezas que
 *  se enganchan a los sockets del rig.
 *
 *  Las geometrías del cuerpo están cacheadas y compartidas entre
 *  jugadores, así que `dispose()` solo libera materiales y las piezas
 *  propias de este avatar.
 * =====================================================================
 */

export interface ChibiModel {
  root: THREE.Group;
  rig: ChibiRig;
  body: BodyParts;
  proportions: Proportions;
  /** Altura de la coronilla, para colocar la etiqueta de nombre. */
  height: number;
  materials: THREE.Material[];

  // --- atajos a los huesos que usa la animación ---
  hips: THREE.Group;
  torso: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  neck: THREE.Group;
  back: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  /** Punto de agarre del arma en la mano derecha. */
  gripR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  ankleL: THREE.Group;
  ankleR: THREE.Group;

  dispose(): void;
}

/** Materiales base por canal de color. Cada avatar tiene los suyos. */
function makeMaterials(config: AvatarConfig) {
  const owned: THREE.Material[] = [];
  const make = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02, ...opts });
    owned.push(m);
    return m;
  };
  /** Piel: lleva colores de vértice porque el cuerpo trae oclusión horneada. */
  const skin = (extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    make(config.colors.skin, { vertexColors: true, roughness: 0.78, ...extra });
  return { owned, make, skin };
}

let warnedMissingBones = false;

export function buildChibi(config: AvatarConfig): ChibiModel {
  const { owned, make, skin } = makeMaterials(config);
  // Con el modelo de Blender las articulaciones deben quedarse donde las dejó
  // el exportador; los sliders solo escalan huesos, no los mueven.
  const useModel = hasCharacterModel();
  const p = useModel ? baseProportions() : deriveProportions(config.sliders);

  // Personaje con esqueleto: el rig ES el del modelo. Si el GLB no trae skin
  // (o le faltan huesos) se cae al rig construido a mano, que sigue sirviendo
  // para el cuerpo procedural de respaldo.
  let rig: ChibiRig;
  let skinned: ReturnType<typeof cloneSkinnedCharacter> = null;
  if (useModel && hasSkinnedCharacter()) {
    skinned = cloneSkinnedCharacter(config);
    const built = skinned ? rigFromSkeleton(skinned.bones, skinned.root, p) : null;
    if (built && built.missing.length === 0) {
      rig = built.rig;
      owned.push(...skinned!.materials);
    } else {
      if (built && !warnedMissingBones) {
        warnedMissingBones = true;
        console.warn('[avatar] al esqueleto del modelo le faltan huesos:', built.missing.join(', '));
      }
      skinned = null;
      rig = buildRig(p);
    }
  } else {
    rig = buildRig(p);
  }

  // Cada región de piel tiene su propio material para que una prenda que
  // recoloree el torso no tiña también la cara ni las manos.
  const skinMats: Partial<Record<BodyRegion, THREE.Material>> = {};
  const matFor = (region: BodyRegion): THREE.Material => {
    const shared: Record<string, BodyRegion> = { head: 'head', neck: 'head', hand: 'hand', foot: 'foot' };
    const key = shared[region] ?? region;
    let m = skinMats[key as BodyRegion];
    if (!m) { m = skin(); skinMats[key as BodyRegion] = m; }
    return m;
  };
  // Si el modelo hecho en Blender está cargado, se usa ese. La versión
  // procedural queda como respaldo: preferimos un personaje feo a una
  // pantalla vacía si el GLB no llega.
  const body: BodyParts = useModel
    ? { region: { head: [], neck: [], torso: [], armUpper: [], armLower: [], hand: [], legUpper: [], legLower: [], foot: [] }, all: [] }
    : buildBody(rig, p, config.sliders, matFor);
  if (useModel && !skinned) {
    // Modelo antiguo por piezas rígidas: se cuelga cada malla de su hueso.
    owned.push(...attachCharacter(rig, config));
  }
  if (useModel) {
    // Los sliders de proporción no pueden deformar una malla ya horneada:
    // el tamaño de cabeza se aplica como escala del hueso.
    const headK = 0.90 + (config.sliders.headSize - 0.3) / 0.7 * 0.20;
    rig.head.scale.setScalar(headK);
  }

  const ctx: PartContext = {
    rig, body, p,
    colors: config.colors,
    mat: make,
    cloth: (color, opts) => make(color, { vertexColors: true, ...opts }),
    hide: (...regions: BodyRegion[]) => {
      for (const r of regions) for (const m of body.region[r]) m.visible = false;
    },
  };

  // Rasgos que YA vienen modelados dentro del personaje base. Mientras no
  // existan como pieza de Blender intercambiable, dibujar además la versión
  // procedural pondría dos pares de ojos, uno encima del otro.
  const FACE_SLOTS: readonly CosmeticSlot[] = ['face', 'eyes', 'brows', 'mouth'];

  // Orden explícito de capas: la camiseta antes que la chaqueta, el pantalón
  // antes que las botas. Así lo exterior siempre cae encima de lo interior.
  for (const slot of SLOT_ORDER) {
    if (NON_BODY_SLOTS.includes(slot)) continue;
    const id = config.items[slot] as CosmeticId | undefined;
    if (!id) continue;
    const item = COSMETICS[id];
    if (!item || item.model === '') continue;
    // Pieza modelada en Blender si existe; si no, la versión procedural. Así
    // se puede ir migrando cosmético a cosmético sin dejar huecos.
    if (useModel && hasCosmetic(id)) owned.push(...attachCosmetic(rig, config, id));
    else if (skinned && FACE_SLOTS.includes(slot)) continue;
    else PROCEDURAL_COSMETICS[id]?.(ctx);
  }

  return {
    root: rig.root, rig, body, proportions: p,
    height: p.y.crown,
    materials: owned,
    hips: rig.hips, torso: rig.torso, chest: rig.chest, head: rig.head, neck: rig.neck, back: rig.back,
    shoulderL: rig.shoulderL, shoulderR: rig.shoulderR,
    elbowL: rig.elbowL, elbowR: rig.elbowR,
    handL: rig.handL, handR: rig.handR, gripR: rig.gripR,
    hipL: rig.hipL, hipR: rig.hipR,
    kneeL: rig.kneeL, kneeR: rig.kneeR,
    ankleL: rig.ankleL, ankleR: rig.ankleR,
    dispose: () => {
      // La geometría del cuerpo vive en la caché compartida; aquí solo se
      // liberan los materiales y las geometrías propias de los cosméticos.
      for (const m of owned) m.dispose();
      rig.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.geometry) return;
        if (!body.all.includes(mesh)) mesh.geometry.dispose();
      });
    },
  };
}

export type { Proportions, ChibiRig } from './rig.js';
export type { BodyRegion, BodyParts } from './body.js';
