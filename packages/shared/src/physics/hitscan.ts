import { GAMEPLAY } from '@game/config';
import type { Vec3 } from '../math/vec3.js';
import type { HitZone } from '../rules/damage.js';

/** Radio de la esfera de cabeza (hitbox fija para todos, ver GAME_DESIGN). */
export const HEAD_RADIUS = 0.28;

export interface TargetBox {
  id: string;
  /** Posición de los pies. */
  x: number; y: number; z: number;
  crouching: boolean;
}

export interface HitscanHit {
  id: string;
  zone: HitZone;
  distance: number;
}

function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number | null {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c2 = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c2;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

/** Intersección rayo–cápsula vertical (segmento [a,b] + radio). Devuelve la distancia o null. */
function rayVerticalCapsule(o: Vec3, d: Vec3, x: number, z: number, y0: number, y1: number, r: number): number | null {
  // Cilindro infinito
  const ox = o.x - x, oz = o.z - z;
  const a = d.x * d.x + d.z * d.z;
  let best: number | null = null;
  if (a > 1e-8) {
    const b = ox * d.x + oz * d.z;
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      if (t >= 0) {
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) best = t;
      }
    }
  }
  for (const cy of [y0, y1]) {
    const t = raySphere(o, d, { x, y: cy, z }, r);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}

/**
 * Prueba un rayo contra una lista de objetivos y devuelve el más cercano.
 * Cabeza = esfera; cuerpo = cápsula. Zona 'limbs' = tercio inferior del cuerpo.
 */
export function hitscan(origin: Vec3, dir: Vec3, targets: TargetBox[], maxDistance: number): HitscanHit | null {
  const P = GAMEPLAY.player;
  let best: HitscanHit | null = null;
  for (const t of targets) {
    const h = t.crouching ? P.capsuleHeight * P.crouchHeightFactor : P.capsuleHeight;
    const headY = t.y + h - HEAD_RADIUS * 0.9;
    const dHead = raySphere(origin, dir, { x: t.x, y: headY, z: t.z }, HEAD_RADIUS);
    const bodyTop = headY - HEAD_RADIUS * 0.6;
    const dBody = rayVerticalCapsule(origin, dir, t.x, t.z, t.y + P.capsuleRadius, bodyTop - P.capsuleRadius, P.capsuleRadius);
    let dist: number | null = null;
    let zone: HitZone = 'body';
    if (dHead !== null && (dBody === null || dHead <= dBody)) { dist = dHead; zone = 'head'; }
    else if (dBody !== null) {
      dist = dBody;
      const hitY = origin.y + dir.y * dBody;
      zone = hitY < t.y + h * 0.4 ? 'limbs' : 'body';
    }
    if (dist !== null && dist <= maxDistance && (best === null || dist < best.distance)) {
      best = { id: t.id, zone, distance: dist };
    }
  }
  return best;
}
