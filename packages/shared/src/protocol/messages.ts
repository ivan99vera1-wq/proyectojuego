/**
 * Protocolo de mensajes cliente ⇄ servidor.
 * El estado del mundo (posiciones, salud, marcador) viaja por el Schema de
 * Colyseus; estos mensajes son eventos puntuales.
 */
export const ClientMessage = {
  /** Input de movimiento y mira, enviado a NETWORK.inputRate Hz. */
  Input: 'c:input',
  /** El jugador solicita cambiar de equipo. */
  JoinTeam: 'c:join_team',
  /** Compra en la tienda durante freezeTime. */
  Buy: 'c:buy',
  /** Disparo (el servidor valida con lag compensation). */
  Fire: 'c:fire',
  /** Cambiar de arma. */
  SwitchWeapon: 'c:switch',
  Reload: 'c:reload',
  /** Iniciar/cancelar plantar o desactivar. */
  Interact: 'c:interact',
  Chat: 'c:chat',
  Emote: 'c:emote',
  /** Aplicar avatar desde el menú de personalización (solo entre rondas / lobby). */
  SetAvatar: 'c:set_avatar',
  Ready: 'c:ready',
  /** Respuesta al ping del servidor (medición de RTT). */
  Pong: 'c:pong',
} as const;

export const ServerMessage = {
  /** Aceptación de la conexión con datos iniciales. */
  Welcome: 's:welcome',
  /** Confirmación del último input procesado (para reconciliación). */
  InputAck: 's:input_ack',
  /** Efecto de disparo para que otros clientes lo dibujen. */
  ShotFired: 's:shot',
  /** Alguien recibió daño. */
  Hit: 's:hit',
  Kill: 's:kill',
  RoundStart: 's:round_start',
  RoundEnd: 's:round_end',
  BombPlanted: 's:bomb_planted',
  BombDefused: 's:bomb_defused',
  BombExploded: 's:bomb_exploded',
  MatchEnd: 's:match_end',
  Chat: 's:chat',
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
  seq: number;
  /** Timestamp del cliente (ms) para lag compensation. */
  clientTime: number;
  yaw: number;
  pitch: number;
}

export interface BuyPayload {
  itemId: string;
}

export interface ChatPayload {
  text: string;
  team: boolean;
}

export interface WelcomePayload {
  sessionId: string;
  serverTime: number;
  protocolVersion: number;
  gameVersion: string;
  tickRate: number;
}

export interface KillPayload {
  killerId: string;
  victimId: string;
  weaponId: string;
  headshot: boolean;
}
