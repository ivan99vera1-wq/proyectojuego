import { GAMEPLAY, WEAPONS, type WeaponId } from '@game/config';
import { stepMovement, fallDamage, MAX_INPUT_DT } from '@game/shared';
import type { MatchRoom } from '../rooms/MatchRoom.js';

/** Máximo de inputs que se procesan por jugador y tick (protege al servidor). */
const MAX_INPUTS_PER_TICK = 8;
const HISTORY_MS = 1000;

/**
 * Aplica los inputs encolados con la función de movimiento compartida y
 * copia el resultado al estado sincronizado. Mantiene el historial de
 * posiciones para la compensación de lag.
 */
export class MovementSystem {
  constructor(private readonly room: MatchRoom) {}

  update(dt: number, now: number): void {
    const { state, physics } = this.room;
    for (const [id, rt] of this.room.runtime) {
      const p = state.players.get(id);
      if (!p) continue;
      rt.timeBudget = Math.min(0.25, rt.timeBudget + dt * 1.15);

      if (p.alive) {
        const factor = WEAPONS[p.weaponId as WeaponId]?.movementSpeedFactor ?? 1;
        let processed = 0;
        while (rt.inputs.length && processed < MAX_INPUTS_PER_TICK) {
          const input = rt.inputs.shift()!;
          const cost = Math.min(Math.max(input.dt, 0), MAX_INPUT_DT);
          if (rt.timeBudget < cost) { rt.inputs.length = 0; break; }
          rt.timeBudget -= cost;
          const res = stepMovement(physics, id, rt.kin, input, factor);
          p.yaw = input.yaw;
          p.pitch = input.pitch;
          p.lastSeq = input.seq;
          processed++;
          if (res.landedSpeed > 0) {
            const dmg = fallDamage(res.landedSpeed);
            if (dmg > 0) this.room.combat.applyDamage(id, id, dmg, false, 'fall');
          }
          if (rt.interacting && rt.interactStart) {
            if (Math.hypot(rt.kin.x - rt.interactStart.x, rt.kin.z - rt.interactStart.z) > 0.15) this.room.bomb.cancelInteract(id);
          }
        }
        // Si no hay inputs (cliente parado o con lag), seguir aplicando gravedad.
        if (processed === 0) {
          stepMovement(physics, id, rt.kin, { seq: p.lastSeq, dt, forward: 0, right: 0, jump: false, crouch: rt.kin.crouching, sprint: false, yaw: p.yaw, pitch: p.pitch }, factor);
        }
        p.x = rt.kin.x; p.y = rt.kin.y; p.z = rt.kin.z;
        p.crouching = rt.kin.crouching;
        if (p.y < physics.layout.killY) this.room.combat.applyDamage(id, id, 9999, false, 'fall');
      } else {
        rt.inputs.length = 0;
      }

      rt.history.push({ t: now, x: p.x, y: p.y, z: p.z, crouching: p.crouching });
      while (rt.history.length && rt.history[0]!.t < now - HISTORY_MS) rt.history.shift();
    }
  }

  /** Posición de un jugador en un instante pasado (interpolada). */
  positionAt(id: string, t: number): { x: number; y: number; z: number; crouching: boolean } | null {
    const rt = this.room.runtime.get(id);
    const p = this.room.state.players.get(id);
    if (!rt || !p) return null;
    const h = rt.history;
    if (h.length === 0 || t >= h[h.length - 1]!.t) return { x: p.x, y: p.y, z: p.z, crouching: p.crouching };
    if (t <= h[0]!.t) return h[0]!;
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1]!, b = h[i]!;
      if (t >= a.t && t <= b.t) {
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, crouching: b.crouching };
      }
    }
    return h[h.length - 1]!;
  }

  eyeHeight(crouching: boolean): number {
    const P = GAMEPLAY.player;
    return crouching ? P.eyeHeight * P.crouchHeightFactor : P.eyeHeight;
  }
}
