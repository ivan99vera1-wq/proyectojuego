import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AvatarConfig } from '@game/shared';
import type { ChibiRig } from './rig.js';

/**
 * =====================================================================
 *  CARGA DEL MODELO HECHO EN BLENDER
 * =====================================================================
 *  El personaje y las armas se modelan en `assets/blender` y se exportan
 *  a GLB. Cada pieza sale con el origen puesto en su articulación, así
 *  que aquí solo hay que colgarla del hueso correspondiente del rig y el
 *  sistema de animación que ya existe sigue funcionando igual.
 *
 *  Los materiales cuyo nombre empieza por `Recolor_` se clonan por
 *  jugador y se pintan con el color que ha elegido: es el contrato con
 *  el modelo, documentado en assets/blender/README.md.
 * =====================================================================
 */

export type RigSocket = keyof ChibiRig;

/** A qué hueso del rig se engancha cada pieza del modelo. */
const PART_SOCKET: Record<string, RigSocket> = {
  Head: 'head', Nose: 'head', EarL: 'head', EarR: 'head', Hair: 'head',
  Neck: 'neck',
  Torso: 'torso', Shirt: 'torso', Vest: 'torso',
  VestPouchL: 'torso', VestPouchR: 'torso', VestStrapL: 'torso', VestStrapR: 'torso',
  PantsHips: 'torso',
  ArmUpperL: 'shoulderL', SleeveUpperL: 'shoulderL',
  ArmUpperR: 'shoulderR', SleeveUpperR: 'shoulderR',
  ArmLowerL: 'elbowL', SleeveLowerL: 'elbowL',
  ArmLowerR: 'elbowR', SleeveLowerR: 'elbowR',
  HandL: 'handL', GloveL: 'handL',
  HandR: 'handR', GloveR: 'handR',
  LegUpperL: 'hipL', PantsLegUpperL: 'hipL', PantsPocketL: 'hipL',
  LegUpperR: 'hipR', PantsLegUpperR: 'hipR', PantsPocketR: 'hipR',
  LegLowerL: 'kneeL', PantsLegLowerL: 'kneeL', BootShaftL: 'kneeL',
  LegLowerR: 'kneeR', PantsLegLowerR: 'kneeR', BootShaftR: 'kneeR',
  FootL: 'ankleL', BootUpperL: 'ankleL', BootSoleL: 'ankleL',
  FootR: 'ankleR', BootUpperR: 'ankleR', BootSoleR: 'ankleR',
};

/** Las piezas de la cara van todas a la cabeza; sus nombres llevan prefijo. */
function socketFor(name: string): RigSocket | null {
  const direct = PART_SOCKET[name];
  if (direct) return direct;
  if (/^(Eye[LR]_|Brow[LR]|Mouth)/.test(name)) return 'head';
  return null;
}

export interface LoadedModel {
  parts: Map<string, THREE.Mesh>;
}

const MODELS = {
  character: 'assets/models/characters/character.glb',
  weapons: 'assets/models/weapons/weapons.glb',
} as const;

const loaded: Partial<Record<keyof typeof MODELS, LoadedModel>> = {};

async function loadModel(key: keyof typeof MODELS): Promise<LoadedModel> {
  const gltf = await new GLTFLoader().loadAsync(MODELS[key]);
  gltf.scene.updateMatrixWorld(true);
  const parts = new Map<string, THREE.Mesh>();
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // El exportador puede añadir sufijos de desambiguación: se ignoran.
    const name = mesh.name.replace(/\.\d+$/, '');
    if (!parts.has(name)) parts.set(name, mesh);
  });
  return { parts };
}

/**
 * Carga el personaje y las armas. Si algo falla, el juego sigue con la
 * versión procedural: preferimos un personaje feo a una pantalla negra.
 */
export async function preloadModels(): Promise<void> {
  const results = await Promise.allSettled([loadModel('character'), loadModel('weapons')]);
  const keys: (keyof typeof MODELS)[] = ['character', 'weapons'];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') loaded[keys[i]!] = res.value;
    else console.warn(`[modelos] no se pudo cargar ${keys[i]}:`, res.reason);
  });
}

export const hasCharacterModel = (): boolean => !!loaded.character;

/** Solo para depuración: posición en el mundo de cada pieza tal como llega. */
export function debugPartPositions(): string[] {
  const model = loaded.character;
  if (!model) return [];
  const v = new THREE.Vector3();
  return [...model.parts.entries()].map(([name, mesh]) => {
    mesh.getWorldPosition(v);
    return `${name} y=${v.y.toFixed(3)} x=${v.x.toFixed(3)} z=${v.z.toFixed(3)} s=${mesh.scale.x.toFixed(2)}`;
  });
}
export const hasWeaponModels = (): boolean => !!loaded.weapons;

/** Clona un arma del GLB por su id. Devuelve null si no está disponible. */
export function cloneWeapon(id: string, skinColor?: string): THREE.Object3D | null {
  const mesh = loaded.weapons?.parts.get(id);
  if (!mesh) return null;
  const clone = mesh.clone();
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.castShadow = true;
  if (skinColor) {
    const mats = Array.isArray(clone.material) ? clone.material : [clone.material];
    const tinted: THREE.Material[] = mats.map((m) => {
      const c = (m as THREE.MeshStandardMaterial).clone();
      if (/Gun_Body|Gun_Grip/.test(c.name)) c.color.set(skinColor);
      return c;
    });
    clone.material = tinted.length === 1 ? tinted[0]! : tinted;
  }
  return clone;
}

/**
 * Cuelga las piezas del modelo de los huesos del rig.
 * Devuelve los materiales creados para que el avatar los libere al morir.
 */
export function attachCharacter(rig: ChibiRig, config: AvatarConfig): THREE.Material[] {
  const model = loaded.character;
  if (!model) return [];

  const channelColor: Record<string, string> = {
    Recolor_skin: config.colors.skin,
    Recolor_hair: config.colors.hair,
    Recolor_eyes: config.colors.eyes,
    Recolor_primary: config.colors.primary,
    Recolor_secondary: config.colors.secondary,
  };
  const owned: THREE.Material[] = [];
  const materialCache = new Map<string, THREE.Material>();
  const resolve = (source: THREE.Material): THREE.Material => {
    const hit = materialCache.get(source.uuid);
    if (hit) return hit;
    const color = channelColor[source.name];
    if (!color) {
      materialCache.set(source.uuid, source);
      return source;
    }
    const clone = (source as THREE.MeshStandardMaterial).clone();
    clone.color.set(color);
    materialCache.set(source.uuid, clone);
    owned.push(clone);
    return clone;
  };

  rig.root.updateMatrixWorld(true);
  const world = new THREE.Vector3();
  for (const [name, mesh] of model.parts) {
    const socketName = socketFor(name);
    if (!socketName) continue;
    const socket = rig[socketName] as THREE.Object3D | undefined;
    if (!socket || !(socket as THREE.Object3D).isObject3D) continue;

    const clone = mesh.clone();
    clone.name = name;
    clone.castShadow = true;
    clone.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const resolved = mats.map(resolve);
    clone.material = resolved.length === 1 ? resolved[0]! : resolved;

    // La pieza viene con su posición en el mundo del modelo; se convierte al
    // espacio local del hueso para que quede exactamente donde la puso Blender.
    mesh.getWorldPosition(world);
    socket.worldToLocal(world);
    clone.position.copy(world);
    clone.quaternion.copy(mesh.quaternion);
    clone.scale.copy(mesh.scale);
    socket.add(clone);
  }
  return owned;
}
