import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { boneKey } from './rig.js';

/**
 * =====================================================================
 *  CARGA DE LOS MODELOS HECHOS EN BLENDER
 * =====================================================================
 *  El personaje entero (cuerpo, cara y guardarropa) llega en un único
 *  GLB con un solo esqueleto, y cada malla de ropa se llama
 *  `<idDelCosmetico>__<Parte>`. El avatar se monta clonando el modelo y
 *  quitando lo que el jugador no lleva puesto.
 *
 *  Hay un solo personaje y no hay personalización, así que los
 *  materiales se comparten entre todos los jugadores: solo el esqueleto
 *  se clona (ver `cloneSkinnedCharacter`).
 * =====================================================================
 */

export interface LoadedModel {
  /** Mallas sueltas por nombre. Lo usa el arte de los mapas. */
  parts: Map<string, THREE.Mesh>;
  /**
   * NODOS por nombre, sean malla o grupo.
   *
   * Hace falta porque una malla con varios materiales llega de glTF como un
   * grupo con un hijo por material: el nombre del objeto (el id del arma) lo
   * lleva el GRUPO, y buscando solo mallas no aparece nunca. Ese era el motivo
   * de que el juego dibujara siempre las armas procedurales de respaldo.
   */
  nodes: Map<string, THREE.Object3D>;
  /** Escena completa tal como vino del GLB. La necesita el personaje con skin. */
  scene: THREE.Group;
  /** Clips de animación exportados desde Blender. */
  clips: THREE.AnimationClip[];
}

/**
 * El personaje va entero en un archivo: cuerpo, cara y guardarropa comparten
 * esqueleto. Un GLB por cosmético obligaría a reenlazar cada prenda al
 * esqueleto del jugador en tiempo de ejecución.
 */
const MODELS = {
  character: 'assets/models/characters/character.glb',
  weapons: 'assets/models/weapons/weapons.glb',
  map_playground: 'assets/maps/playground.glb',
  map_candy_factory: 'assets/maps/candy_factory.glb',
} as const;

const loaded: Partial<Record<keyof typeof MODELS, LoadedModel>> = {};

async function loadModel(key: keyof typeof MODELS): Promise<LoadedModel> {
  const gltf = await new GLTFLoader().loadAsync(MODELS[key]);
  gltf.scene.updateMatrixWorld(true);
  const parts = new Map<string, THREE.Mesh>();
  const nodes = new Map<string, THREE.Object3D>();
  gltf.scene.traverse((obj) => {
    if (obj === gltf.scene) return;
    // El exportador puede añadir sufijos de desambiguación: se ignoran.
    const name = obj.name.replace(/\.\d+$/, '');
    if (name && !nodes.has(name)) nodes.set(name, obj);
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && !parts.has(name)) parts.set(name, mesh);
  });
  return { parts, nodes, scene: gltf.scene, clips: gltf.animations ?? [] };
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
 * Clona el personaje para un jugador.
 * `SkeletonUtils.clone` es obligatorio: el clone normal de Three duplica las
 * mallas pero las deja apuntando al esqueleto original, y entonces todos los
 * jugadores se moverían a la vez.
 */
export function cloneSkinnedCharacter(): SkinnedCharacter | null {
  const model = loaded.character;
  if (!model) return null;
  const root = cloneSkinned(model.scene);
  const bones = new Map<string, THREE.Bone>();

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
  });
  return { root, bones, clips: model.clips };
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

export const hasWeaponModels = (): boolean => !!loaded.weapons;

/**
 * Clona un arma del GLB por su id. Devuelve null si no está disponible.
 *
 * Se busca en `nodes` y no en `parts` porque el objeto que lleva el id del arma
 * puede ser un grupo (una malla por material), no una malla suelta.
 */
export function cloneWeapon(id: string, skinColor?: string): THREE.Object3D | null {
  const node = loaded.weapons?.nodes.get(id);
  if (!node) return null;
  const clone = node.clone();
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    if (!skinColor) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const tinted = mats.map((m) => {
      const c = (m as THREE.MeshStandardMaterial).clone();
      if (/Gun_Body|Gun_Grip/.test(c.name)) c.color.set(skinColor);
      return c;
    });
    mesh.material = tinted.length === 1 ? tinted[0]! : tinted;
  });
  return clone;
}

