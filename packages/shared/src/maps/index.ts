import type { MapId } from '@game/config';
import type { MapLayout } from './types.js';
import { PLAYGROUND } from './playground.js';
import { CANDY_FACTORY } from './candy_factory.js';

export * from './types.js';
export * from './kit.js';

/** Layouts de colisión/jugabilidad por id de mapa (MAPS en @game/config). */
export const MAP_LAYOUTS: Record<MapId, MapLayout> = {
  playground: PLAYGROUND,
  candy_factory: CANDY_FACTORY,
};

export const getMapLayout = (id: string): MapLayout => MAP_LAYOUTS[id as MapId] ?? PLAYGROUND;
