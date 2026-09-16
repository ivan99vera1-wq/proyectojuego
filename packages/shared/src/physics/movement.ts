import { GAMEPLAY } from '@game/config';
import type { InputPayload } from '../protocol/messages.js';
import type { PhysicsWorld } from './PhysicsWorld.js';

/** Estado cinemático de un jugador. Vive en servidor y en la predicción del cliente. */
export interface KinematicState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
  crouching: boolean;
}

export const createKinematicState = (x = 0, y = 0, z = 0): KinematicState =>
  ({ x, y, z, vx: 0, vy: 0, vz: 0, grounded: false, crouching: false });

/** Límite superior del dt de un input (evita teletransportes si el cliente manda dt enormes). */
export const MAX_INPUT_DT = 0.05;

export interface StepResult {
  /** Velocidad vertical con la que se tocó el suelo (positiva = fuerte), 0 si no aterrizó. */
  landedSpeed: number;
  jumped: boolean;
}

/**
 * Un paso de movimiento. Función determinista compartida por servidor (autoridad)
 * y cliente (predicción). `speedFactor` = WEAPONS[arma].movementSpeedFactor.
 */
export function stepMovement(
  world: PhysicsWorld,
  id: string,
  s: KinematicState,
  input: InputPayload,
  speedFactor = 1,
): StepResult {
  const P = GAMEPLAY.player;
  const dt = Math.min(Math.max(input.dt, 0), MAX_INPUT_DT);
  if (dt === 0) return { landedSpeed: 0, jumped: false };

  s.crouching = !!input.crouch;
  const base = s.crouching ? P.crouchSpeed : input.sprint ? P.runSpeed : P.walkSpeed;
  const speed = base * speedFactor;

  // Dirección deseada en el plano XZ a partir del yaw de la cámara.
  let f = Math.max(-1, Math.min(1, input.forward));
  let r = Math.max(-1, Math.min(1, input.right));
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const sin = Math.sin(input.yaw), cos = Math.cos(input.yaw);
  const wishX = (-sin * f + cos * r) * speed;
  const wishZ = (-cos * f - sin * r) * speed;

  let jumped = false;
  if (s.grounded) {
    s.vx = wishX;
    s.vz = wishZ;
    if (input.jump && !s.crouching) {
      s.vy = P.jumpVelocity;
      s.grounded = false;
      jumped = true;
    }
  } else {
    const k = Math.min(1, P.airControl * dt * 10);
    s.vx += (wishX - s.vx) * k;
    s.vz += (wishZ - s.vz) * k;
  }
  s.vy += GAMEPLAY.gravity * dt;

  const before = { x: s.x, y: s.y, z: s.z };
  const { moved, grounded } = world.movePlayer(id, before, { x: s.vx * dt, y: s.vy * dt, z: s.vz * dt });
  s.x += moved.x; s.y += moved.y; s.z += moved.z;

  let landedSpeed = 0;
  if (grounded && !s.grounded && s.vy < 0) landedSpeed = -s.vy;
  s.grounded = grounded;
  if (grounded && s.vy < 0) s.vy = 0;
  // Techo: si intentábamos subir y no nos movimos, anular velocidad vertical.
  if (s.vy > 0 && moved.y < s.vy * dt * 0.5) s.vy = 0;

  return { landedSpeed, jumped };
}

/** Daño por caída según GAMEPLAY.player. */
export function fallDamage(landedSpeed: number): number {
  const P = GAMEPLAY.player;
  if (landedSpeed <= P.fallDamageThreshold) return 0;
  return Math.round((landedSpeed - P.fallDamageThreshold) * P.fallDamagePerUnit);
}
