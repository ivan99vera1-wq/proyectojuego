import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * =====================================================================
 *  KIT DE GEOMETRÍA ESTILIZADA
 * =====================================================================
 *  Todas las formas del personaje se construyen "lofteando" secciones
 *  superelípticas a lo largo de un eje vertical. Una superelipse
 *  |x/w|^n + |z/d|^n = 1 permite pasar de una elipse (n = 2) a una caja
 *  redondeada (n = 6) con el mismo código, que es justo lo que separa
 *  un cuerpo diseñado de una cápsula.
 *
 *  Con esto se controlan de verdad los cambios de volumen: anchura de
 *  hombros, estrechamiento de cintura, rodilla, tobillo o mandíbula son
 *  simplemente anillos con distinto radio.
 * =====================================================================
 */

export interface Ring {
  /** Altura del anillo en el espacio local de la pieza. */
  y: number;
  /** Semiancho en X. 0 cierra la forma en punta. */
  w: number;
  /** Semiprofundidad en Z (por defecto igual a `w`). */
  d?: number;
  /** Exponente de la superelipse: 2 = elipse, 3 = redondeado, 6 ≈ caja. */
  n?: number;
  /** Desplazamiento lateral del anillo. */
  x?: number;
  /** Desplazamiento frontal del anillo (para mandíbula, pie, espalda). */
  z?: number;
  /** Multiplica solo la mitad delantera (z > 0). < 1 aplana la cara. */
  front?: number;
  /** Multiplica solo la mitad trasera (z < 0). > 1 abulta la nuca. */
  back?: number;
  /** Rompe el sombreado suave en este anillo para crear una arista dura. */
  crease?: boolean;
}

function ringPoints(r: Ring, segments: number): Float32Array {
  const n = r.n ?? 2.4;
  const d = r.d ?? r.w;
  const e = 2 / n;
  const ox = r.x ?? 0;
  const oz = r.z ?? 0;
  const out = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const sx = Math.sign(ca) * Math.pow(Math.abs(ca), e);
    const sz = Math.sign(sa) * Math.pow(Math.abs(sa), e);
    let z = sz * d;
    if (z > 0 && r.front !== undefined) z *= r.front;
    else if (z < 0 && r.back !== undefined) z *= r.back;
    out[i * 3] = ox + sx * r.w;
    out[i * 3 + 1] = r.y;
    out[i * 3 + 2] = oz + z;
  }
  return out;
}

export interface LoftOptions {
  segments?: number;
  /** Cierra el extremo inferior con un abanico (por defecto sí). */
  capBottom?: boolean;
  capTop?: boolean;
}

/**
 * Construye una superficie cerrada a partir de una lista de anillos
 * ordenados de abajo a arriba. Las normales salen hacia fuera.
 */
export function loft(rings: Ring[], options: LoftOptions = {}): THREE.BufferGeometry {
  const segments = options.segments ?? 18;
  const capBottom = options.capBottom ?? true;
  const capTop = options.capTop ?? true;

  // Un anillo con `crease` se emite dos veces para que las normales no se
  // promedien a través de él: así nace una arista limpia (suela, visera…).
  const bands: { data: Float32Array; connectUp: boolean }[] = [];
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i]!;
    const data = ringPoints(r, segments);
    const isLast = i === rings.length - 1;
    if (r.crease && !isLast && i > 0) {
      bands.push({ data, connectUp: false });
      bands.push({ data: data.slice(), connectUp: !isLast });
    } else {
      bands.push({ data, connectUp: !isLast });
    }
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];
  for (const b of bands) {
    ringStart.push(positions.length / 3);
    for (let i = 0; i < b.data.length; i++) positions.push(b.data[i]!);
  }

  for (let r = 0; r < bands.length - 1; r++) {
    if (!bands[r]!.connectUp) continue;
    const a0 = ringStart[r]!;
    const b0 = ringStart[r + 1]!;
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const ai = a0 + i, aj = a0 + j, bi = b0 + i, bj = b0 + j;
      indices.push(ai, bi, bj);
      indices.push(ai, bj, aj);
    }
  }

  const addCap = (bandIndex: number, top: boolean) => {
    const band = bands[bandIndex]!;
    const start = ringStart[bandIndex]!;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < segments; i++) {
      cx += band.data[i * 3]!; cy += band.data[i * 3 + 1]!; cz += band.data[i * 3 + 2]!;
    }
    cx /= segments; cy /= segments; cz /= segments;
    // Si el anillo ya está colapsado en el eje no hace falta tapa.
    let maxR = 0;
    for (let i = 0; i < segments; i++) {
      maxR = Math.max(maxR, Math.hypot(band.data[i * 3]! - cx, band.data[i * 3 + 2]! - cz));
    }
    if (maxR < 0.0015) return;
    const c = positions.length / 3;
    positions.push(cx, cy, cz);
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      if (top) indices.push(c, start + j, start + i);
      else indices.push(c, start + i, start + j);
    }
  };
  if (capBottom) addCap(0, false);
  if (capTop) addCap(bands.length - 1, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Hornea una oclusión ambiental suave en los colores de vértice: las caras
 * que miran hacia abajo y las zonas bajas de cada pieza se oscurecen un poco.
 * Da profundidad y lectura de volumen sin añadir ni una llamada de dibujo.
 */
export function bakeAO(geo: THREE.BufferGeometry, strength = 0.13, floorBias = 0.42): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const h = Math.max(1e-4, bb.max.y - bb.min.y);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - bb.min.y) / h;
    // Gradiente vertical suave y nada más: cualquier término por normal
    // facetaría la superficie, que es justo lo que queremos evitar.
    const height = floorBias + (1 - floorBias) * (k * k * (3 - 2 * k));
    const v = Math.min(1, Math.max(0.68, 1 - strength * (1 - height)));
    colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Une varias geometrías en una sola malla (menos llamadas de dibujo).
 * Normaliza los atributos antes de unir: si alguna pieza trae oclusión
 * horneada y otra no, se le añade color blanco para que encajen.
 */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const valid = geos.filter((g) => (g.getAttribute('position')?.count ?? 0) > 0);
  if (valid.length === 0) return new THREE.BufferGeometry();
  if (valid.length === 1) return valid[0]!;
  const withColor = valid.some((g) => g.getAttribute('color'));
  for (const g of valid) {
    // Solo posición, normal y color: cualquier otro atributo rompería la unión.
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    }
    if (withColor && !g.getAttribute('color')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    } else if (!withColor && g.getAttribute('color')) {
      g.deleteAttribute('color');
    }
  }
  const out = mergeGeometries(valid, false);
  if (!out) return valid[0]!;
  for (const g of valid) g.dispose();
  return out;
}

/** Traslada y rota una geometría en el sitio (para componer piezas antes de unirlas). */
export function place(geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  geo.applyMatrix4(m);
  return geo;
}

/** Elipsoide con exponente ajustable: útil para orejas, hombreras y detalles. */
export function blob(w: number, h: number, d: number, n = 2.2, segments = 12, rings = 7): THREE.BufferGeometry {
  const list: Ring[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const a = (t - 0.5) * Math.PI;
    list.push({ y: Math.sin(a) * h, w: Math.cos(a) * w, d: Math.cos(a) * d, n });
  }
  return loft(list, { segments });
}
