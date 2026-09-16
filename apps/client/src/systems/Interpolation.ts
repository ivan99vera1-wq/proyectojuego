import { NETWORK } from '@game/config';

export interface Snapshot { t: number; x: number; y: number; z: number; yaw: number; pitch: number; }
export interface InterpolatedPose { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; }

/** Buffer de snapshots de un jugador remoto; se renderiza con retraso fijo. */
export class InterpolationBuffer {
  private readonly buf: Snapshot[] = [];

  push(s: Snapshot): void {
    const last = this.buf[this.buf.length - 1];
    if (last && s.t - last.t < 5) return;
    if (last && last.x === s.x && last.y === s.y && last.z === s.z && last.yaw === s.yaw && last.pitch === s.pitch) { last.t = s.t; return; }
    this.buf.push(s);
    while (this.buf.length > 40) this.buf.shift();
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
        const k = Math.max(0, Math.min(1, (t - a.t) / span));
        const dist = Math.hypot(c.x - a.x, c.z - a.z);
        return {
          x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k,
          yaw: lerpAngle(a.yaw, c.yaw, k), pitch: a.pitch + (c.pitch - a.pitch) * k,
          speed: dist / (span / 1000),
        };
      }
    }
    // Más allá del último snapshot: extrapolación nula (quedarse quieto).
    const s = b[b.length - 1]!;
    return { ...s, speed: 0 };
  }
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
