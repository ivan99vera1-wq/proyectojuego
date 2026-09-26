import { ECONOMY, GAMEPLAY } from '@game/config';
import {
  ServerMessage, clampMoney, pointInZone,
  type BombDefusedPayload, type BombExplodedPayload, type BombPlantedPayload,
} from '@game/shared';
import type { MatchRoom } from '../rooms/MatchRoom.js';

const PICKUP_RADIUS = 1.2;
const DEFUSE_RADIUS = 1.6;
/** Margen vertical para recoger o desactivar la bomba (m). */
const REACH_HEIGHT = 1.5;
const EXPLOSION_DAMAGE = 500;
const EXPLOSION_RADIUS = 16;

/** Plantar, desactivar, soltar, recoger y explotar la bomba. */
export class BombSystem {
  private plantedAt = 0;
  private planterId = '';

  constructor(private readonly room: MatchRoom) {}

  reset(): void {
    const s = this.room.state;
    s.bombState = 'none';
    s.bombTimer = 0;
    s.bombX = 0; s.bombY = 0; s.bombZ = 0;
    this.plantedAt = 0;
    this.planterId = '';
    for (const p of s.players.values()) { p.hasBomb = false; p.interactProgress = 0; }
  }

  /** Entrega la bomba a un jugador aleatorio del equipo B. */
  assignCarrier(): void {
    if (!this.room.mode.bomb) return;
    const candidates = [...this.room.state.players.values()].filter((p) => p.team === 'B' && p.alive && p.connected);
    if (candidates.length === 0) { this.room.state.bombState = 'none'; return; }
    const c = candidates[Math.floor(Math.random() * candidates.length)]!;
    c.hasBomb = true;
    this.room.state.bombState = 'carried';
  }

  dropBomb(playerId: string): void {
    const p = this.room.state.players.get(playerId);
    if (!p || !p.hasBomb) return;
    p.hasBomb = false;
    const s = this.room.state;
    s.bombState = 'dropped';
    s.bombX = p.x; s.bombY = p.y; s.bombZ = p.z;
  }

  setInteracting(playerId: string, active: boolean): void {
    const rt = this.room.runtime.get(playerId);
    const p = this.room.state.players.get(playerId);
    if (!rt || !p) return;
    if (!active) { this.cancelInteract(playerId); return; }
    if (!p.alive || this.room.phase !== 'live' || !this.room.mode.bomb) return;
    rt.interacting = true;
    rt.interactStart = { x: p.x, z: p.z };
    p.interactProgress = 0;
  }

  cancelInteract(playerId: string): void {
    const rt = this.room.runtime.get(playerId);
    const p = this.room.state.players.get(playerId);
    if (rt) { rt.interacting = false; rt.interactStart = null; }
    if (p) p.interactProgress = 0;
  }

  update(dt: number, now: number): void {
    const s = this.room.state;
    if (!this.room.mode.bomb || this.room.phase !== 'live') return;
    const layout = this.room.physics.layout;

    // Recoger bomba soltada
    if (s.bombState === 'dropped') {
      for (const p of s.players.values()) {
        if (p.team === 'B' && p.alive
          && Math.hypot(p.x - s.bombX, p.z - s.bombZ) < PICKUP_RADIUS && Math.abs(p.y - s.bombY) < REACH_HEIGHT) {
          p.hasBomb = true; s.bombState = 'carried'; break;
        }
      }
    }

    // Plantar / desactivar
    for (const [id, rt] of this.room.runtime) {
      if (!rt.interacting) continue;
      const p = s.players.get(id);
      if (!p || !p.alive) { this.cancelInteract(id); continue; }
      if (p.team === 'B' && p.hasBomb && s.bombState === 'carried') {
        const inSite = pointInZone(p, layout.bombsites.A) || pointInZone(p, layout.bombsites.B);
        if (!inSite || !rt.kin.grounded) { this.cancelInteract(id); continue; }
        p.interactProgress = Math.min(1, p.interactProgress + dt / GAMEPLAY.round.plantTime);
        if (p.interactProgress >= 1) this.plant(id, now);
      } else if (p.team === 'A' && s.bombState === 'planted') {
        const near = Math.hypot(p.x - s.bombX, p.z - s.bombZ) < DEFUSE_RADIUS && Math.abs(p.y - s.bombY) < REACH_HEIGHT;
        if (!near) { this.cancelInteract(id); continue; }
        const total = p.kit ? GAMEPLAY.round.defuseTimeWithKit : GAMEPLAY.round.defuseTime;
        p.interactProgress = Math.min(1, p.interactProgress + dt / total);
        if (p.interactProgress >= 1) this.defuse(id);
      } else {
        this.cancelInteract(id);
      }
    }

    // Cuenta atrás
    if (s.bombState === 'planted') {
      s.bombTimer = Math.max(0, GAMEPLAY.round.bombTimer - (now - this.plantedAt) / 1000);
      if (s.bombTimer <= 0) this.explode();
    }
  }

  private plant(id: string, now: number): void {
    const s = this.room.state;
    const p = s.players.get(id)!;
    p.hasBomb = false;
    this.cancelInteract(id);
    s.bombState = 'planted';
    s.bombX = p.x; s.bombY = p.y; s.bombZ = p.z;
    s.bombTimer = GAMEPLAY.round.bombTimer;
    this.plantedAt = now;
    this.planterId = id;
    if (this.room.mode.economy) p.money = clampMoney(p.money + ECONOMY.bombPlant);
    const payload: BombPlantedPayload = { playerId: id, x: s.bombX, y: s.bombY, z: s.bombZ };
    this.room.broadcast(ServerMessage.BombPlanted, payload);
    // Al plantar, el tiempo de ronda deja de contar: manda la bomba.
    this.room.round.onBombPlanted();
  }

  private defuse(id: string): void {
    const s = this.room.state;
    const p = s.players.get(id)!;
    this.cancelInteract(id);
    s.bombState = 'defused';
    if (this.room.mode.economy) p.money = clampMoney(p.money + ECONOMY.bombDefuse);
    const payload: BombDefusedPayload = { playerId: id };
    this.room.broadcast(ServerMessage.BombDefused, payload);
    this.room.round.endRound('A', 'bomb_defused');
  }

  private explode(): void {
    const s = this.room.state;
    s.bombState = 'exploded';
    const center = { x: s.bombX, y: s.bombY + 0.5, z: s.bombZ };
    const payload: BombExplodedPayload = { x: s.bombX, y: s.bombY, z: s.bombZ };
    this.room.broadcast(ServerMessage.BombExploded, payload);
    // La ronda se cierra ANTES de repartir el daño: si no, las muertes de la
    // explosión la cerraban por eliminación y el motivo que veía el jugador
    // no era el real.
    this.room.round.endRound('B', 'bomb_exploded');
    this.room.combat.explode(center, EXPLOSION_DAMAGE, EXPLOSION_RADIUS, this.planterId, 'bomb');
  }
}
