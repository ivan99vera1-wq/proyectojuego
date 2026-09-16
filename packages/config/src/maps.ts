/**
 * Mapas jugables. Cada mapa es un GLB con nodos nombrados por convención
 * (ver docs/ASSET_PIPELINE.md): SPAWN_A_*, SPAWN_B_*, BOMBSITE_A, BOMBSITE_B,
 * BUYZONE_A, BUYZONE_B, COLLISION_* ...
 */
export interface MapDefinition {
  id: string;
  displayName: string;
  description: string;
  /** Archivo en /assets/maps/. */
  file: string;
  /** Imagen de previsualización en /assets/maps/previews/. */
  preview: string;
  /** Modos compatibles. */
  modes: readonly string[];
  /** Tamaño recomendado (jugadores totales). */
  recommendedPlayers: number;
  /** Color del cielo / niebla. */
  skyColor: string;
  fogDistance: number;
}

export const MAPS = {
  playground: {
    id: 'playground', displayName: 'Patio de Juegos',
    description: 'Mapa de pruebas: un patio con toboganes, cajas y dos zonas de bomba.',
    file: 'playground.glb', preview: 'playground.jpg',
    modes: ['bomb', 'tdm', 'ffa'], recommendedPlayers: 10, skyColor: '#a7dcff', fogDistance: 120,
  },
  candy_factory: {
    id: 'candy_factory', displayName: 'Fábrica de Dulces',
    description: 'Cintas transportadoras, tanques de chocolate y mucho color.',
    file: 'candy_factory.glb', preview: 'candy_factory.jpg',
    modes: ['bomb', 'tdm'], recommendedPlayers: 10, skyColor: '#ffd9ec', fogDistance: 100,
  },
} as const satisfies Record<string, MapDefinition>;

export type MapId = keyof typeof MAPS;
export const DEFAULT_MAP: MapId = 'playground';
