import { GAMEPLAY, NETWORK, WEAPONS, type WeaponDefinition, type WeaponId } from '@game/config';
import {
  ServerMessage, computeDamage, directionFromAngles, hitscan,
  type FirePayload, type HitPayload, type KillPayload, type ShotFiredPayload, type SwitchWeaponPayload, type TargetBox,
} from '@game/shared';
import type { Client } from 'colyseus';
import type { MatchRoom } from '../rooms/MatchRoom.js';

/** Dispersión extra (grados) en movimiento / aire. */
const MOVING_SPREAD = 2.0;
const AIR_SPREAD = 4.0;

export class CombatSystem {
  constructor(private readonly room: MatchRoom) {}

  update(now: number): void {
    const { state } = this.room;
    for (const [id, rt] of this.room.runtime) {
      const p = state.players.get(id);
      if (!p) continue;
      if (p.reloading && now >= rt.reloadEndsAt) {
        const w = WEAPONS[p.weaponId as WeaponId];
        const a = rt.ammo.get(p.weaponId as WeaponId);
        if (w && a) {
          const need = w.magazineSize - a.mag;
          const take = Math.min(need, a.reserve);
          a.mag += take; a.reserve -= take;
        }
        p.reloading = false;
      }
      this.syncAmmo(id);
    }
  }

  syncAmmo(id: string): void {
    const p = this.room.state.players.get(id);
    const rt = this.room.runtime.get(id);
    if (!p || !rt) return;
    const a = rt.ammo.get(p.weaponId as WeaponId);
    p.ammoMag = a?.mag ?? 0;
    p.ammoReserve = a?.reserve ?? 0;
    p.primaryId = rt.inventory.primary ?? '';
    p.secondaryId = rt.inventory.secondary;
    p.meleeId = rt.inventory.melee;
    p.grenadeIds = rt.inventory.grenades.join(',');
  }

  private canAct(id: string): boolean {
    const p = this.room.state.players.get(id);
    const phase = this.room.state.phase;
    return !!p && p.alive && (phase === 'live' || phase === 'warmup');
  }

  onFire(client: Client, msg: FirePayload, now: number): void {
    const id = client.sessionId;
    if (!this.canAct(id)) return;
    const p = this.room.state.players.get(id)!;
    const rt = this.room.runtime.get(id)!;
    const weaponId = p.weaponId as WeaponId;
    const w: WeaponDefinition | undefined = WEAPONS[weaponId];
    if (!w || !rt.hasWeapon(weaponId)) return;
    if (p.reloading) return;
    if (now - rt.lastFireTime < 1000 / w.fireRate - 5) return;

    if (w.category === 'grenade') {
      rt.lastFireTime = now;
      this.room.projectiles.throwGrenade(id, weaponId, msg.yaw, msg.pitch);
      rt.removeGrenade(weaponId);
      this.equipBest(id);
      return;
    }

    const ammo = rt.ammo.get(weaponId);
    if (w.magazineSize > 0) {
      if (!ammo || ammo.mag <= 0) { this.startReload(id, now); return; }
      ammo.mag--;
    }
    rt.lastFireTime = now;
    p.yaw = msg.yaw; p.pitch = msg.pitch;

    // Compensación de lag: rebobinar a lo que veía el cliente.
    const rewind = Math.min(NETWORK.maxLagCompensation, rt.rtt / 2 + NETWORK.interpolationDelay);
    const t = now - rewind;
    const eye = { x: p.x, y: p.y + this.room.movement.eyeHeight(p.crouching), z: p.z };
    const targets: TargetBox[] = [];
    for (const [oid, o] of this.room.state.players) {
      if (oid === id || !o.alive) continue;
      if (this.room.sameTeam(p.team, o.team)) continue;
      const pos = this.room.movement.positionAt(oid, t);
      if (pos) targets.push({ id: oid, x: pos.x, y: pos.y, z: pos.z, crouching: pos.crouching });
    }

    const moving = Math.hypot(rt.kin.vx, rt.kin.vz) > 0.5;
    const baseSpread = w.spread + (moving ? MOVING_SPREAD : 0) + (!rt.kin.grounded ? AIR_SPREAD : 0) - (p.crouching ? w.spread * 0.4 : 0);
    const pellets = w.pellets ?? 1;
    let hitAny = false;
    let lastPoint = eye;
    for (let i = 0; i < pellets; i++) {
      const spreadRad = (Math.max(0, baseSpread) * Math.PI) / 180;
      const dyaw = (Math.random() - 0.5) * 2 * spreadRad;
      const dpitch = (Math.random() - 0.5) * 2 * spreadRad;
      const dir = directionFromAngles(msg.yaw + dyaw, msg.pitch + dpitch);
      const maxDist = w.category === 'knife' ? w.range : 500;
      const mapHit = this.room.physics.raycastMap(eye, dir, maxDist);
      const mapDist = mapHit?.distance ?? maxDist;
      const hit = hitscan(eye, dir, targets, Math.min(mapDist, maxDist));
      if (hit) {
        hitAny = true;
        const victim = this.room.state.players.get(hit.id)!;
        const armorApplies = hit.zone !== 'head' || victim.helmet;
        const dmg = computeDamage(weaponId, hit.zone, hit.distance, armorApplies ? victim.armor : 0);
        if (armorApplies && dmg.armorDamage > 0) victim.armor = Math.max(0, victim.armor - dmg.armorDamage);
        this.applyDamage(hit.id, id, dmg.healthDamage, dmg.headshot, weaponId);
        lastPoint = { x: eye.x + dir.x * hit.distance, y: eye.y + dir.y * hit.distance, z: eye.z + dir.z * hit.distance };
      } else {
        lastPoint = mapHit ? mapHit.point : { x: eye.x + dir.x * maxDist, y: eye.y + dir.y * maxDist, z: eye.z + dir.z * maxDist };
      }
    }
    const shot: ShotFiredPayload = { shooterId: id, weaponId, x: lastPoint.x, y: lastPoint.y, z: lastPoint.z, hitPlayer: hitAny };
    this.room.broadcast(ServerMessage.ShotFired, shot);
    this.syncAmmo(id);
  }

  applyDamage(victimId: string, attackerId: string, amount: number, headshot: boolean, weaponId: string): void {
    const v = this.room.state.players.get(victimId);
    if (!v || !v.alive || amount <= 0) return;
    v.health = Math.max(0, v.health - amount);
    const rt = this.room.runtime.get(victimId);
    if (rt && attackerId !== victimId) rt.lastDamageFrom = attackerId;
    const hit: HitPayload = { attackerId, victimId, damage: amount, headshot };
    this.room.broadcast(ServerMessage.Hit, hit);
    if (v.health <= 0) this.kill(victimId, attackerId, weaponId, headshot);
  }

  kill(victimId: string, killerId: string, weaponId: string, headshot: boolean): void {
    const v = this.room.state.players.get(victimId);
    if (!v || !v.alive) return;
    v.alive = false;
    v.health = 0;
    v.deaths++;
    v.reloading = false;
    v.interactProgress = 0;
    const rt = this.room.runtime.get(victimId);
    if (rt) { rt.interacting = false; rt.inputs.length = 0; }
    const k = this.room.state.players.get(killerId);
    const mode = this.room.mode;
    if (k && killerId !== victimId && !this.room.sameTeam(k.team, v.team)) {
      k.kills++;
      if (mode.economy) k.money = Math.min(k.money + (WEAPONS[weaponId as WeaponId]?.killReward ?? 300), 16000);
      if (!mode.teams) { /* FFA: el marcador es kills */ }
      else if (k.team === 'A') this.room.state.scoreA += mode.respawn ? 1 : 0;
      else if (k.team === 'B') this.room.state.scoreB += mode.respawn ? 1 : 0;
    } else if (k && killerId === victimId && mode.respawn && mode.teams) {
      /* suicidio: sin puntos */
    }
    if (v.hasBomb) this.room.bomb.dropBomb(victimId);
    const payload: KillPayload = { killerId, victimId, weaponId, headshot };
    this.room.broadcast(ServerMessage.Kill, payload);
    if (mode.respawn && rt) rt.respawnAt = Date.now() + mode.respawnDelay * 1000;
    this.room.round.onPlayerDied();
  }

  startReload(id: string, now: number): void {
    const p = this.room.state.players.get(id);
    const rt = this.room.runtime.get(id);
    if (!p || !rt || !p.alive || p.reloading) return;
    const w = WEAPONS[p.weaponId as WeaponId];
    const a = rt.ammo.get(p.weaponId as WeaponId);
    if (!w || !a || w.magazineSize === 0 || a.mag >= w.magazineSize || a.reserve <= 0) return;
    p.reloading = true;
    rt.reloadEndsAt = now + w.reloadTime * 1000;
  }

  onSwitch(client: Client, msg: SwitchWeaponPayload): void {
    const p = this.room.state.players.get(client.sessionId);
    const rt = this.room.runtime.get(client.sessionId);
    if (!p || !rt || !p.alive) return;
    let target: WeaponId | null = null;
    switch (msg.slot) {
      case 'primary': target = rt.inventory.primary; break;
      case 'secondary': target = rt.inventory.secondary; break;
      case 'melee': target = rt.inventory.melee; break;
      case 'grenade': {
        const cur = rt.inventory.grenades.indexOf(p.weaponId as WeaponId);
        target = rt.inventory.grenades[(cur + 1) % Math.max(1, rt.inventory.grenades.length)] ?? null;
        break;
      }
    }
    if (!target || target === p.weaponId) return;
    p.weaponId = target;
    p.reloading = false;
    this.syncAmmo(client.sessionId);
  }

  /** Equipa la mejor arma disponible (tras lanzar la última granada, al reaparecer…). */
  equipBest(id: string): void {
    const p = this.room.state.players.get(id);
    const rt = this.room.runtime.get(id);
    if (!p || !rt) return;
    p.weaponId = rt.inventory.primary ?? rt.inventory.secondary;
    p.reloading = false;
    this.syncAmmo(id);
  }

  /** Daño en área (granadas, bomba). */
  explode(center: { x: number; y: number; z: number }, maxDamage: number, radius: number, attackerId: string, weaponId: string): void {
    for (const [id, p] of this.room.state.players) {
      if (!p.alive) continue;
      const c = { x: p.x, y: p.y + GAMEPLAY.player.eyeHeight * 0.5, z: p.z };
      const d = Math.hypot(c.x - center.x, c.y - center.y, c.z - center.z);
      if (d > radius) continue;
      // Línea de visión: si el mapa bloquea, mitad de daño.
      const dir = { x: (c.x - center.x) / (d || 1), y: (c.y - center.y) / (d || 1), z: (c.z - center.z) / (d || 1) };
      const blocked = d > 0.1 && this.room.physics.raycastMap(center, dir, d) !== null;
      const attacker = this.room.state.players.get(attackerId);
      const friendly = attacker && id !== attackerId && this.room.sameTeam(attacker.team, p.team);
      let dmg = Math.round(maxDamage * (1 - d / radius)) * (blocked ? 0.5 : 1);
      if (friendly) dmg *= 0.3;
      if (dmg > 0) this.applyDamage(id, attackerId, Math.round(dmg), false, weaponId);
    }
  }
}
