import { ECONOMY, EQUIPMENT, WEAPONS, type EquipmentId, type WeaponId } from '@game/config';
import { ServerMessage, clampMoney, pointInZone, roundReward, type BuyPayload } from '@game/shared';
import type { Client } from 'colyseus';
import type { MatchRoom } from '../rooms/MatchRoom.js';

const MAX_GRENADES = 2;

export class EconomySystem {
  consecutiveLosses = { A: 0, B: 0 };
  constructor(private readonly room: MatchRoom) {}

  reset(): void {
    this.consecutiveLosses = { A: 0, B: 0 };
    const start = this.room.mode.startingMoney ?? ECONOMY.startingMoney;
    for (const p of this.room.state.players.values()) p.money = start;
  }

  /** Reparto de dinero al terminar una ronda. */
  onRoundEnd(winner: 'A' | 'B' | 'draw'): void {
    if (!this.room.mode.economy) return;
    for (const team of ['A', 'B'] as const) {
      const won = winner === team;
      if (won) this.consecutiveLosses[team] = 0;
      const reward = roundReward(won, this.consecutiveLosses[team]) + (won && this.room.state.bombState === 'exploded' ? ECONOMY.bombExplodeWinBonus : 0);
      if (!won) this.consecutiveLosses[team]++;
      for (const p of this.room.state.players.values()) {
        if (p.team === team) p.money = clampMoney(p.money + reward);
      }
    }
  }

  onBuy(client: Client, msg: BuyPayload): void {
    const id = client.sessionId;
    const p = this.room.state.players.get(id);
    const rt = this.room.runtime.get(id);
    if (!p || !rt || !p.alive) return;
    if (!this.room.mode.economy) return this.fail(client, 'no_economy');
    if (this.room.state.phase !== 'freeze') return this.fail(client, 'buy_closed');
    const zone = p.team === 'A' ? this.room.physics.layout.buyzones.A : this.room.physics.layout.buyzones.B;
    if (!pointInZone(p, zone)) return this.fail(client, 'not_in_buyzone');

    const itemId = String(msg?.itemId ?? '');
    if (itemId in WEAPONS) {
      const wid = itemId as WeaponId;
      const w = WEAPONS[wid];
      if (w.price > p.money) return this.fail(client, 'no_money');
      if (w.slot === 'grenade') {
        if (rt.inventory.grenades.length >= MAX_GRENADES) return this.fail(client, 'slot_full');
        rt.inventory.grenades.push(wid);
      } else if (w.slot === 'primary') {
        rt.inventory.primary = wid;
        rt.fillAmmo(wid);
        p.weaponId = wid;
      } else if (w.slot === 'secondary') {
        rt.inventory.secondary = wid;
        rt.fillAmmo(wid);
        if (!rt.inventory.primary) p.weaponId = wid;
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
      if (itemId === 'armor') { if (p.armor >= 100) return this.fail(client, 'already_owned'); p.armor = 100; }
      else if (itemId === 'helmet') { if (p.helmet) return this.fail(client, 'already_owned'); p.helmet = true; }
      else if (itemId === 'defuse_kit') { if (p.team !== 'A') return this.fail(client, 'wrong_team'); if (p.kit) return this.fail(client, 'already_owned'); p.kit = true; }
      p.money -= e.price;
      return;
    }
    this.fail(client, 'unknown_item');
  }

  private fail(client: Client, code: string): void {
    client.send(ServerMessage.Error, { code });
  }
}
