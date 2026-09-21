import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMEPLAY, CHARACTERS, DEFAULT_CHARACTER } from '@game/config';
import { HEAD_RADIUS } from '@game/shared';
import { BASE, baseProportions, boneKey } from './rig.js';

const GLB = new URL('../../public/assets/models/characters/character.glb', import.meta.url);

interface Gltf {
  nodes: { name?: string; mesh?: number; skin?: number; rotation?: number[]; children?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  accessors: { count: number }[];
  skins?: { joints: number[] }[];
}

function readGlb(): { gltf: Gltf; bytes: number } {
  const buf = readFileSync(GLB);
  const jsonLength = buf.readUInt32LE(12);
  return { gltf: JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')), bytes: buf.length };
}

/** Los huesos que el cliente necesita para animar. Espejo de BONE_TO_RIG. */
const REQUIRED = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulder.L', 'shoulder.R', 'upperarm.L', 'upperarm.R',
  'forearm.L', 'forearm.R', 'hand.L', 'hand.R',
  'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'foot.L', 'foot.R',
];

describe('modelo del personaje', () => {
  const { gltf, bytes } = readGlb();

  it('viene con esqueleto y con pesos', () => {
    // Sin esto el personaje sale rígido y no hay animación posible. El
    // exportador puede dejarlo fuera sin dar ningún error, así que se vigila.
    expect(gltf.skins?.length, 'el GLB no trae skin').toBeGreaterThan(0);
    const skinned = gltf.nodes.filter((n) => n.skin !== undefined);
    expect(skinned.length, 'ninguna malla usa el skin').toBeGreaterThan(0);
    const withWeights = gltf.meshes.filter((m) =>
      m.primitives.some((p) => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined));
    expect(withWeights.length, 'ninguna malla trae pesos').toBe(gltf.meshes.length);
  });

  it('trae todos los huesos que el cliente necesita', () => {
    const present = new Set((gltf.skins?.[0]?.joints ?? [])
      .map((i) => boneKey(gltf.nodes[i]?.name ?? '')));
    const missing = REQUIRED.filter((name) => !present.has(boneKey(name)));
    expect(missing, `faltan huesos: ${missing.join(', ')}`).toEqual([]);
  });

  it('cabe en el presupuesto de rendimiento', () => {
    const tris = gltf.meshes.reduce((a, m) => a + m.primitives.reduce(
      (s, p) => s + (p.indices !== undefined ? gltf.accessors[p.indices]!.count / 3 : 0), 0), 0);
    // Con diez jugadores en pantalla, el triple de esto sigue siendo poco.
    expect(Math.round(tris)).toBeLessThanOrEqual(16000);
    expect(bytes / 1024 / 1024, 'el GLB pesa demasiado').toBeLessThan(2.5);
  });

  it('el catálogo apunta a este archivo', () => {
    expect(CHARACTERS[DEFAULT_CHARACTER].baseModel).toBe('character.glb');
  });
});

describe('proporciones del personaje', () => {
  it('el reparto vertical suma la altura de la cápsula', () => {
    const total = BASE.headH + BASE.neckH + BASE.torsoH + BASE.legLen;
    expect(total).toBeCloseTo(GAMEPLAY.player.capsuleHeight, 3);
  });

  it('la cabeza cabe en la esfera de headshot', () => {
    const p = baseProportions();
    const centerY = GAMEPLAY.player.capsuleHeight - HEAD_RADIUS * 0.9;
    expect(p.y.chin).toBeGreaterThan(centerY - HEAD_RADIUS);
    expect(p.y.crown).toBeLessThanOrEqual(centerY + HEAD_RADIUS + 1e-6);
    expect(p.headHalfW).toBeLessThan(HEAD_RADIUS);
  });

  it('la silueta cabe dentro del radio de la cápsula', () => {
    const p = baseProportions();
    const ancho = Math.max(p.headHalfW, p.shoulderX + p.armRadius * 2, p.hipX + p.thighRadius * 2);
    expect(ancho).toBeLessThan(GAMEPLAY.player.capsuleRadius);
  });
});
