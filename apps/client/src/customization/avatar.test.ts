import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { COSMETICS, DEFAULT_AVATAR, GAMEPLAY, NON_BODY_SLOTS, REQUIRED_SLOTS, type CosmeticId, type CosmeticSlot } from '@game/config';
import { sanitizeAvatar, type AvatarConfig } from '@game/shared';
import { buildChibi } from './AvatarBuilder.js';
import { PROCEDURAL_COSMETICS } from './procedural.js';
import { HEAD_RADIUS } from '@game/shared';

const avatar = (over: Partial<AvatarConfig['items']> = {}): AvatarConfig => {
  const a = sanitizeAvatar(undefined);
  Object.assign(a.items, over);
  return a;
};

/** Caja envolvente en coordenadas de mundo de un conjunto de mallas. */
function boundsOf(meshes: THREE.Mesh[], root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      box.expandByPoint(v);
    }
  }
  return box;
}

describe('personaje base', () => {
  it('todos los cosméticos del catálogo tienen constructor', () => {
    for (const item of Object.values(COSMETICS)) {
      if (item.model === '' || NON_BODY_SLOTS.includes(item.slot)) continue;
      expect(PROCEDURAL_COSMETICS[item.id as CosmeticId], item.id).toBeTypeOf('function');
    }
  });

  it('el avatar por defecto se monta sin huecos en los slots obligatorios', () => {
    const model = buildChibi(avatar());
    for (const slot of REQUIRED_SLOTS) {
      expect(COSMETICS[DEFAULT_AVATAR.items[slot]].slot, slot).toBe(slot);
    }
    expect(model.body.all.length).toBeGreaterThan(10);
    model.dispose();
  });

  it('el cuerpo cabe dentro de la cápsula de juego: la silueta nunca se sale de la hitbox', () => {
    const P = GAMEPLAY.player;
    for (const height of [0.4, 0.55, 0.7]) {
      for (const width of [0.3, 0.55, 0.8]) {
        const a = avatar();
        a.sliders.height = height;
        a.sliders.bodyWidth = width;
        a.sliders.headSize = height;
        const model = buildChibi(a);
        const box = boundsOf(model.body.all, model.root);
        const label = `h=${height} w=${width}`;
        expect(box.min.y, label).toBeGreaterThan(-0.02);
        expect(box.max.y, label).toBeLessThanOrEqual(P.capsuleHeight + 0.01);
        const radius = Math.max(
          Math.abs(box.min.x), Math.abs(box.max.x),
          Math.abs(box.min.z), Math.abs(box.max.z),
        );
        expect(radius, label).toBeLessThan(P.capsuleRadius);
        model.dispose();
      }
    }
  });

  it('la cabeza visible cabe en la esfera de headshot', () => {
    const model = buildChibi(avatar());
    const P = GAMEPLAY.player;
    const centerY = P.capsuleHeight - HEAD_RADIUS * 0.9;
    const box = boundsOf(model.body.region.head, model.root);
    // La cabeza es un volumen redondeado, así que comparar la diagonal de su
    // caja contra la esfera daría siempre un falso negativo. Lo que importa es
    // que la esfera cubra la cabeza en cada eje.
    expect(box.min.y).toBeGreaterThan(centerY - HEAD_RADIUS);
    expect(box.max.y).toBeLessThan(centerY + HEAD_RADIUS);
    expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThan(HEAD_RADIUS);
    expect(Math.max(Math.abs(box.min.z), Math.abs(box.max.z))).toBeLessThan(HEAD_RADIUS);
    model.dispose();
  });

  it('cambiar de pelo cambia la silueta, no solo el color', () => {
    const sizes = new Map<string, string>();
    for (const hair of ['hair_spiky', 'hair_bob', 'hair_ponytail', 'hair_afro', 'hair_buzz'] as CosmeticId[]) {
      const model = buildChibi(avatar({ hair }));
      const meshes: THREE.Mesh[] = [];
      model.rig.hairSocket.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      const box = boundsOf(meshes, model.root);
      const size = box.getSize(new THREE.Vector3());
      sizes.set(hair, `${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`);
      model.dispose();
    }
    // Ninguna silueta de pelo puede coincidir con otra.
    expect(new Set(sizes.values()).size).toBe(sizes.size);
  });

  it('cambiar de prenda cambia la silueta del torso', () => {
    // Solo las mallas colgadas del propio torso: si se recorriera todo el
    // subárbol entrarían la cabeza y los brazos, que son más anchos que
    // cualquier prenda y taparían el efecto que se quiere medir.
    const torsoOnly = (model: ReturnType<typeof buildChibi>): THREE.Mesh[] => {
      const stop = new Set<THREE.Object3D>([
        model.rig.neck, model.rig.shoulderL, model.rig.shoulderR,
        model.rig.hipL, model.rig.hipR,
      ]);
      const out: THREE.Mesh[] = [];
      const walk = (node: THREE.Object3D): void => {
        for (const child of node.children) {
          if (stop.has(child)) continue;
          if ((child as THREE.Mesh).isMesh) out.push(child as THREE.Mesh);
          walk(child);
        }
      };
      walk(model.rig.torso);
      return out;
    };
    const shapes: string[] = [];
    for (const outer of ['outer_none', 'outer_hoodie', 'outer_vest_tactical', 'outer_jacket'] as CosmeticId[]) {
      const model = buildChibi(avatar({ outer }));
      const size = boundsOf(torsoOnly(model), model.root).getSize(new THREE.Vector3());
      shapes.push(`${size.x.toFixed(3)}x${size.y.toFixed(3)}x${size.z.toFixed(3)}`);
      model.dispose();
    }
    // Cuatro prendas distintas tienen que dar al menos tres siluetas distintas.
    expect(new Set(shapes).size, shapes.join(' | ')).toBeGreaterThanOrEqual(3);
  });

  it('la ropa oculta la piel que cubre: no quedan mallas dentro de la prenda', () => {
    const dressed = buildChibi(avatar({ outer: 'outer_hoodie', bottom: 'bottom_cargo', shoes: 'shoes_boots', hands: 'hands_gloves' }));
    expect(dressed.body.region.torso.every((m) => !m.visible)).toBe(true);
    expect(dressed.body.region.legUpper.every((m) => !m.visible)).toBe(true);
    expect(dressed.body.region.foot.every((m) => !m.visible)).toBe(true);
    expect(dressed.body.region.hand.every((m) => !m.visible)).toBe(true);
    // La cabeza y el cuello nunca se ocultan.
    expect(dressed.body.region.head.every((m) => m.visible)).toBe(true);
    dressed.dispose();
  });

  it('cada slot ofrece al menos dos opciones jugables', () => {
    const counts = new Map<CosmeticSlot, number>();
    for (const item of Object.values(COSMETICS)) {
      counts.set(item.slot, (counts.get(item.slot) ?? 0) + 1);
    }
    for (const [slot, n] of counts) expect(n, slot).toBeGreaterThanOrEqual(2);
  });
});
