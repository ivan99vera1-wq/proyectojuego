import { EQUIPMENT, WEAPONS, type EquipmentId, type WeaponId } from '@game/config';
import {
  ServerMessage, clampMoney, pointInZone, roundReward,
  type BuyPayload, type ErrorCode, type ErrorPayload, type RoundWinner,
} from '@game/shared';
import { ECONOMY } from '@game/config';
import type { Client } from 'colyseus';
import type { MatchRoom } from '../rooms/MatchRoom.js';

const MAX_GRENADES = 2;

export class EconomySystem {
  consecutiveLosses = { A: 0, B: 0 };
  constructor(private readonly room: MatchRoom) {}

  reset(): void {
    this.consecutiveLosses = { A: 0, B: 0 };
    for (const p of this.room.state.players.values()) p.money = this.room.startingMoney;
  }

  /** Reparto de dinero al terminar una ronda. */
  onRoundEnd(winner: RoundWinner): void {
    if (!this.room.mode.economy) return;
    const explodedBonus = this.room.state.bombState === 'exploded' ? ECONOMY.bombExplodeWinBonus : 0;
    for (const team of ['A', 'B'] as const) {
      const won = winner === team;
      if (won) this.consecutiveLosses[team] = 0;
      const reward = roundReward(won, this.consecutiveLosses[team]) + (won ? explodedBonus : 0);
      if (!won) this.consecutiveLosses[team]++;
      for (const p of this.room.state.players.values()) {
        if (p.team === team) p.money = clampMoney(p.money + reward);
      }
    }
  }

  /**
   * ¿Puede este jugador comprar ahora mismo?
   * En los modos por rondas solo durante la congelación y dentro de la zona de
   * compra; el entrenamiento (`shopAlwaysOpen`) no tiene ni fase ni zona,
   * porque existe justo para probar armas.
   */
  private buyBlockedBy(playerTeam: string, pos: { x: number; y: number; z: number }): ErrorCode | null {
    if (!this.room.mode.economy) return 'no_economy';
    if (this.room.mode.shopAlwaysOpen) return null;
    if (this.room.phase !== 'freeze') return 'buy_closed';
    const zones = this.room.physics.layout.buyzones;
    const zone = playerTeam === 'A' ? zones.A : zones.B;
    if (!pointInZone(pos, zone)) return 'not_in_buyzone';
    return null;
  }

  onBuy(client: Client, msg: BuyPayload): void {
    const id = client.sessionId;
    const p = this.room.state.players.get(id);
    const rt = this.room.runtime.get(id);
    if (!p || !rt || !p.alive) return;
    const blocked = this.buyBlockedBy(p.team, p);
    if (blocked) return this.fail(client, blocked);

    const itemId = String(msg?.itemId ?? '');
    if (itemId in WEAPONS) {
      const wid = itemId as WeaponId;
      const w = WEAPONS[wid];
      if (w.price > p.money) return this.fail(client, 'no_money');
      if (w.slot === 'grenade') {
        if (rt.inventory.grenades.length >= MAX_GRENADES) return this.fail(client, 'slot_full');
        rt.inventory.grenades.push(wid);
        rt.fillAmmo(wid);
      } else if (w.slot === 'primary') {
        rt.inventory.primary = wid;
        rt.fillAmmo(wid);
        p.weaponId = wid;
        rt.drawEndsAt = Date.now() + w.drawTime * 1000;
      } else if (w.slot === 'secondary') {
        rt.inventory.secondary = wid;
        rt.fillAmmo(wid);
        if (!rt.inventory.primary) {
          p.weaponId = wid;
          rt.drawEndsAt = Date.now() + w.drawTime * 1000;
        }
      } else {
        return this.fail(client, 'not_purchasable');
      }
      p.money -= w.price;
      p.reloading = false;
      this.room.combat.syncAmmo(id);
      return;
    }
    if (itemId in EQUIPMENT) {
      const e = EQUIPMENT[itemId as EquipmentId];
      if (e.price > p.money) return this.fail(client, 'no_money');
      if (itemId === 'armor') {
        if (p.armor >= e.armor) return this.fail(client, 'already_owned');
        p.armor = e.armor;
      } else if (itemId === 'helmet') {
        if (p.helmet) return this.fail(client, 'already_owned');
        p.helmet = true;
      } else {
        // Kit de desactivación: solo lo usa quien defiende.
        if (this.room.mode.teams && p.team !== 'A') return this.fail(client, 'wrong_team');
        if (p.kit) return this.fail(client, 'already_owned');
        p.kit = true;
      }
      p.money -= e.price;
      return;
    }
    this.fail(client, 'unknown_item');
  }

  private fail(client: Client, code: ErrorCode): void {
    const payload: ErrorPayload = { code };
    client.send(ServerMessage.Error, payload);
  }
}
