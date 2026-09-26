import type { WeaponId } from '@game/config';
import { DEFAULT_LOADOUT, WEAPONS } from '@game/config';
import { createKinematicState, type InputPayload, type KinematicState } from '@game/shared';

export interface AmmoState { mag: number; reserve: number; }
export interface Inventory {
  primary: WeaponId | null;
  secondary: WeaponId;
  melee: WeaponId;
  grenades: WeaponId[];
}
export interface PositionSample { t: number; x: number; y: number; z: number; crouching: boolean; }

/** Cuántos atacantes recientes se recuerdan para repartir asistencias. */
const MAX_DAMAGERS = 4;

/** Datos privados del servidor por jugador (no se sincronizan). */
export class PlayerRuntime {
  kin: KinematicState = createKinematicState();
  inputs: InputPayload[] = [];
  /** Presupuesto de tiempo simulable (anti speed-hack). */
  timeBudget = 0.2;
  inventory: Inventory = { primary: null, secondary: DEFAULT_LOADOUT.secondary, melee: DEFAULT_LOADOUT.melee, grenades: [] };
  ammo = new Map<WeaponId, AmmoState>();
  lastFireTime = 0;
  reloadEndsAt = 0;
  /** Hasta cuándo el arma se está sacando y no se puede disparar. */
  drawEndsAt = 0;
  lastEmoteAt = 0;
  lastInspectAt = 0;
  lastChatAt = 0;
  interacting = false;
  /** Posición al empezar a interactuar, para cancelar si el jugador se mueve. */
  interactStart: { x: number; z: number } | null = null;
  history: PositionSample[] = [];
  rtt = 0;
  lastPingSentAt = 0;
  respawnAt = 0;
  /**
   * Murió (o todavía no ha jugado) desde la última aparición. Es lo que decide
   * si al empezar la ronda conserva lo comprado o vuelve al equipo inicial.
   */
  diedLastRound = true;
  /**
   * Atacantes recientes, del más antiguo al más reciente. Sirve para dar la
   * asistencia a quien dejó a la víctima a punto pero no remató.
   */
  damagers: string[] = [];

  constructor(readonly sessionId: string) {
    this.resetLoadout();
  }

  resetLoadout(): void {
    this.inventory = { primary: null, secondary: DEFAULT_LOADOUT.secondary, melee: DEFAULT_LOADOUT.melee, grenades: [] };
    this.ammo.clear();
    this.fillAmmo(this.inventory.secondary);
    this.fillAmmo(this.inventory.melee);
    this.reloadEndsAt = 0;
  }

  fillAmmo(id: WeaponId): void {
    const w = WEAPONS[id];
    this.ammo.set(id, { mag: w.magazineSize, reserve: w.reserveAmmo });
  }

  hasWeapon(id: WeaponId): boolean {
    const inv = this.inventory;
    return inv.primary === id || inv.secondary === id || inv.melee === id || inv.grenades.includes(id);
  }

  removeGrenade(id: WeaponId): void {
    const i = this.inventory.grenades.indexOf(id);
    if (i >= 0) this.inventory.grenades.splice(i, 1);
  }

  /** Anota quién hizo daño (el último de la lista es el más reciente). */
  noteDamage(attackerId: string): void {
    const i = this.damagers.indexOf(attackerId);
    if (i >= 0) this.damagers.splice(i, 1);
    this.damagers.push(attackerId);
    if (this.damagers.length > MAX_DAMAGERS) this.damagers.shift();
  }

  /** Quién merece la asistencia de esta muerte: el último que hirió y no remató. */
  assistFor(killerId: string): string | null {
    for (let i = this.damagers.length - 1; i >= 0; i--) {
      const id = this.damagers[i]!;
      if (id !== killerId && id !== this.sessionId) return id;
    }
    return null;
  }
}
