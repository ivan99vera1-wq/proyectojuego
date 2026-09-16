import * as THREE from 'three';
import type { AvatarConfig } from '@game/shared';
import type { ChibiRig, Proportions } from './rig.js';
import type { BodyParts, BodyRegion } from './body.js';

/** Lo que recibe cada constructor de cosmético para montarse sobre el cuerpo. */
export interface PartContext {
  rig: ChibiRig;
  body: BodyParts;
  p: Proportions;
  colors: AvatarConfig['colors'];
  /** Material plano, para piezas simples sin oclusión horneada. */
  mat: (color: string, opts?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial;
  /** Material para piezas hechas con el kit de geometría (traen AO en vértices). */
  cloth: (color: string, opts?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial;
  /** Oculta la piel que la prenda cubre, para no ver geometría por dentro. */
  hide: (...regions: BodyRegion[]) => void;
}

export type PartBuilder = (ctx: PartContext) => void;

/** Cuelga una geometría de un hueso, con sombras activadas. */
export function attach(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color: forros, suelas, sombras. */
export function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(amount >= 0 ? '#ffffff' : '#000000'), Math.abs(amount));
  return `#${c.getHexString()}`;
}
