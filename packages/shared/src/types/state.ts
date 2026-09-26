import type { BombState, MatchPhase } from './match.js';

/**
 * =====================================================================
 *  CONTRATO DEL ESTADO SINCRONIZADO
 * =====================================================================
 *  Estos tipos son la ÚNICA descripción del estado que viaja por la red.
 *
 *  El servidor declara el Schema de Colyseus a partir de ellos y
 *  comprueba en tiempo de compilación que no se le olvida ningún campo
 *  (ver la aserción al final de apps/server/src/rooms/schema/MatchState.ts).
 *  El cliente los lee tal cual. Antes había dos listas de campos escritas
 *  a mano, una en cada lado, y se habían desincronizado sin que nada
 *  avisara.
 *
 *  Regla: si un campo no está aquí, no llega al cliente. Lo privado del
 *  servidor vive en PlayerRuntime.
 * =====================================================================
 */

/** Equipo tal como viaja en el estado: 'A' | 'B' en modos por equipos, 'FFA' o 'spectator'. */
export type PlayerTeamId = 'A' | 'B' | 'FFA' | 'spectator';

export interface PlayerSnapshot {
  id: string;
  nickname: string;
  /** Uno de PlayerTeamId; se transmite como cadena. */
  team: string;
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  health: number;
  armor: number;
  helmet: boolean;
  kit: boolean;
  alive: boolean;
  /** Ha aparecido al menos una vez en esta partida: antes no hay que dibujarlo. */
  spawned: boolean;
  /** Sigue conectado. Falso mientras corre el margen de reconexión. */
  connected: boolean;
  crouching: boolean;
  vx: number; vy: number; vz: number;
  grounded: boolean;
  weaponId: string;
  primaryId: string;
  secondaryId: string;
  meleeId: string;
  /** Ids de granadas separados por coma. */
  grenadeIds: string;
  ammoMag: number;
  ammoReserve: number;
  reloading: boolean;
  hasBomb: boolean;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  ping: number;
  /** Último input procesado (para la reconciliación del cliente). */
  lastSeq: number;
  /** Progreso 0..1 de plantar / desactivar. */
  interactProgress: number;
}

export interface ProjectileSnapshot {
  id: string;
  weaponId: string;
  ownerId: string;
  x: number; y: number; z: number;
}

/** Campos escalares de la partida (todo lo que no es una colección). */
export interface MatchScalars {
  mapId: string;
  modeId: string;
  /** Código de sala privada ('' si es pública). */
  code: string;
  /** Uno de MatchPhase. */
  phase: string;
  round: number;
  scoreA: number;
  scoreB: number;
  /** Segundos restantes de la fase actual. */
  timer: number;
  /** Uno de BombState. */
  bombState: string;
  bombX: number;
  bombY: number;
  bombZ: number;
  /** Segundos hasta la explosión cuando está plantada. */
  bombTimer: number;
  /** Ganador de la última ronda / partida, para el cartel. */
  lastWinner: string;
}

/**
 * Colección sincronizada tal como la expone colyseus.js (`MapSchema`).
 * Es el subconjunto de `Map` que el juego usa realmente.
 */
export interface StateMap<T> extends Iterable<[string, T]> {
  readonly size: number;
  get(key: string): T | undefined;
  keys(): IterableIterator<string>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[string, T]>;
}

/** Estado completo de la partida tal como lo ve el cliente. */
export interface MatchSnapshot extends MatchScalars {
  phase: MatchPhase | string;
  bombState: BombState | string;
  players: StateMap<PlayerSnapshot>;
  projectiles: StateMap<ProjectileSnapshot>;
}
