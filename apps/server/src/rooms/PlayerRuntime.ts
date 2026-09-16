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
  interacting = false;
  interactStart: { x: number; z: number } | null = null;
  history: PositionSample[] = [];
  rtt = 0;
  lastPingSentAt = 0;
  respawnAt = 0;
  /** Última posición al empezar a interactuar, para cancelar si se mueve. */
  lastDamageFrom: string | null = null;

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
}
