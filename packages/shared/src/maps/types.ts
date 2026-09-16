import type { Vec3 } from '../math/vec3.js';

/** Caja del mundo: centro, tamaño completo, rotación (Euler rad) y color. */
export interface MapBox {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  rx?: number; ry?: number; rz?: number;
  color?: string;
  /** Si es false solo se dibuja (decoración sin colisión). */
  solid?: boolean;
}

/** Volumen axis-aligned (zonas de bomba, compra, muerte). */
export interface MapZone {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
}

export interface SpawnPoint extends Vec3 {
  yaw: number;
}

/** Adornos del mapa. Nunca colisionan: son solo decorado. */
export type MapPropKind = 'tree' | 'bush' | 'cloud' | 'lamp' | 'flag' | 'rock' | 'balloon';

export interface MapProp {
  kind: MapPropKind;
  x: number;
  y?: number;
  z: number;
  /** Tamaño relativo (1 = por defecto). */
  scale?: number;
  /** Giro sobre Y en radianes. */
  rot?: number;
  color?: string;
}

/**
 * Descripción de un mapa en datos. Es la fuente de verdad de la COLISIÓN
 * tanto en cliente como en servidor (ambos construyen el mismo mundo Rapier).
 * El arte final (GLB) puede superponerse encima sin cambiar la jugabilidad.
 */
export interface MapLayout {
  id: string;
  boxes: MapBox[];
  spawns: { A: SpawnPoint[]; B: SpawnPoint[]; FFA: SpawnPoint[] };
  bombsites: { A: MapZone; B: MapZone };
  buyzones: { A: MapZone; B: MapZone };
  /** Altura por debajo de la cual el jugador muere. */
  killY: number;
  floorColor: string;
  /** Adornos sin colisión: árboles, nubes, farolas, banderas. */
  props?: MapProp[];
}

export const pointInZone = (p: Vec3, z: MapZone): boolean =>
  Math.abs(p.x - z.x) <= z.sx / 2 && Math.abs(p.y - z.y) <= z.sy / 2 && Math.abs(p.z - z.z) <= z.sz / 2;
