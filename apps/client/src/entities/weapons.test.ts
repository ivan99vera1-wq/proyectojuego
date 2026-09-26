// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WEAPONS, type WeaponId } from '@game/config';

/**
 * El GLB de armas y el catálogo tienen que hablar el mismo idioma: el cliente
 * pide cada arma por su id y da por supuesto que el nodo viene sin
 * transformación. Nada de eso lo ve un typecheck, y equivocarse produce armas
 * invisibles o 24 veces más grandes.
 *
 * Se regenera con:  blender -b -P assets/blender/build_weapons.py
 */

const GLB = new URL('../../public/assets/models/weapons/weapons.glb', import.meta.url);

interface Gltf {
  nodes: { name?: string; mesh?: number; scale?: number[]; translation?: number[]; rotation?: number[] }[];
  meshes: { name?: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  accessors: { count: number }[];
}

function leerGlb(): { gltf: Gltf; bytes: number } {
  const buf = readFileSync(GLB);
  const jsonLength = buf.readUInt32LE(12);
  return { gltf: JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')), bytes: buf.length };
}

/** El cargador de las armas que lo llevan aparte. */
const conCargador = (Object.keys(WEAPONS) as WeaponId[])
  .filter((id) => WEAPONS[id].reloadStyle === 'magazine');

describe('GLB de armas', () => {
  const { gltf, bytes } = leerGlb();
  const nombres = new Set(gltf.nodes.map((n) => (n.name ?? '').replace(/\.\d+$/, '')));

  it('trae una malla por cada arma del catálogo', () => {
    const faltan = Object.keys(WEAPONS).filter((id) => !nombres.has(id));
    expect(faltan, `faltan en el GLB: ${faltan.join(', ')}`).toEqual([]);
  });

  it('las armas de cargador extraíble traen su cargador aparte', () => {
    const faltan = conCargador.filter((id) => !nombres.has(`${id}__mag`));
    expect(faltan, `sin cargador: ${faltan.join(', ')}`).toEqual([]);
  });

  it('las armas de peine NO traen cargador suelto', () => {
    // Si apareciera uno, el gesto de recarga movería una pieza que no existe
    // en esa arma y se vería salir un cargador de un fusil de peine.
    const sobran = (Object.keys(WEAPONS) as WeaponId[])
      .filter((id) => WEAPONS[id].reloadStyle !== 'magazine' && nombres.has(`${id}__mag`));
    expect(sobran, `cargador de más: ${sobran.join(', ')}`).toEqual([]);
  });

  /**
   * `cloneWeapon` hace `clone.scale.set(1,1,1)`, así que cualquier escala que
   * sobreviva en el nodo se pierde y el arma sale con el tamaño crudo de la
   * malla. Es el fallo más caro de este pipeline.
   */
  it('cada arma viene sin transformación propia', () => {
    const malas: string[] = [];
    for (const nodo of gltf.nodes) {
      const nombre = (nodo.name ?? '').replace(/\.\d+$/, '');
      if (!(nombre in WEAPONS)) continue;
      const escala = nodo.scale ?? [1, 1, 1];
      const pos = nodo.translation ?? [0, 0, 0];
      if (escala.some((s) => Math.abs(s - 1) > 1e-4)) malas.push(`${nombre} escala ${escala}`);
      if (pos.some((v) => Math.abs(v) > 1e-4)) malas.push(`${nombre} posición ${pos}`);
    }
    expect(malas, malas.join(' · ')).toEqual([]);
  });

  /**
   * GLTFLoader deduplica nombres al cargar: si la malla y el nodo se llaman
   * igual, el nodo acaba como `<id>_1` y `cloneWeapon` deja de encontrarlo.
   * El juego no falla, simplemente dibuja el arma procedural de respaldo, así
   * que sin este test el fallo es invisible salvo mirando la pantalla.
   *
   * Y no se puede parchear en el cliente quitando el sufijo: `ppsh_41` acaba
   * en dígitos y se convertiría en `ppsh`.
   */
  it('ninguna malla se llama igual que un arma', () => {
    const ids = new Set(Object.keys(WEAPONS));
    const chocan = gltf.meshes
      .map((m) => m.name ?? '')
      .filter((n) => ids.has(n) || ids.has(n.replace(/__mag$/, '')));
    expect(chocan, `estas mallas chocan con el nombre del nodo: ${chocan.join(', ')}`).toEqual([]);
  });

  it('cabe en el presupuesto de rendimiento', () => {
    const tris = gltf.meshes.reduce((a, m) => a + m.primitives.reduce(
      (s, p) => s + (p.indices !== undefined ? gltf.accessors[p.indices]!.count / 3 : 0), 0), 0);
    // Nueve armas; en pantalla nunca hay más de un puñado a la vez.
    expect(Math.round(tris)).toBeLessThanOrEqual(30000);
    expect(bytes / 1024 / 1024, 'el GLB pesa demasiado').toBeLessThan(2.0);
  });
});
