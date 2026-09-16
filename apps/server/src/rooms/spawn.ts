import type { MapLayout, SpawnPoint } from '@game/shared';

/** Elige un punto de aparición: el más alejado de los puntos ocupados. */
export function pickSpawn(layout: MapLayout, team: 'A' | 'B' | 'FFA', occupied: { x: number; z: number }[]): SpawnPoint {
  const list = layout.spawns[team];
  let best = list[0]!;
  let bestScore = -1;
  for (const s of list) {
    let minD = Infinity;
    for (const o of occupied) minD = Math.min(minD, Math.hypot(s.x - o.x, s.z - o.z));
    const score = (minD === Infinity ? 1000 : minD) + Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}
