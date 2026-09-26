import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GAMEPLAY } from '@game/config';
import { initPhysics, PhysicsWorld } from '../physics/PhysicsWorld.js';
import { createKinematicState, stepMovement } from '../physics/movement.js';
import { pointInZone } from './types.js';
import { MAP_LAYOUTS } from './index.js';
import type { MapLayout, SpawnPoint } from './types.js';

/**
 * Los mapas son datos, y un dato mal puesto no se ve leyendo el archivo: se ve
 * apareciendo dentro de una pila de cajas sin poder moverse. Esto es la red de
 * seguridad, y corre en CI porque es exactamente el fallo que se colaba.
 */

/** Distancia mínima que hay que poder andar en un segundo desde una aparición. */
const MIN_WALK = 3.5;
/** Holgura extra alrededor de la cápsula al comprobar que el sitio está libre. */
const SPAWN_MARGIN = 0.1;

const worlds = new Map<string, PhysicsWorld>();

/** Anda un segundo hacia delante con las MISMAS condiciones que MatchRoom.spawnPlayer. */
function walkForward(world: PhysicsWorld, s: SpawnPoint): number {
  const state = createKinematicState(s.x, s.y + 0.05, s.z);
  state.grounded = true;
  world.addPlayer('probe', state);
  world.setPlayerPosition('probe', state);
  const input = {
    seq: 0, dt: 1 / 60, forward: 1, right: 0,
    jump: false, crouch: false, sprint: false, yaw: s.yaw, pitch: 0,
  };
  for (let i = 0; i < 60; i++) stepMovement(world, 'probe', state, input);
  world.removePlayer('probe');
  return Math.hypot(state.x - s.x, state.z - s.z);
}

beforeAll(async () => {
  await initPhysics();
  for (const [id, layout] of Object.entries(MAP_LAYOUTS)) worlds.set(id, new PhysicsWorld(layout));
});
afterAll(() => {
  for (const w of worlds.values()) w.free();
  worlds.clear();
});

describe.each(Object.entries(MAP_LAYOUTS))('mapa %s', (id, layout: MapLayout) => {
  const world = () => worlds.get(id)!;

  it('el id del layout coincide con su clave', () => {
    expect(layout.id).toBe(id);
  });

  it('cada equipo tiene puntos de aparición', () => {
    for (const team of ['A', 'B', 'FFA'] as const) {
      expect(layout.spawns[team].length, `${id}/${team}`).toBeGreaterThan(0);
    }
    // Un equipo tiene que poder salir entero a la vez.
    for (const team of ['A', 'B'] as const) {
      expect(layout.spawns[team].length, `${id}/${team}`).toBeGreaterThanOrEqual(GAMEPLAY.match.maxPlayersPerTeam);
    }
  });

  it('ninguna aparición está dentro de la geometría', () => {
    const inside: string[] = [];
    for (const [team, list] of Object.entries(layout.spawns)) {
      list.forEach((s, i) => {
        if (!world().isFree({ x: s.x, y: s.y + 0.05, z: s.z }, SPAWN_MARGIN)) {
          inside.push(`${team}[${i}] (${s.x}, ${s.z})`);
        }
      });
    }
    expect(inside, `apariciones dentro de una caja: ${inside.join(', ')}`).toEqual([]);
  });

  it('desde cada aparición se puede andar hacia delante', () => {
    const stuck: string[] = [];
    for (const [team, list] of Object.entries(layout.spawns)) {
      list.forEach((s, i) => {
        const walked = walkForward(world(), s);
        if (walked < MIN_WALK) stuck.push(`${team}[${i}] (${s.x}, ${s.z}) solo ${walked.toFixed(1)} m`);
      });
    }
    expect(stuck, `apariciones bloqueadas: ${stuck.join(', ')}`).toEqual([]);
  });

  it('las apariciones de cada equipo caen en su zona de compra', () => {
    for (const team of ['A', 'B'] as const) {
      for (const s of layout.spawns[team]) {
        expect(pointInZone({ x: s.x, y: s.y + 0.05, z: s.z }, layout.buyzones[team]),
               `${id}/${team} (${s.x}, ${s.z}) fuera de su zona de compra`).toBe(true);
      }
    }
  });

  /**
   * Suelo libre de un sitio, en celdas de 1 m². Se mide con la cápsula real del
   * jugador, así que la cifra es más baja (y más honesta) que un test de cajas
   * sin rotación: un sitio con menos de esto no se puede jugar.
   */
  it('los sitios de bomba tienen suelo libre para plantar', () => {
    for (const letter of ['A', 'B'] as const) {
      const zone = layout.bombsites[letter];
      let free = 0, total = 0;
      for (let x = zone.x - zone.sx / 2 + 1; x <= zone.x + zone.sx / 2 - 1; x++) {
        for (let z = zone.z - zone.sz / 2 + 1; z <= zone.z + zone.sz / 2 - 1; z++) {
          total++;
          if (world().isFree({ x, y: 0.05, z })) free++;
        }
      }
      expect(free, `sitio ${letter} de ${id}: solo ${free} m² pisables`).toBeGreaterThanOrEqual(40);
      expect(free / total, `sitio ${letter} de ${id} demasiado obstruido`).toBeGreaterThan(0.25);
    }
  });

  it('los adornos nunca colisionan y el suelo mortal queda por debajo', () => {
    for (const p of layout.props ?? []) expect(p.y ?? 0).toBeGreaterThanOrEqual(0);
    expect(layout.killY).toBeLessThan(0);
  });
});
