/** Vista tipada (solo lectura) del Schema del servidor, tal como llega a colyseus.js. */
export interface PlayerStateView {
  id: string; nickname: string; team: string; avatar: string;
  x: number; y: number; z: number; yaw: number; pitch: number;
  health: number; armor: number; helmet: boolean; kit: boolean;
  alive: boolean; crouching: boolean; vx: number; vy: number; vz: number; grounded: boolean;
  weaponId: string; primaryId: string; secondaryId: string; meleeId: string; grenadeIds: string;
  ammoMag: number; ammoReserve: number; reloading: boolean; hasBomb: boolean;
  money: number; kills: number; deaths: number; assists: number; ping: number; lastSeq: number; interactProgress: number;
}
export interface ProjectileStateView { id: string; weaponId: string; ownerId: string; x: number; y: number; z: number; }
export interface MatchStateView {
  mapId: string; modeId: string; code: string; phase: string; round: number; scoreA: number; scoreB: number; timer: number;
  bombState: string; bombX: number; bombY: number; bombZ: number; bombTimer: number; lastWinner: string;
  players: Map<string, PlayerStateView>;
  projectiles: Map<string, ProjectileStateView>;
}
