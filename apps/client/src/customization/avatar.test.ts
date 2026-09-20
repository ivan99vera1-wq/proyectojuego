import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COSMETICS, DEFAULT_AVATAR, GAMEPLAY, NON_BODY_SLOTS, REQUIRED_SLOTS, SLOT_ORDER, type CosmeticId, type CosmeticSlot } from '@game/config';
import { sanitizeAvatar } from '@game/shared';
import { BASE, baseProportions } from './rig.js';
import { HEAD_RADIUS } from '@game/shared';

const GLB = new URL('../../public/assets/models/characters/character.glb', import.meta.url);

/** Lee la cabecera JSON de un GLB sin necesitar Three ni un navegador. */
function readGlb(): { nodes: { name?: string; mesh?: number }[]; skins?: { joints: number[] }[] } {
  const buf = readFileSync(GLB);
  const jsonLength = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
}

/** Prefijos `<id>` de las mallas de cosmético que trae el modelo. */
function modelCosmeticIds(): Set<string> {
  const gltf = readGlb();
  const ids = new Set<string>();
  for (const node of gltf.nodes) {
    if (node.mesh === undefined || !node.name) continue;
    const i = node.name.indexOf('__');
    if (i > 0) ids.add(node.name.slice(0, i));
  }
  return ids;
}

describe('catálogo de personalización', () => {
  it('cada cosmético con modelo existe de verdad dentro del GLB', () => {
    // Es la comprobación que más cuesta detectar a ojo: si el id del catálogo
    // y el prefijo de la malla no coinciden, el jugador elige una prenda y no
    // aparece nada, sin ningún error.
    const inModel = modelCosmeticIds();
    const faltan: string[] = [];
    for (const item of Object.values(COSMETICS)) {
      if (item.model === '' || NON_BODY_SLOTS.includes(item.slot)) continue;
      if (!inModel.has(item.id)) faltan.push(item.id);
    }
    expect(faltan, `sin malla en character.glb: ${faltan.join(', ')}`).toEqual([]);
  });

  it('el GLB no trae piezas que el catálogo no ofrezca', () => {
    const catalogo = new Set(Object.keys(COSMETICS));
    const sobran = [...modelCosmeticIds()].filter((id) => !catalogo.has(id));
    expect(sobran, `en el modelo pero no en el catálogo: ${sobran.join(', ')}`).toEqual([]);
  });

  it('cada slot ofrece al menos dos opciones', () => {
    const counts = new Map<CosmeticSlot, number>();
    for (const item of Object.values(COSMETICS)) {
      counts.set(item.slot, (counts.get(item.slot) ?? 0) + 1);
    }
    for (const slot of SLOT_ORDER) expect(counts.get(slot) ?? 0, slot).toBeGreaterThanOrEqual(2);
  });

  it('el avatar por defecto llena todos los slots y cada item va donde dice', () => {
    for (const slot of SLOT_ORDER) {
      const id = DEFAULT_AVATAR.items[slot] as CosmeticId;
      expect(id, `falta el slot ${slot}`).toBeTruthy();
      expect(COSMETICS[id].slot, `${id} dice ser de ${COSMETICS[id].slot}`).toBe(slot);
    }
  });

  it('los slots obligatorios nunca pueden quedar vacíos', () => {
    for (const slot of REQUIRED_SLOTS) {
      const id = DEFAULT_AVATAR.items[slot] as CosmeticId;
      expect(COSMETICS[id].model, `${slot} apunta a una pieza sin modelo`).not.toBe('');
    }
  });

  it('un avatar con basura dentro se sanea a opciones válidas', () => {
    const a = sanitizeAvatar({ items: { hair: 'no_existe', top: 'tampoco' } } as never);
    for (const slot of REQUIRED_SLOTS) {
      expect(COSMETICS[a.items[slot] as CosmeticId], slot).toBeTruthy();
    }
  });
});

describe('proporciones del personaje', () => {
  it('el reparto vertical suma exactamente la altura de la cápsula', () => {
    const total = BASE.headH + BASE.neckH + BASE.torsoH + BASE.legLen;
    expect(total).toBeCloseTo(GAMEPLAY.player.capsuleHeight, 6);
  });

  it('la cabeza cabe en la esfera de headshot', () => {
    const p = baseProportions();
    const centerY = GAMEPLAY.player.capsuleHeight - HEAD_RADIUS * 0.9;
    expect(p.y.chin).toBeGreaterThan(centerY - HEAD_RADIUS);
    expect(p.y.crown).toBeLessThanOrEqual(centerY + HEAD_RADIUS + 1e-6);
    expect(p.headHalfW).toBeLessThan(HEAD_RADIUS);
    expect(p.headHalfD).toBeLessThan(HEAD_RADIUS);
  });

  it('la silueta cabe dentro del radio de la cápsula', () => {
    const p = baseProportions();
    const ancho = Math.max(p.headHalfW, p.shoulderX + p.armRadius * 2, p.hipX + p.thighRadius * 2);
    expect(ancho).toBeLessThan(GAMEPLAY.player.capsuleRadius);
  });
});
