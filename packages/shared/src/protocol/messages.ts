/**
 * Protocolo de mensajes cliente ⇄ servidor.
 * El estado del mundo (posiciones, salud, marcador) viaja por el Schema de
 * Colyseus; estos mensajes son eventos puntuales.
 */
export const ClientMessage = {
  /** Input de movimiento y mira, enviado a NETWORK.inputRate Hz. */
  Input: 'c:input',
  /** El jugador solicita cambiar de equipo ('A' | 'B' | 'spectator'). */
  JoinTeam: 'c:join_team',
  /** Compra en la tienda durante freezeTime. */
  Buy: 'c:buy',
  /** Disparo (el servidor valida con lag compensation). */
  Fire: 'c:fire',
  /** Cambiar de arma por slot. */
  SwitchWeapon: 'c:switch',
  Reload: 'c:reload',
  /** Mantener/soltar la acción de plantar o desactivar. */
  Interact: 'c:interact',
  Chat: 'c:chat',
  Emote: 'c:emote',
  /** Aplicar avatar desde el menú de personalización. */
  SetAvatar: 'c:set_avatar',
  Ready: 'c:ready',
  /** Respuesta al ping del servidor (medición de RTT). */
  Pong: 'c:pong',
  /** Solo con GAME_DEBUG=1 en el servidor: teletransporte para pruebas. */
  DebugTeleport: 'c:debug_teleport',
} as const;

export const ServerMessage = {
  /** Aceptación de la conexión con datos iniciales. */
  Welcome: 's:welcome',
  /** Efecto de disparo para que los clientes lo dibujen. */
  ShotFired: 's:shot',
  /** Alguien recibió daño. */
  Hit: 's:hit',
  Kill: 's:kill',
  RoundStart: 's:round_start',
  RoundEnd: 's:round_end',
  BombPlanted: 's:bomb_planted',
  BombDefused: 's:bomb_defused',
  BombExploded: 's:bomb_exploded',
  Explosion: 's:explosion',
  Smoke: 's:smoke',
  MatchEnd: 's:match_end',
  Chat: 's:chat',
  Emote: 's:emote',
  Error: 's:error',
  /** Medición de latencia. */
  Ping: 's:ping',
} as const;

export interface InputPayload {
  /** Número de secuencia creciente del cliente. */
  seq: number;
  /** Delta time del cliente en segundos. */
  dt: number;
  forward: number; // -1..1
  right: number;   // -1..1
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  /** Orientación de la cámara en radianes. */
  yaw: number;
  pitch: number;
}

export interface FirePayload {
  yaw: number;
  pitch: number;
}

export interface BuyPayload { itemId: string; }
export interface SwitchWeaponPayload { slot: 'primary' | 'secondary' | 'melee' | 'grenade'; }
export interface InteractPayload { active: boolean; }
export interface ChatPayload { text: string; team: boolean; }
export interface JoinTeamPayload { team: 'A' | 'B' | 'spectator'; }
export interface EmotePayload { emote: number; }

export interface WelcomePayload {
  sessionId: string;
  serverTime: number;
  protocolVersion: number;
  gameVersion: string;
  tickRate: number;
}

export interface ShotFiredPayload {
  shooterId: string;
  weaponId: string;
  /** Punto de impacto (para trazador). */
  x: number; y: number; z: number;
  /** ¿Impactó en un jugador? */
  hitPlayer: boolean;
}

export interface HitPayload {
  attackerId: string;
  victimId: string;
  damage: number;
  headshot: boolean;
}

export interface KillPayload {
  killerId: string;
  victimId: string;
  weaponId: string;
  headshot: boolean;
}

export interface RoundStartPayload { round: number; }
export interface RoundEndPayload { winner: 'A' | 'B' | 'draw'; reason: 'elimination' | 'bomb_exploded' | 'bomb_defused' | 'time' | 'score'; }
export interface MatchEndPayload { winner: 'A' | 'B' | 'draw' | string; }
export interface ChatBroadcast { from: string; nickname: string; text: string; team: boolean; }
export interface ExplosionPayload { x: number; y: number; z: number; weaponId: string; }
export interface SmokePayload { x: number; y: number; z: number; duration: number; }
export interface EmoteBroadcast { playerId: string; emote: number; }
export interface ErrorPayload { code: string; }
