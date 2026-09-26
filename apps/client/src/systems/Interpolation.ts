import { NETWORK } from '@game/config';
import { clamp, lerp, lerpAngle } from '@game/shared';

export interface Snapshot { t: number; x: number; y: number; z: number; yaw: number; pitch: number; }
export interface InterpolatedPose { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; }

/** Snapshots que se guardan por jugador remoto (2 s a patchRate). */
const MAX_SNAPSHOTS = 40;
/** Dos snapshots más juntos que esto se consideran el mismo instante (ms). */
const MIN_SNAPSHOT_GAP = 5;

/** Buffer de snapshots de un jugador remoto; se renderiza con retraso fijo. */
export class InterpolationBuffer {
  private readonly buf: Snapshot[] = [];

  push(s: Snapshot): void {
    const last = this.buf[this.buf.length - 1];
    if (last && s.t - last.t < MIN_SNAPSHOT_GAP) return;
    if (last && last.x === s.x && last.y === s.y && last.z === s.z && last.yaw === s.yaw && last.pitch === s.pitch) {
      last.t = s.t;
      return;
    }
    this.buf.push(s);
    while (this.buf.length > MAX_SNAPSHOTS) this.buf.shift();
  }

  /** Vacía el historial (el jugador reapareció en otro sitio: no hay que interpolar el salto). */
  reset(): void {
    this.buf.length = 0;
  }

  sample(now: number): InterpolatedPose | null {
    const t = now - NETWORK.interpolationDelay;
    const b = this.buf;
    if (b.length === 0) return null;
    if (b.length === 1 || t <= b[0]!.t) { const s = b[0]!; return { ...s, speed: 0 }; }
    for (let i = 1; i < b.length; i++) {
      const a = b[i - 1]!, c = b[i]!;
      if (t <= c.t) {
        const span = Math.max(1, c.t - a.t);
        const k = clamp((t - a.t) / span, 0, 1);
        const dist = Math.hypot(c.x - a.x, c.z - a.z);
        return {
          x: lerp(a.x, c.x, k), y: lerp(a.y, c.y, k), z: lerp(a.z, c.z, k),
          yaw: lerpAngle(a.yaw, c.yaw, k), pitch: lerp(a.pitch, c.pitch, k),
          speed: dist / (span / 1000),
        };
      }
    }
    // Más allá del último snapshot: extrapolación nula (quedarse quieto).
    const s = b[b.length - 1]!;
    return { ...s, speed: 0 };
  }
}
