import * as THREE from 'three';
import { baseProportions, rigFromSkeleton, type ChibiRig, type Proportions } from './rig.js';
import { cloneSkinnedCharacter, hasSkinnedCharacter } from './glb.js';

/**
 * =====================================================================
 *  CONSTRUCTOR DEL PERSONAJE
 * =====================================================================
 *  ChibiStrike tiene un solo personaje y no hay personalización, así
 *  que montar uno es clonar el modelo y adoptar su esqueleto.
 *
 *  El clon es obligatorio por jugador: varias instancias no pueden
 *  compartir esqueleto o se moverían todas a la vez.
 * =====================================================================
 */

export interface ChibiModel {
  root: THREE.Group;
  rig: ChibiRig;
  proportions: Proportions;
  /** Mallas visibles del personaje. */
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

let warnedMissingBones = false;
let warnedNoModel = false;

export function buildChibi(): ChibiModel {
  const p = baseProportions();
  const meshes: THREE.Mesh[] = [];

  const skinned = hasSkinnedCharacter() ? cloneSkinnedCharacter() : null;
  const built = skinned ? rigFromSkeleton(skinned.bones, skinned.root, p) : null;

  let rig: ChibiRig;
  if (skinned && built && built.missing.length === 0) {
    rig = built.rig;
    rig.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });
  } else {
    if (built && built.missing.length && !warnedMissingBones) {
      warnedMissingBones = true;
      console.warn('[personaje] al esqueleto del modelo le faltan huesos:', built.missing.join(', '));
    } else if (!skinned && !warnedNoModel) {
      warnedNoModel = true;
      console.warn('[personaje] no hay modelo cargado: se dibuja solo el esqueleto');
    }
    // Sin modelo no hay nada que dibujar, pero el rig tiene que existir
    // igualmente: la partida sigue y el jugador ocupa su sitio.
    rig = rigFromSkeleton(new Map(), new THREE.Group(), p)!.rig;
  }

  return {
    root: rig.root, rig, proportions: p, meshes,
    height: p.y.crown,
    // La geometría y los materiales son compartidos entre todos los
    // jugadores, así que este modelo no posee nada que liberar.
    materials: [],
    hips: rig.hips, torso: rig.torso, chest: rig.chest, head: rig.head, neck: rig.neck, back: rig.back,
    shoulderL: rig.shoulderL, shoulderR: rig.shoulderR,
    elbowL: rig.elbowL, elbowR: rig.elbowR,
    handL: rig.handL, handR: rig.handR, gripR: rig.gripR,
    hipL: rig.hipL, hipR: rig.hipR,
    kneeL: rig.kneeL, kneeR: rig.kneeR,
    ankleL: rig.ankleL, ankleR: rig.ankleR,
    dispose: () => { /* nada propio que liberar */ },
  };
}

export type { Proportions, ChibiRig } from './rig.js';
