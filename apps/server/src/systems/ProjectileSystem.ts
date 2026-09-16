import { WEAPONS, type WeaponId } from '@game/config';
import { GAMEPLAY } from '@game/config';
import { ServerMessage, directionFromAngles, type ExplosionPayload, type SmokePayload } from '@game/shared';
import type { MatchRoom } from '../rooms/MatchRoom.js';
import { ProjectileState } from '../rooms/schema/MatchState.js';

interface Projectile {
  id: string;
  weaponId: WeaponId;
  ownerId: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  explodeAt: number;
}

const THROW_SPEED = 16;
const FUSE_MS = 2200;
const BOUNCE = 0.45;
const SMOKE_DURATION = 15;
let nextId = 1;

/** Granadas: simulación balística sencilla con rebotes contra el mapa. */
export class ProjectileSystem {
  private readonly list: Projectile[] = [];
  constructor(private readonly room: MatchRoom) {}

  throwGrenade(ownerId: string, weaponId: WeaponId, yaw: number, pitch: number): void {
    const p = this.room.state.players.get(ownerId);
    if (!p) return;
    const dir = directionFromAngles(yaw, pitch);
    const eye = { x: p.x, y: p.y + GAMEPLAY.player.eyeHeight, z: p.z };
    const pr: Projectile = {
      id: `g${nextId++}`, weaponId, ownerId,
      x: eye.x + dir.x * 0.5, y: eye.y + dir.y * 0.5, z: eye.z + dir.z * 0.5,
      vx: dir.x * THROW_SPEED, vy: dir.y * THROW_SPEED + 2, vz: dir.z * THROW_SPEED,
      explodeAt: Date.now() + FUSE_MS,
    };
    this.list.push(pr);
    const s = new ProjectileState();
    s.id = pr.id; s.weaponId = weaponId; s.ownerId = ownerId; s.x = pr.x; s.y = pr.y; s.z = pr.z;
    this.room.state.projectiles.set(pr.id, s);
  }

  update(dt: number, now: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i]!;
      g.vy += GAMEPLAY.gravity * dt;
      const speed = Math.hypot(g.vx, g.vy, g.vz);
      if (speed > 0.01) {
        const dir = { x: g.vx / speed, y: g.vy / speed, z: g.vz / speed };
        const step = speed * dt;
        const hit = this.room.physics.raycastMap({ x: g.x, y: g.y, z: g.z }, dir, step + 0.15);
        if (hit) {
          const n = hit.normal;
          const dot = g.vx * n.x + g.vy * n.y + g.vz * n.z;
          g.vx = (g.vx - 2 * dot * n.x) * BOUNCE;
          g.vy = (g.vy - 2 * dot * n.y) * BOUNCE;
          g.vz = (g.vz - 2 * dot * n.z) * BOUNCE;
          g.x = hit.point.x + n.x * 0.16; g.y = hit.point.y + n.y * 0.16; g.z = hit.point.z + n.z * 0.16;
          // fricción al rodar
          if (Math.abs(n.y) > 0.7) { g.vx *= 0.8; g.vz *= 0.8; }
        } else {
          g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
        }
      }
      const s = this.room.state.projectiles.get(g.id);
      if (s) { s.x = g.x; s.y = g.y; s.z = g.z; }

      if (now >= g.explodeAt || g.y < this.room.physics.layout.killY) {
        this.detonate(g);
        this.list.splice(i, 1);
        this.room.state.projectiles.delete(g.id);
      }
    }
  }

  private detonate(g: Projectile): void {
    const w = WEAPONS[g.weaponId];
    if (w.damage > 0) {
      const payload: ExplosionPayload = { x: g.x, y: g.y, z: g.z, weaponId: g.weaponId };
      this.room.broadcast(ServerMessage.Explosion, payload);
      this.room.combat.explode({ x: g.x, y: g.y, z: g.z }, w.damage, w.range, g.ownerId, g.weaponId);
    } else {
      const payload: SmokePayload = { x: g.x, y: g.y, z: g.z, duration: SMOKE_DURATION };
      this.room.broadcast(ServerMessage.Smoke, payload);
    }
  }

  clear(): void {
    this.list.length = 0;
    this.room.state.projectiles.clear();
  }
}
