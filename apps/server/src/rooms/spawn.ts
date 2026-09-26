import type { PhysicsWorld, SpawnPoint } from '@game/shared';

/** Último recurso si un mapa se queda sin puntos de aparición utilizables. */
const CENTER: SpawnPoint = { x: 0, y: 0, z: 0, yaw: 0 };
/** Holgura al comprobar que el punto está despejado (igual que en maps.test.ts). */
const SPAWN_MARGIN = 0.1;
/** Mapas ya avisados, para no repetir el aviso en cada aparición. */
const warned = new Set<string>();

/**
 * Elige un punto de aparición: el más alejado de los puntos ocupados, de entre
 * los que están libres de geometría.
 *
 * El filtro por geometría es un cinturón de seguridad: `maps.test.ts` ya impide
 * publicar un mapa con apariciones dentro de una caja, pero si alguna se cuela,
 * aparecer dentro de una pila de cajones deja al jugador inmóvil el resto de la
 * ronda, y eso no puede pasar en una partida.
 */
export function pickSpawn(
  world: PhysicsWorld,
  team: 'A' | 'B' | 'FFA',
  occupied: { x: number; z: number }[],
): SpawnPoint {
  const all = world.layout.spawns[team];
  const usable = all.filter((s) => world.isFree({ x: s.x, y: s.y + 0.05, z: s.z }, SPAWN_MARGIN));
  const list = usable.length ? usable : all;
  const key = `${world.layout.id}/${team}`;
  if (list.length !== all.length && !warned.has(key)) {
    warned.add(key);
    console.warn(`[mapa] ${key}: ${all.length - list.length} apariciones bloqueadas por la geometría`);
  }
  let best = list[0];
  if (!best) {
    console.warn(`[mapa] ${world.layout.id} no tiene puntos de aparición para ${team}`);
    return CENTER;
  }
  let bestScore = -1;
  for (const s of list) {
    let minD = Infinity;
    for (const o of occupied) minD = Math.min(minD, Math.hypot(s.x - o.x, s.z - o.z));
    const score = (minD === Infinity ? 1000 : minD) + Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}
