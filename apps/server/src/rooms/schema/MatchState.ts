import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import { GAMEPLAY } from '@game/config';

/**
 * Estado sincronizado (Colyseus Schema). Se usa `defineTypes` en lugar de
 * decoradores para no depender de flags de compilación en tsx/vitest/esbuild.
 * Solo lo que TODOS los clientes deben ver va aquí; datos privados
 * (p. ej. inventario oculto) se guardan en memoria del servidor.
 */
export class PlayerState extends Schema {
  id = '';
  nickname = '';
  team = 'spectator';
  /** AvatarConfig serializado (encodeAvatar). */
  avatar = '';
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  pitch = 0;
  health = GAMEPLAY.player.maxHealth;
  armor = 0;
  alive = false;
  crouching = false;
  weaponId = '';
  money = 0;
  kills = 0;
  deaths = 0;
  assists = 0;
  ping = 0;
  /** Último input procesado (para reconciliación del cliente). */
  lastSeq = 0;
}
defineTypes(PlayerState, {
  id: 'string', nickname: 'string', team: 'string', avatar: 'string',
  x: 'number', y: 'number', z: 'number', yaw: 'number', pitch: 'number',
  health: 'number', armor: 'number', alive: 'boolean', crouching: 'boolean',
  weaponId: 'string', money: 'number', kills: 'number', deaths: 'number', assists: 'number',
  ping: 'number', lastSeq: 'number',
});

export class MatchState extends Schema {
  mapId = '';
  modeId = '';
  phase = 'waiting';
  round = 0;
  scoreA = 0;
  scoreB = 0;
  /** Segundos restantes de la fase actual. */
  timer = 0;
  bombState = 'none';
  bombX = 0;
  bombY = 0;
  bombZ = 0;
  players = new MapSchema<PlayerState>();
}
defineTypes(MatchState, {
  mapId: 'string', modeId: 'string', phase: 'string', round: 'number',
  scoreA: 'number', scoreB: 'number', timer: 'number', bombState: 'string',
  bombX: 'number', bombY: 'number', bombZ: 'number',
  players: { map: PlayerState },
});
