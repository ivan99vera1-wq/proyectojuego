import type { Ring } from './geometry.js';
import type { Proportions } from './rig.js';

/**
 * =====================================================================
 *  PERFILES DEL CUERPO
 * =====================================================================
 *  Las secciones que definen cada parte del personaje base. Viven aparte
 *  porque los usan tres sitios: el cuerpo (para su malla), el rig (para
 *  colocar los rasgos de la cara justo sobre la piel) y la ropa (que se
 *  construye inflando estos mismos perfiles).
 * =====================================================================
 */

/** Cráneo chibi: mentón estrecho, mejillas llenas, sienes anchas, nuca abultada. */
export function headProfile(p: Proportions): Ring[] {
  const H = p.headH, W = p.headHalfW, D = p.headHalfD;
  return [
    { y: H * 0.00, w: W * 0.32, d: D * 0.36, n: 2.6, z: D * 0.16 },
    { y: H * 0.05, w: W * 0.49, d: D * 0.53, n: 2.6, z: D * 0.11 },
    { y: H * 0.12, w: W * 0.69, d: D * 0.75, n: 2.5, z: D * 0.05, back: 1.02 },
    { y: H * 0.22, w: W * 0.86, d: D * 0.90, n: 2.4, front: 0.98, back: 1.04 },
    { y: H * 0.33, w: W * 0.95, d: D * 0.96, n: 2.3, front: 0.96, back: 1.06 },
    { y: H * 0.46, w: W * 1.00, d: D * 1.00, n: 2.2, front: 0.96, back: 1.08 },
    { y: H * 0.60, w: W * 0.99, d: D * 0.99, n: 2.2, front: 0.97, back: 1.08 },
    { y: H * 0.74, w: W * 0.93, d: D * 0.94, n: 2.2, front: 1.00, back: 1.05 },
    { y: H * 0.86, w: W * 0.79, d: D * 0.80, n: 2.2, front: 1.00, back: 1.02 },
    { y: H * 0.95, w: W * 0.55, d: D * 0.56, n: 2.2 },
    { y: H * 1.00, w: W * 0.20, d: D * 0.20, n: 2.2 },
  ];
}

/** Torso: caderas, cintura estrecha, caja torácica y hombros anchos y planos. */
export function torsoProfile(p: Proportions): Ring[] {
  const T = p.torsoH;
  const midHalf = p.waistHalf + (p.chestHalf - p.waistHalf) * 0.65;
  return [
    { y: T * -0.17, w: p.hipHalf * 0.76, d: p.hipHalf * 0.60, n: 3.0 },
    { y: T * -0.06, w: p.hipHalf * 0.98, d: p.hipHalf * 0.70, n: 3.0 },
    { y: T * 0.05, w: p.hipHalf * 1.00, d: p.hipHalf * 0.71, n: 3.0, back: 1.04 },
    { y: T * 0.21, w: p.waistHalf, d: p.waistHalf * 0.74, n: 3.2, back: 1.03 },
    { y: T * 0.40, w: midHalf, d: midHalf * 0.70, n: 3.0, front: 1.02, back: 1.04 },
    { y: T * 0.62, w: p.chestHalf, d: p.chestHalf * 0.67, n: 2.8, front: 1.04, back: 1.06 },
    { y: T * 0.79, w: p.shoulderHalf, d: p.shoulderHalf * 0.58, n: 2.6, front: 1.02, back: 1.04 },
    { y: T * 0.90, w: p.shoulderHalf * 0.80, d: p.shoulderHalf * 0.55, n: 2.6 },
    { y: T * 1.00, w: p.shoulderHalf * 0.44, d: p.shoulderHalf * 0.42, n: 2.4 },
  ];
}

/** Deltoides marcado y brazo que adelgaza hacia el codo. */
export function armUpperProfile(p: Proportions): Ring[] {
  const r = p.armRadius;
  return [
    { y: 0.048, w: r * 0.80, d: r * 0.78, n: 2.5 },
    { y: 0.014, w: r * 1.00, d: r * 0.96, n: 2.4 },
    { y: -0.045, w: r * 0.85, d: r * 0.83, n: 2.4 },
    { y: -p.upperArm + 0.014, w: r * 0.73, d: r * 0.72, n: 2.4 },
    { y: -p.upperArm, w: r * 0.70, d: r * 0.70, n: 2.4 },
  ];
}

/** Antebrazo: bola del codo y adelgazamiento hasta la muñeca. */
export function armLowerProfile(p: Proportions): Ring[] {
  const r = p.armRadius;
  return [
    { y: 0.016, w: r * 0.78, d: r * 0.78, n: 2.4 },
    { y: -0.028, w: r * 0.74, d: r * 0.73, n: 2.4 },
    { y: -p.foreArm * 0.62, w: r * 0.65, d: r * 0.64, n: 2.4 },
    { y: -p.foreArm, w: r * 0.55, d: r * 0.55, n: 2.5 },
  ];
}

/** Palma de la mano (sin pulgar): la usan también los guantes. */
export function handProfile(p: Proportions): Ring[] {
  const r = p.armRadius;
  return [
    { y: 0.004, w: r * 0.56, d: r * 0.46, n: 3.0 },
    { y: -0.020, w: r * 0.74, d: r * 0.55, n: 3.2 },
    { y: -p.hand * 0.60, w: r * 0.76, d: r * 0.55, n: 3.2 },
    { y: -p.hand * 0.86, w: r * 0.64, d: r * 0.47, n: 3.0 },
    { y: -p.hand, w: r * 0.34, d: r * 0.28, n: 3.0 },
  ];
}

/** Muslo lleno que se afina hacia la rodilla. */
export function legUpperProfile(p: Proportions): Ring[] {
  const r = p.thighRadius;
  return [
    { y: 0.030, w: r * 0.92, d: r * 0.90, n: 2.8 },
    { y: -0.012, w: r * 1.00, d: r * 0.97, n: 2.8 },
    { y: -p.thigh * 0.55, w: r * 0.88, d: r * 0.86, n: 2.7 },
    { y: -p.thigh + 0.020, w: r * 0.81, d: r * 0.80, n: 2.6 },
    { y: -p.thigh, w: r * 0.78, d: r * 0.78, n: 2.6 },
  ];
}

/** Rodilla marcada y pantorrilla con volumen hacia atrás. */
export function legLowerProfile(p: Proportions): Ring[] {
  const r = p.thighRadius;
  return [
    { y: 0.024, w: r * 0.85, d: r * 0.84, n: 2.6, front: 1.06 },
    { y: -0.014, w: r * 0.81, d: r * 0.80, n: 2.6 },
    { y: -p.shin * 0.34, w: r * 0.77, d: r * 0.76, n: 2.6, back: 1.22 },
    { y: -p.shin * 0.72, w: r * 0.61, d: r * 0.60, n: 2.6, back: 1.06 },
    { y: -p.shin, w: r * 0.50, d: r * 0.50, n: 2.6 },
  ];
}

/** Pie con empeine, punta hacia +Z y suela con arista dura. */
export function footProfile(p: Proportions): Ring[] {
  const r = p.thighRadius;
  const A = p.ankleH;
  return [
    { y: 0.008, w: r * 0.52, d: r * 0.58, n: 2.8, z: r * 0.10 },
    { y: -A * 0.34, w: r * 0.63, d: r * 0.96, n: 3.0, z: r * 0.36 },
    { y: -A * 0.70, w: r * 0.67, d: r * 1.24, n: 3.2, z: r * 0.55 },
    { y: -A * 0.93, w: r * 0.65, d: r * 1.30, n: 3.4, z: r * 0.58, crease: true },
    { y: -A, w: r * 0.58, d: r * 1.24, n: 3.6, z: r * 0.58 },
  ];
}

// ------------------------------------------------- utilidades de perfil

const pick = (a: number | undefined, b: number | undefined, t: number, dflt: number): number => {
  const av = a ?? dflt, bv = b ?? dflt;
  return av + (bv - av) * t;
};

/** Interpola un anillo intermedio entre dos anillos del perfil. */
export function lerpRing(a: Ring, b: Ring, t: number, y: number): Ring {
  return {
    y,
    w: a.w + (b.w - a.w) * t,
    d: pick(a.d ?? a.w, b.d ?? b.w, t, 0),
    n: pick(a.n, b.n, t, 2.4),
    x: pick(a.x, b.x, t, 0),
    z: pick(a.z, b.z, t, 0),
    front: pick(a.front, b.front, t, 1),
    back: pick(a.back, b.back, t, 1),
  };
}

/** Anillo del perfil a una altura concreta. */
export function ringAt(rings: Ring[], y: number): Ring {
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1]!, b = rings[i]!;
    if (y >= a.y && y <= b.y) {
      const span = b.y - a.y;
      return lerpRing(a, b, span < 1e-6 ? 0 : (y - a.y) / span, y);
    }
  }
  const edge = y <= rings[0]!.y ? rings[0]! : rings[rings.length - 1]!;
  return { ...edge, y };
}

/** Recorta un perfil entre dos alturas, interpolando los bordes. */
export function sliceProfile(rings: Ring[], yMin: number, yMax: number): Ring[] {
  const out: Ring[] = [ringAt(rings, yMin)];
  for (const r of rings) if (r.y > yMin && r.y < yMax) out.push({ ...r });
  out.push(ringAt(rings, yMax));
  return out;
}

/** Engorda un perfil: así una prenda envuelve el cuerpo sin atravesarlo. */
export function inflateProfile(rings: Ring[], amount: number, nBoost = 0): Ring[] {
  return rings.map((r) => ({
    ...r,
    w: r.w + amount,
    d: (r.d ?? r.w) + amount,
    n: (r.n ?? 2.4) + nBoost,
  }));
}

/**
 * Z de la superficie frontal de la cabeza a una altura dada. Sirve para
 * pegar ojos, cejas, boca y gafas exactamente sobre la piel en vez de
 * dejarlos hundidos o flotando.
 */
export function headSurfaceZ(p: Proportions, yLocal: number): number {
  return headSurfaceAt(p, yLocal, 0);
}

/**
 * Z de la superficie de la cabeza en un punto (y, x) cualquiera. Resolver la
 * superelipse para ese x es lo que permite pegar los ojos a la mejilla en vez
 * de dejarlos atravesando el lateral del cráneo.
 */
export function headSurfaceAt(p: Proportions, yLocal: number, x: number): number {
  const r = ringAt(headProfile(p), yLocal);
  const n = r.n ?? 2.4;
  const d = (r.d ?? r.w) * (r.front ?? 1);
  const u = Math.min(0.999, Math.abs(x) / Math.max(1e-6, r.w));
  return (r.z ?? 0) + d * Math.pow(Math.max(0, 1 - Math.pow(u, n)), 1 / n);
}

/** Giro (sobre Y) de la normal de la cara en ese punto: orienta ojos y cejas. */
export function headSurfaceYaw(p: Proportions, yLocal: number, x: number): number {
  const eps = 0.004;
  const slope = (headSurfaceAt(p, yLocal, x + eps) - headSurfaceAt(p, yLocal, x - eps)) / (2 * eps);
  return Math.atan2(-slope, 1);
}
