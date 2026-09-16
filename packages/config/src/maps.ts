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
  /** Color del cielo / niebla (color plano de respaldo). */
  skyColor: string;
  fogDistance: number;
  /** Degradado del cielo: cenit y horizonte. */
  skyTop?: string;
  skyHorizon?: string;
  /** Color y fuerza de la luz principal. */
  sunColor?: string;
  sunIntensity?: number;
  /** Luz de relleno que viene del cielo. */
  ambientColor?: string;
}

export const MAPS = {
  playground: {
    id: 'playground', displayName: 'Patio de Juegos',
    description: 'Mapa de pruebas: un patio con toboganes, cajas y dos zonas de bomba.',
    file: 'playground.glb', preview: 'playground.jpg',
    modes: ['bomb', 'tdm', 'ffa'], recommendedPlayers: 10, skyColor: '#bfe4ff', fogDistance: 150,
    skyTop: '#6fb4ea', skyHorizon: '#e8f5ff', sunColor: '#fff3d6', sunIntensity: 2.6, ambientColor: '#9ec9ff',
  },
  candy_factory: {
    id: 'candy_factory', displayName: 'Fábrica de Dulces',
    description: 'Cintas transportadoras, tanques de chocolate y mucho color.',
    file: 'candy_factory.glb', preview: 'candy_factory.jpg',
    modes: ['bomb', 'tdm'], recommendedPlayers: 10, skyColor: '#ffd9ec', fogDistance: 120,
    skyTop: '#e58cc0', skyHorizon: '#fff0f7', sunColor: '#fff0e6', sunIntensity: 2.4, ambientColor: '#ffc2dd',
  },
} as const satisfies Record<string, MapDefinition>;

export type MapId = keyof typeof MAPS;
export const DEFAULT_MAP: MapId = 'playground';
