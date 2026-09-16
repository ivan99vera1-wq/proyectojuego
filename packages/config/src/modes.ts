/** Modos de juego. Los parámetros de ronda finos están en gameplay.ts. */
export interface GameModeDefinition {
  id: string;
  displayName: string;
  description: string;
  teams: boolean;
  /** ¿Se usa la bomba? */
  bomb: boolean;
  /** ¿Reaparece el jugador al morir? */
  respawn: boolean;
  respawnDelay: number;
  /** ¿Hay economía / tienda? */
  economy: boolean;
  /** Condición de victoria. */
  scoreLimit: number;
  timeLimit: number;
}

export const GAME_MODES = {
  bomb: {
    id: 'bomb', displayName: 'Desactivación', description: 'Planta o desactiva la bomba. Sin reapariciones. El clásico.',
    teams: true, bomb: true, respawn: false, respawnDelay: 0, economy: true, scoreLimit: 13, timeLimit: 0,
  },
  tdm: {
    id: 'tdm', displayName: 'Duelo por Equipos', description: 'Reapariciones ilimitadas. Primer equipo en llegar al límite gana.',
    teams: true, bomb: false, respawn: true, respawnDelay: 4, economy: false, scoreLimit: 50, timeLimit: 600,
  },
  ffa: {
    id: 'ffa', displayName: 'Todos contra Todos', description: 'Sin equipos. Caos chibi.',
    teams: false, bomb: false, respawn: true, respawnDelay: 3, economy: false, scoreLimit: 30, timeLimit: 480,
  },
} as const satisfies Record<string, GameModeDefinition>;

export type GameModeId = keyof typeof GAME_MODES;
export const DEFAULT_MODE: GameModeId = 'bomb';
