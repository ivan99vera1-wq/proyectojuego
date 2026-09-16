import * as THREE from 'three';
import { BODY_SLIDERS, CHARACTERS, COSMETICS, type CosmeticId } from '@game/config';
import type { AvatarConfig } from '@game/shared';
import { PROCEDURAL_COSMETICS, type ChibiParts, type PartContext } from './procedural.js';

/** Dimensiones base del chibi (metros). */
export const CHIBI = {
  legLength: 0.30,
  legRadius: 0.075,
  torsoHeight: 0.40,
  torsoWidth: 0.30,
  headRadius: 0.26,
  armLength: 0.28,
  armRadius: 0.06,
};

export interface ChibiModel extends ChibiParts {
  root: THREE.Group;
  /** Altura total sin sliders (para la etiqueta de nombre). */
  height: number;
  materials: THREE.Material[];
  dispose(): void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const norm = (v: number, key: keyof typeof BODY_SLIDERS) => {
  const d = BODY_SLIDERS[key];
  return (v - d.min) / (d.max - d.min);
};

/**
 * Convierte un AvatarConfig en un modelo 3D. Fase actual: piezas procedurales
 * (primitivas) por cosmético; cuando exista arte GLB, `PROCEDURAL_COSMETICS`
 * se sustituye por cargas de modelos manteniendo la misma jerarquía de huesos.
 */
export function buildChibi(config: AvatarConfig): ChibiModel {
  const materials: THREE.Material[] = [];
  const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
    materials.push(m);
    return m;
  };
  const arche = CHARACTERS[config.character];
  const headScale = arche.headScale * lerp(0.82, 1.3, norm(config.sliders.headSize, 'headSize'));
  const eyeScale = lerp(0.7, 1.45, norm(config.sliders.eyeSize, 'eyeSize'));
  const bodyWidth = lerp(0.82, 1.25, norm(config.sliders.bodyWidth, 'bodyWidth'));
  const heightScale = lerp(0.9, 1.1, norm(config.sliders.height, 'height')) * arche.scale;

  const root = new THREE.Group();
  root.name = 'chibi';
  const hips = new THREE.Group();
  hips.position.y = CHIBI.legLength;
  root.add(hips);

  // Piernas (pivote en la cadera)
  const legGeo = new THREE.CapsuleGeometry(CHIBI.legRadius, CHIBI.legLength - CHIBI.legRadius * 2, 4, 10);
  const legMat = mat(config.colors.primary);
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.09 * bodyWidth, 0, 0);
    const m = new THREE.Mesh(legGeo, legMat);
    m.position.y = -CHIBI.legLength / 2;
    m.castShadow = true;
    g.add(m);
    hips.add(g);
    return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // Torso
  const torso = new THREE.Group();
  hips.add(torso);
  const torsoMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(CHIBI.torsoWidth / 2, CHIBI.torsoHeight - CHIBI.torsoWidth, 6, 14),
    mat(config.colors.primary),
  );
  torsoMesh.position.y = CHIBI.torsoHeight / 2;
  torsoMesh.scale.set(bodyWidth, 1, bodyWidth * 0.85);
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  // Brazos (pivote en el hombro)
  const armGeo = new THREE.CapsuleGeometry(CHIBI.armRadius, CHIBI.armLength - CHIBI.armRadius * 2, 4, 10);
  const skinMat = mat(config.colors.skin);
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * (CHIBI.torsoWidth / 2 * bodyWidth + 0.03), CHIBI.torsoHeight - 0.06, 0);
    const m = new THREE.Mesh(armGeo, skinMat);
    m.position.y = -CHIBI.armLength / 2;
    m.castShadow = true;
    g.add(m);
    const hand = new THREE.Group();
    hand.position.y = -CHIBI.armLength;
    g.add(hand);
    torso.add(g);
    return { arm: g, hand };
  };
  const aL = mkArm(-1), aR = mkArm(1);

  // Cabeza
  const head = new THREE.Group();
  head.position.y = CHIBI.torsoHeight + CHIBI.headRadius * 0.9 * headScale;
  head.scale.setScalar(headScale);
  torso.add(head);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(CHIBI.headRadius, 28, 22), skinMat);
  headMesh.castShadow = true;
  head.add(headMesh);
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.02, CHIBI.headRadius * 0.86);
  eyes.scale.setScalar(eyeScale);
  head.add(eyes);
  const face = new THREE.Group();
  face.position.set(0, -0.06, CHIBI.headRadius * 0.9);
  head.add(face);
  const hairSocket = new THREE.Group();
  hairSocket.position.y = CHIBI.headRadius * 0.15;
  head.add(hairSocket);
  const headwearSocket = new THREE.Group();
  headwearSocket.position.y = CHIBI.headRadius * 0.55;
  head.add(headwearSocket);
  const eyewearSocket = new THREE.Group();
  eyewearSocket.position.set(0, 0.03, CHIBI.headRadius * 0.95);
  head.add(eyewearSocket);

  const back = new THREE.Group();
  back.position.set(0, CHIBI.torsoHeight * 0.6, -CHIBI.torsoWidth / 2 * bodyWidth * 0.85);
  torso.add(back);
  const neck = new THREE.Group();
  neck.position.y = CHIBI.torsoHeight;
  torso.add(neck);

  const parts: ChibiParts = {
    hips, torso, torsoMesh, head, headMesh, eyes, face, hairSocket, headwearSocket, eyewearSocket,
    armL: aL.arm, armR: aR.arm, handL: aL.hand, handR: aR.hand, legL, legR, back, neck,
    legMeshes: [legL.children[0] as THREE.Mesh, legR.children[0] as THREE.Mesh],
    armMeshes: [aL.arm.children[0] as THREE.Mesh, aR.arm.children[0] as THREE.Mesh],
  };

  const ctx: PartContext = { parts, colors: config.colors, mat, dims: CHIBI, bodyWidth };
  for (const id of Object.values(config.items) as CosmeticId[]) {
    const item = COSMETICS[id];
    if (!item || item.model === '') continue;
    PROCEDURAL_COSMETICS[id]?.(ctx);
  }

  root.scale.set(heightScale, heightScale, heightScale);
  const height = (CHIBI.legLength + CHIBI.torsoHeight + CHIBI.headRadius * 2 * headScale) * heightScale;

  return {
    root, height, materials, ...parts,
    dispose: () => {
      root.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
      for (const m of materials) m.dispose();
    },
  };
}
