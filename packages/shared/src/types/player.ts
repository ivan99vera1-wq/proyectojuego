import type { TeamId } from '@game/config';

export type PlayerTeam = TeamId | 'spectator';

/** Snapshot plano de un jugador (lo que el cliente necesita para renderizar). */
export interface PlayerSnapshot {
  id: string;
  nickname: string;
  team: PlayerTeam;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  alive: boolean;
  crouching: boolean;
  weaponId: string;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  ping: number;
}
