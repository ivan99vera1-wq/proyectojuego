import * as THREE from 'three';
import { COSMETICS, NON_BODY_SLOTS, SLOT_ORDER, type CosmeticId } from '@game/config';
import type { AvatarConfig } from '@game/shared';
import { baseProportions, rigFromSkeleton, type ChibiRig, type Proportions } from './rig.js';
import { cloneSkinnedCharacter, hasSkinnedCharacter } from './glb.js';

/**
 * =====================================================================
 *  CONSTRUCTOR DE AVATARES
 * =====================================================================
 *  El personaje entero (cuerpo, cara y guardarropa) vive en UN SOLO GLB
 *  con un único esqueleto. Montar un avatar es por tanto:
 *
 *    clonar el modelo → quitar lo que no lleva puesto → pintar colores
 *
 *  No hay "enganchar una prenda a un hueso": la ropa está enlazada al
 *  mismo esqueleto que el cuerpo, así que se dobla con él. Ese era el
 *  origen de que todo se encimara y de que la mochila apareciera en el
 *  pecho: las piezas se colocaban a mano en puntos de anclaje.
 * =====================================================================
 */

export interface ChibiModel {
  root: THREE.Group;
  rig: ChibiRig;
  proportions: Proportions;
  /** Mallas visibles del personaje (cuerpo, cara y ropa puesta). */
  meshes: THREE.Mesh[];
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

/** Nombre de malla -> (idDelCosmetico, parte). Las del cuerpo no llevan `__`. */
function splitName(name: string): { id: string; part: string } | null {
  const i = name.indexOf('__');
  return i < 0 ? null : { id: name.slice(0, i), part: name.slice(i + 2) };
}

/**
 * Qué cosméticos lleva puestos este avatar, ya resueltos.
 * Los slots sin geometría (la skin de arma solo tiñe el arma) no entran.
 */
function wornIds(config: AvatarConfig): Set<string> {
  const worn = new Set<string>();
  for (const slot of SLOT_ORDER) {
    if (NON_BODY_SLOTS.includes(slot)) continue;
    const id = config.items[slot] as CosmeticId | undefined;
    if (!id) continue;
    const item = COSMETICS[id];
    if (!item || item.model === '') continue;
    worn.add(id);
  }
  return worn;
}

let warnedMissingBones = false;
let warnedNoModel = false;

export function buildChibi(config: AvatarConfig): ChibiModel {
  const p = baseProportions();
  const owned: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];

  const skinned = hasSkinnedCharacter() ? cloneSkinnedCharacter(config) : null;
  const built = skinned ? rigFromSkeleton(skinned.bones, skinned.root, p) : null;

  let rig: ChibiRig;
  if (skinned && built && built.missing.length === 0) {
    rig = built.rig;
    owned.push(...skinned.materials);

    // Quitar del clon lo que este jugador no lleva puesto. Se elimina en vez
    // de ocultarse: una malla invisible sigue costando matrices cada frame y
    // aquí hay veintitantos cosméticos por jugador.
    const worn = wornIds(config);
    const hat = !!config.items.headwear && COSMETICS[config.items.headwear as CosmeticId]?.model !== '';
    const doomed: THREE.Object3D[] = [];
    rig.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const parsed = splitName(mesh.name);
      if (!parsed) { meshes.push(mesh); return; }      // cuerpo o nariz
      // Los mechones sueltos atraviesan cualquier gorro, así que con algo en
      // la cabeza solo se deja el casquete, que va pegado al cráneo.
      const hiddenByHat = hat && parsed.id.startsWith('hair_') && parsed.part.startsWith('Locks');
      if (!worn.has(parsed.id) || hiddenByHat) doomed.push(mesh);
      else meshes.push(mesh);
    });
    for (const obj of doomed) obj.removeFromParent();
  } else {
    if (built && built.missing.length && !warnedMissingBones) {
      warnedMissingBones = true;
      console.warn('[avatar] al esqueleto del modelo le faltan huesos:', built.missing.join(', '));
    } else if (!skinned && !warnedNoModel) {
      warnedNoModel = true;
      console.warn('[avatar] no hay modelo de personaje cargado: se dibuja solo el rig');
    }
    // Sin modelo no hay personaje que dibujar, pero el rig tiene que existir
    // igualmente: la partida sigue y el jugador ocupa su sitio.
    rig = built ? built.rig : rigFromSkeleton(new Map(), new THREE.Group(), p)!.rig;
  }

  // El tamaño de cabeza no puede deformar una malla ya horneada: se aplica
  // como escala del hueso de la cabeza.
  const headK = 0.90 + (config.sliders.headSize - 0.3) / 0.7 * 0.20;
  rig.head.scale.setScalar(headK);

  return {
    root: rig.root, rig, proportions: p, meshes,
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
      // La geometría es compartida entre todos los jugadores (el clon del
      // esqueleto la reutiliza), así que aquí solo se liberan los materiales
      // repintados con los colores de ESTE jugador.
      for (const m of owned) m.dispose();
    },
  };
}

export type { Proportions, ChibiRig } from './rig.js';
