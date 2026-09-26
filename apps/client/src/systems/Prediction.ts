import { WEAPONS, type WeaponId } from '@game/config';
import {
  PhysicsWorld, createKinematicState, stepMovement,
  type InputPayload, type KinematicState, type PlayerSnapshot,
} from '@game/shared';

interface Pending { input: InputPayload; x: number; y: number; z: number; }

/**
 * Predicción del jugador local + reconciliación con el servidor.
 * Aplica cada input al instante con la misma función que el servidor; cuando
 * llega el estado autoritativo (lastSeq), descarta los inputs confirmados y, si
 * la posición difiere, corrige y re-aplica los pendientes.
 */
export class Prediction {
  readonly kin: KinematicState = createKinematicState();
  pending: Pending[] = [];
  seq = 0;
  /** Desplazamiento visual que se va reduciendo tras una corrección (evita tirones). */
  readonly smooth = { x: 0, y: 0, z: 0 };
  corrections = 0;

  constructor(private readonly physics: PhysicsWorld, readonly id: string) {
    physics.addPlayer(id, { x: 0, y: 0, z: 0 });
  }

  teleport(x: number, y: number, z: number): void {
    this.kin.x = x; this.kin.y = y; this.kin.z = z;
    this.kin.vx = this.kin.vy = this.kin.vz = 0;
    this.physics.setPlayerPosition(this.id, this.kin);
    this.pending = [];
    this.smooth.x = this.smooth.y = this.smooth.z = 0;
  }

  /** Aplica un input localmente y lo guarda para reconciliar. Devuelve el input con su seq. */
  step(input: Omit<InputPayload, 'seq'>, weaponId: string): InputPayload & { landed: number; jumped: boolean } {
    const full: InputPayload = { ...input, seq: ++this.seq };
    const factor = WEAPONS[weaponId as WeaponId]?.movementSpeedFactor ?? 1;
    const res = stepMovement(this.physics, this.id, this.kin, full, factor);
    this.pending.push({ input: full, x: this.kin.x, y: this.kin.y, z: this.kin.z });
    if (this.pending.length > 120) this.pending.shift();
    return { ...full, landed: res.landedSpeed, jumped: res.jumped };
  }

  /** Reconcilia con el estado autoritativo. */
  reconcile(me: PlayerSnapshot, weaponId: string): void {
    const ack = me.lastSeq;
    let acked: Pending | null = null;
    while (this.pending.length && this.pending[0]!.input.seq <= ack) acked = this.pending.shift()!;
    if (!acked) {
      // Sin inputs pendientes confirmados (p. ej. sin mover): si estamos lejos, adoptar.
      const d = Math.hypot(me.x - this.kin.x, me.y - this.kin.y, me.z - this.kin.z);
      if (d > 0.5 && this.pending.length === 0) this.adopt(me);
      return;
    }
    const err = Math.hypot(me.x - acked.x, me.y - acked.y, me.z - acked.z);
    if (err < 0.06) return;
    // Corrección: guardar posición visual previa, adoptar servidor y re-aplicar pendientes.
    const prev = { x: this.kin.x + this.smooth.x, y: this.kin.y + this.smooth.y, z: this.kin.z + this.smooth.z };
    this.adopt(me);
    const factor = WEAPONS[weaponId as WeaponId]?.movementSpeedFactor ?? 1;
    for (const p of this.pending) {
      stepMovement(this.physics, this.id, this.kin, p.input, factor);
      p.x = this.kin.x; p.y = this.kin.y; p.z = this.kin.z;
    }
    this.corrections++;
    if (err < 2) {
      this.smooth.x = prev.x - this.kin.x; this.smooth.y = prev.y - this.kin.y; this.smooth.z = prev.z - this.kin.z;
    } else {
      this.smooth.x = this.smooth.y = this.smooth.z = 0;
    }
  }

  private adopt(me: PlayerSnapshot): void {
    this.kin.x = me.x; this.kin.y = me.y; this.kin.z = me.z;
    this.kin.vx = me.vx; this.kin.vy = me.vy; this.kin.vz = me.vz;
    this.kin.grounded = me.grounded;
    this.physics.setPlayerPosition(this.id, this.kin);
  }

  /** Reduce el desplazamiento de suavizado. */
  update(dt: number): void {
    const k = Math.min(1, dt * 12);
    this.smooth.x -= this.smooth.x * k; this.smooth.y -= this.smooth.y * k; this.smooth.z -= this.smooth.z * k;
  }

  get renderPos(): { x: number; y: number; z: number } {
    return { x: this.kin.x + this.smooth.x, y: this.kin.y + this.smooth.y, z: this.kin.z + this.smooth.z };
  }

  dispose(): void { this.physics.removePlayer(this.id); }
}
