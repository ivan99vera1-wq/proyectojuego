import { schema, MapSchema, type SchemaType } from '@colyseus/schema';
import { GAMEPLAY } from '@game/config';

/**
 * Estado sincronizado (Colyseus Schema). Se usa el helper funcional `schema()`:
 * no depende de decoradores ni de la semántica de campos de clase (ES2022
 * `useDefineForClassFields`), así que funciona igual en tsx, vitest y esbuild.
 * Solo lo que TODOS los clientes deben ver va aquí; lo privado vive en PlayerRuntime.
 */
export const PlayerState = schema({
  id: { type: 'string', default: '' },
  nickname: { type: 'string', default: '' },
  /** 'A' | 'B' | 'FFA' | 'spectator' */
  team: { type: 'string', default: 'spectator' },
  /** AvatarConfig serializado (encodeAvatar). */
  x: { type: 'number', default: 0 },
  y: { type: 'number', default: 0 },
  z: { type: 'number', default: 0 },
  yaw: { type: 'number', default: 0 },
  pitch: { type: 'number', default: 0 },
  health: { type: 'number', default: GAMEPLAY.player.maxHealth as number },
  armor: { type: 'number', default: 0 },
  helmet: { type: 'boolean', default: false },
  kit: { type: 'boolean', default: false },
  alive: { type: 'boolean', default: false },
  crouching: { type: 'boolean', default: false },
  vx: { type: 'number', default: 0 },
  vy: { type: 'number', default: 0 },
  vz: { type: 'number', default: 0 },
  grounded: { type: 'boolean', default: false },
  weaponId: { type: 'string', default: '' },
  primaryId: { type: 'string', default: '' },
  secondaryId: { type: 'string', default: '' },
  meleeId: { type: 'string', default: '' },
  /** Ids de granadas separados por coma. */
  grenadeIds: { type: 'string', default: '' },
  ammoMag: { type: 'number', default: 0 },
  ammoReserve: { type: 'number', default: 0 },
  reloading: { type: 'boolean', default: false },
  hasBomb: { type: 'boolean', default: false },
  money: { type: 'number', default: 0 },
  kills: { type: 'number', default: 0 },
  deaths: { type: 'number', default: 0 },
  assists: { type: 'number', default: 0 },
  ping: { type: 'number', default: 0 },
  /** Último input procesado (para reconciliación del cliente). */
  lastSeq: { type: 'number', default: 0 },
  /** Progreso 0..1 de plantar/desactivar. */
  interactProgress: { type: 'number', default: 0 },
}, 'PlayerState');
export type PlayerState = SchemaType<typeof PlayerState>;

export const ProjectileState = schema({
  id: { type: 'string', default: '' },
  weaponId: { type: 'string', default: '' },
  ownerId: { type: 'string', default: '' },
  x: { type: 'number', default: 0 },
  y: { type: 'number', default: 0 },
  z: { type: 'number', default: 0 },
}, 'ProjectileState');
export type ProjectileState = SchemaType<typeof ProjectileState>;

export const MatchState = schema({
  mapId: { type: 'string', default: '' },
  modeId: { type: 'string', default: '' },
  /** Código de sala privada ('' si es pública). */
  code: { type: 'string', default: '' },
  phase: { type: 'string', default: 'waiting' },
  round: { type: 'number', default: 0 },
  scoreA: { type: 'number', default: 0 },
  scoreB: { type: 'number', default: 0 },
  /** Segundos restantes de la fase actual. */
  timer: { type: 'number', default: 0 },
  bombState: { type: 'string', default: 'none' },
  bombX: { type: 'number', default: 0 },
  bombY: { type: 'number', default: 0 },
  bombZ: { type: 'number', default: 0 },
  /** Segundos hasta la explosión cuando está plantada. */
  bombTimer: { type: 'number', default: 0 },
  /** Ganador de la última ronda / partida, para el banner. */
  lastWinner: { type: 'string', default: '' },
  players: { map: PlayerState },
  projectiles: { map: ProjectileState },
}, 'MatchState');
export type MatchState = SchemaType<typeof MatchState>;

export { MapSchema };
