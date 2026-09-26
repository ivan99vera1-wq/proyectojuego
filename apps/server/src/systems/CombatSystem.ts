import { GAMEPLAY, NETWORK, WEAPONS, type WeaponDefinition, type WeaponId } from '@game/config';
import {
  ServerMessage, clamp, clampMoney, computeDamage, degToRad, directionFromAngles, hitscan,
  type FirePayload, type HitPayload, type KillPayload, type ShotFiredPayload, type SwitchWeaponPayload, type TargetBox,
} from '@game/shared';
import type { Client } from 'colyseus';
import type { MatchRoom } from '../rooms/MatchRoom.js';

/** Dispersión extra (grados) en movimiento / aire. */
const MOVING_SPREAD = 2.0;
const AIR_SPREAD = 4.0;
/** Agacharse afina la puntería en esta proporción de la dispersión base del arma. */
const CROUCH_SPREAD_BONUS = 0.4;
/** Alcance máximo de un hitscan que no sea cuerpo a cuerpo (m). */
const MAX_HITSCAN_RANGE = 500;
/** Un arma se considera "en movimiento" a partir de esta velocidad (m/s). */
const MOVING_SPEED = 0.5;
/** Recompensa por baja cuando el arma no está en el catálogo (caída, bomba…). */
const FALLBACK_KILL_REWARD = 300;

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
    const phase = this.room.phase;
    return !!p && p.alive && p.connected && (phase === 'live' || phase === 'warmup');
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
      p.yaw = msg.yaw; p.pitch = msg.pitch;
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

    const moving = Math.hypot(rt.kin.vx, rt.kin.vz) > MOVING_SPEED;
    const baseSpread = Math.max(0, w.spread
      + (moving ? MOVING_SPREAD : 0)
      + (rt.kin.grounded ? 0 : AIR_SPREAD)
      - (p.crouching ? w.spread * CROUCH_SPREAD_BONUS : 0));
    const spreadRad = degToRad(baseSpread);
    const maxDist = w.category === 'knife' ? w.range : MAX_HITSCAN_RANGE;
    const pellets = w.pellets ?? 1;
    let hitAny = false;
    let lastPoint = eye;
    for (let i = 0; i < pellets; i++) {
      const dyaw = (Math.random() - 0.5) * 2 * spreadRad;
      const dpitch = (Math.random() - 0.5) * 2 * spreadRad;
      const dir = directionFromAngles(msg.yaw + dyaw, msg.pitch + dpitch);
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
    if (rt && attackerId !== victimId) rt.noteDamage(attackerId);
    const hit: HitPayload = { attackerId, victimId, damage: amount, headshot };
    this.room.broadcast(ServerMessage.Hit, hit);
    if (v.health <= 0) this.kill(victimId, attackerId, weaponId, headshot);
  }

  kill(victimId: string, killerId: string, weaponId: string, headshot: boolean): void {
    const v = this.room.state.players.get(victimId);
    if (!v || !v.alive) return;
    const rt = this.down(victimId);
    v.deaths++;
    const k = this.room.state.players.get(killerId);
    const mode = this.room.mode;
    if (k && killerId !== victimId && !this.room.sameTeam(k.team, v.team)) {
      k.kills++;
      if (mode.economy) k.money = clampMoney(k.money + (WEAPONS[weaponId as WeaponId]?.killReward ?? FALLBACK_KILL_REWARD));
      // En modos con reapariciones el marcador de equipo son bajas; en el modo
      // bomba lo son las rondas ganadas, así que aquí no se toca.
      if (mode.teams && mode.respawn) {
        if (k.team === 'A') this.room.state.scoreA++;
        else if (k.team === 'B') this.room.state.scoreB++;
      }
    }
    // Asistencia para quien dejó a la víctima a punto pero no remató.
    const assistId = rt?.assistFor(killerId);
    if (assistId) {
      const a = this.room.state.players.get(assistId);
      if (a && !this.room.sameTeam(a.team, v.team)) a.assists++;
    }
    const payload: KillPayload = { killerId, victimId, weaponId, headshot };
    this.room.broadcast(ServerMessage.Kill, payload);
    if (mode.respawn && rt) rt.respawnAt = Date.now() + mode.respawnDelay * 1000;
    this.room.round.onPlayerDied();
  }

  /**
   * Saca a un jugador de la ronda sin muerte ni killfeed: cambio de equipo o
   * desconexión. La ronda se reevalúa igual, que es lo que importa.
   */
  retire(id: string): void {
    const p = this.room.state.players.get(id);
    if (!p || !p.alive) { this.room.round.onPlayerDied(); return; }
    this.down(id);
    this.room.round.onPlayerDied();
  }

  /** Estado común de "ya no juega esta ronda". Devuelve su runtime si existe. */
  private down(id: string) {
    const p = this.room.state.players.get(id);
    const rt = this.room.runtime.get(id);
    if (p) {
      p.alive = false;
      p.health = 0;
      p.reloading = false;
      p.interactProgress = 0;
      if (p.hasBomb) this.room.bomb.dropBomb(id);
    }
    if (rt) {
      rt.interacting = false;
      rt.interactStart = null;
      rt.inputs.length = 0;
      rt.diedLastRound = true;
    }
    return rt;
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
    switch (msg?.slot) {
      case 'primary': target = rt.inventory.primary; break;
      case 'secondary': target = rt.inventory.secondary; break;
      case 'melee': target = rt.inventory.melee; break;
      case 'grenade': {
        const cur = rt.inventory.grenades.indexOf(p.weaponId as WeaponId);
        target = rt.inventory.grenades[(cur + 1) % Math.max(1, rt.inventory.grenades.length)] ?? null;
        break;
      }
      default: return;
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
    const attacker = this.room.state.players.get(attackerId);
    for (const [id, p] of this.room.state.players) {
      if (!p.alive) continue;
      const c = { x: p.x, y: p.y + GAMEPLAY.player.eyeHeight * 0.5, z: p.z };
      const d = Math.hypot(c.x - center.x, c.y - center.y, c.z - center.z);
      if (d > radius) continue;
      // Línea de visión: si el mapa bloquea, mitad de daño.
      const dir = { x: (c.x - center.x) / (d || 1), y: (c.y - center.y) / (d || 1), z: (c.z - center.z) / (d || 1) };
      const blocked = d > 0.1 && this.room.physics.raycastMap(center, dir, d) !== null;
      const friendly = !!attacker && id !== attackerId && this.room.sameTeam(attacker.team, p.team);
      let dmg = Math.round(maxDamage * clamp(1 - d / radius, 0, 1)) * (blocked ? 0.5 : 1);
      if (friendly) dmg *= 0.3;
      if (dmg > 0) this.applyDamage(id, attackerId, Math.round(dmg), false, weaponId);
    }
  }
}
