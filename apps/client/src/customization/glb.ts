import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarConfig } from '@game/shared';
import { boneKey, type ChibiRig } from './rig.js';

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

/**
 * A qué hueso va cada pieza. Primero la tabla directa del cuerpo y luego
 * reglas por nombre, que es lo que permite añadir cosméticos nuevos en Blender
 * sin tocar el cliente: basta con respetar la convención de nombres.
 */
function socketFor(part: string): RigSocket | null {
  const direct = PART_SOCKET[part];
  if (direct) return direct;
  const isL = part.endsWith('L');
  const isR = part.endsWith('R');
  const side = (l: RigSocket, r: RigSocket): RigSocket | null => (isL ? l : isR ? r : null);

  if (/Sleeve.*Upper[LR]$/.test(part)) return side('shoulderL', 'shoulderR');
  if (/Sleeve.*Lower[LR]$/.test(part)) return side('elbowL', 'elbowR');
  if (/^Pants(LegUpper|Pocket)[LR]$/.test(part)) return side('hipL', 'hipR');
  if (/^(PantsLegLower|BootShaft)[LR]$/.test(part)) return side('kneeL', 'kneeR');
  if (/^Boot(Upper|Sole)[LR]$/.test(part)) return side('ankleL', 'ankleR');
  if (/^Glove[LR]$/.test(part)) return side('handL', 'handR');
  if (/^(Hair|Hat|Glasses|Goggles|Visor|Headset|Earmuff|Eye[LR]_|Brow|Mouth|Nose|Ear)/.test(part)) return 'head';
  if (/^(Scarf|Mask|Backpack|Shirt|Vest|Hoodie|Jacket|PantsHips)/.test(part)) return 'torso';
  return null;
}

export interface LoadedModel {
  parts: Map<string, THREE.Mesh>;
  /** Escena completa tal como vino del GLB. La necesita el personaje con skin. */
  scene: THREE.Group;
  /** Clips de animación exportados desde Blender. */
  clips: THREE.AnimationClip[];
}

const MODELS = {
  character: 'assets/models/characters/character.glb',
  weapons: 'assets/models/weapons/weapons.glb',
  cosmetics: 'assets/models/cosmetics/cosmetics.glb',
  map_playground: 'assets/maps/playground.glb',
  map_candy_factory: 'assets/maps/candy_factory.glb',
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
  return { parts, scene: gltf.scene, clips: gltf.animations ?? [] };
}

/**
 * Carga el personaje y las armas. Si algo falla, el juego sigue con la
 * versión procedural: preferimos un personaje feo a una pantalla negra.
 */
export async function preloadModels(): Promise<void> {
  const keys = Object.keys(MODELS) as (keyof typeof MODELS)[];
  const results = await Promise.allSettled(keys.map(loadModel));
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') loaded[keys[i]!] = res.value;
    else console.warn(`[modelos] no se pudo cargar ${keys[i]}:`, res.reason);
  });
}

export const hasCharacterModel = (): boolean => !!loaded.character;

/**
 * =====================================================================
 *  PERSONAJE CON ESQUELETO
 * =====================================================================
 *  El personaje base sale de Blender como una malla CON SKIN: hombros,
 *  codos y rodillas se deforman de verdad en vez de ser piezas rígidas
 *  encajadas unas con otras.
 *
 *  Los huesos llegan con sus ejes locales alineados con los del mundo
 *  (lo garantiza `flatten_orientations` en assets/blender/lib/rig.py y
 *  lo comprueba tools/check-bone-axes.mjs). Gracias a eso, girar un
 *  hueso significa lo mismo que girar un grupo normal y el sistema de
 *  animación del juego no ha tenido que cambiar.
 * =====================================================================
 */

export interface SkinnedCharacter {
  /** Raíz clonada del GLB, lista para colgar del rig. */
  root: THREE.Object3D;
  /** Huesos por nombre de Blender (`hips`, `upperarm.L`, ...). */
  bones: Map<string, THREE.Bone>;
  /** Materiales clonados y repintados con los colores del jugador. */
  materials: THREE.Material[];
  clips: THREE.AnimationClip[];
}

/** ¿El GLB del personaje trae esqueleto con pesos? */
export function hasSkinnedCharacter(): boolean {
  const model = loaded.character;
  if (!model) return false;
  let skinned = false;
  model.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
  return skinned;
}

/**
 * Clona el personaje para un jugador y le aplica sus colores.
 * `SkeletonUtils.clone` es obligatorio: el clone normal de Three duplica las
 * mallas pero las deja apuntando al esqueleto original, y entonces todos los
 * jugadores se moverían a la vez.
 */
export function cloneSkinnedCharacter(config: AvatarConfig): SkinnedCharacter | null {
  const model = loaded.character;
  if (!model) return null;
  const root = cloneSkinned(model.scene);
  const bones = new Map<string, THREE.Bone>();
  const materials: THREE.Material[] = [];
  const cache = new Map<string, THREE.Material>();
  const channelColor: Record<string, string> = {
    Recolor_skin: config.colors.skin,
    Recolor_hair: config.colors.hair,
    Recolor_eyes: config.colors.eyes,
    Recolor_primary: config.colors.primary,
    Recolor_secondary: config.colors.secondary,
  };
  const resolve = (source: THREE.Material): THREE.Material => {
    const color = channelColor[source.name];
    if (!color) return source;
    let mat = cache.get(source.name);
    if (!mat) {
      const clone = (source as THREE.MeshStandardMaterial).clone();
      clone.color.set(color);
      cache.set(source.name, clone);
      materials.push(clone);
      mat = clone;
    }
    return mat;
  };

  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      bones.set(boneKey(obj.name), obj as THREE.Bone);
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // `frustumCulled` apagado: una malla con skin puede salirse de su caja
    // original al animarse y Three la haría desaparecer a media pantalla.
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const resolved = mats.map(resolve);
    mesh.material = resolved.length === 1 ? resolved[0]! : resolved;
  });
  return { root, bones, materials, clips: model.clips };
}

/**
 * Arte del mapa hecho en Blender. Es SOLO presentación: la geometría de
 * colisión sigue siendo la lista de cajas del layout, que es la que comparten
 * cliente y servidor. Por eso el arte se genera a partir de esos mismos datos.
 */
export function mapModelGroup(mapId: string): THREE.Group | null {
  const model = loaded[`map_${mapId}` as keyof typeof MODELS];
  if (!model) return null;
  const group = new THREE.Group();
  group.name = `map_${mapId}`;
  for (const mesh of model.parts.values()) {
    const clone = mesh.clone();
    mesh.getWorldPosition(clone.position);
    clone.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));
    clone.scale.copy(mesh.getWorldScale(new THREE.Vector3()));
    clone.castShadow = true;
    clone.receiveShadow = true;
    group.add(clone);
  }
  return group;
}

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
interface Attacher {
  place(name: string, mesh: THREE.Mesh): void;
  owned: THREE.Material[];
}

function makeAttacher(rig: ChibiRig, config: AvatarConfig): Attacher {
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
  return {
    owned,
    place(name: string, mesh: THREE.Mesh) {
      const socketName = socketFor(name);
      if (!socketName) return;
      const socket = rig[socketName] as THREE.Object3D | undefined;
      if (!socket || !socket.isObject3D) return;

      const clone = mesh.clone();
      clone.name = name;
      clone.castShadow = true;
      clone.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const resolved = mats.map(resolve);
      clone.material = resolved.length === 1 ? resolved[0]! : resolved;

      // La pieza viene con su posición en el mundo del modelo; se convierte al
      // espacio local del hueso para quedar donde la dejó Blender.
      mesh.getWorldPosition(world);
      socket.worldToLocal(world);
      clone.position.copy(world);
      clone.quaternion.copy(mesh.quaternion);
      clone.scale.copy(mesh.scale);
      socket.add(clone);
    },
  };
}

/** Cuelga el CUERPO del personaje (sin ropa) de los huesos del rig. */
export function attachCharacter(rig: ChibiRig, config: AvatarConfig): THREE.Material[] {
  const model = loaded.character;
  if (!model) return [];
  const attacher = makeAttacher(rig, config);
  for (const [name, mesh] of model.parts) attacher.place(name, mesh);
  return attacher.owned;
}

/** ¿Hay piezas modeladas en Blender para este cosmético? */
export function hasCosmetic(id: string): boolean {
  const model = loaded.cosmetics;
  if (!model) return false;
  for (const name of model.parts.keys()) if (name.startsWith(`${id}__`)) return true;
  return false;
}

/**
 * Cuelga las piezas de un cosmético. Los nombres son `<id>__<Pieza>`, así que
 * añadir un cosmético nuevo en Blender no requiere tocar el cliente.
 */
export function attachCosmetic(rig: ChibiRig, config: AvatarConfig, id: string): THREE.Material[] {
  const model = loaded.cosmetics;
  if (!model) return [];
  const attacher = makeAttacher(rig, config);
  const prefix = `${id}__`;
  for (const [name, mesh] of model.parts) {
    if (!name.startsWith(prefix)) continue;
    attacher.place(name.slice(prefix.length), mesh);
  }
  return attacher.owned;
}
