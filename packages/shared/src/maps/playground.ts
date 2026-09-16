import type { MapLayout, MapBox, SpawnPoint } from './types.js';

const C = {
  wall: '#6c7a9c', crate: '#d9a066', ramp: '#8fb3ff', platform: '#f2c14e',
  siteA: '#ff7a3a', siteB: '#3a8dff', slide: '#ff5c7a', sand: '#efd9a7',
};

const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra: Partial<MapBox> = {}): MapBox =>
  ({ x, y, z, sx, sy, sz, color, ...extra });

const line = (points: [number, number, number, number][]): SpawnPoint[] =>
  points.map(([x, y, z, yaw]) => ({ x, y, z, yaw }));

/**
 * "Patio de Juegos": arena 60x60 con tres rutas (tobogán oeste, arenero central,
 * columpios este). Equipo A (Guardianes) al norte (z-), equipo B (Saboteadores) al sur (z+).
 * Sitio A al noroeste, sitio B al noreste.
 */
export const PLAYGROUND: MapLayout = {
  id: 'playground',
  floorColor: '#5fbf73',
  killY: -10,
  boxes: [
    // suelo
    box(0, -0.5, 0, 60, 1, 60, '#5fbf73'),
    // muros exteriores
    box(0, 2, -30.5, 62, 4, 1, C.wall),
    box(0, 2, 30.5, 62, 4, 1, C.wall),
    box(-30.5, 2, 0, 1, 4, 62, C.wall),
    box(30.5, 2, 0, 1, 4, 62, C.wall),

    // ---- zona central: arenero con cajas ----
    box(0, 0.1, 0, 14, 0.2, 14, C.sand, { solid: false }),
    box(-3, 0.75, -2, 1.5, 1.5, 1.5, C.crate),
    box(3, 0.75, 2, 1.5, 1.5, 1.5, C.crate),
    box(3, 2.25, 2, 1.5, 1.5, 1.5, C.crate),
    box(0, 0.75, 5, 3, 1.5, 1.5, C.crate),
    box(0, 0.75, -5, 3, 1.5, 1.5, C.crate),
    box(-6, 1, 0, 1, 2, 6, C.wall),
    box(6, 1, 0, 1, 2, 6, C.wall),

    // ---- ruta oeste: tobogán (rampa larga) hacia sitio A ----
    box(-20, 1.5, 4, 6, 3, 1, C.wall),
    box(-20, 0.9, -4, 6, 0.4, 9, C.ramp, { rx: -0.35 }),
    box(-20, 2.4, -10, 6, 0.4, 4, C.platform),
    box(-23, 3.4, -10, 0.4, 1.6, 4, C.slide),
    box(-17, 3.4, -10, 0.4, 1.6, 4, C.slide),

    // ---- ruta este: columpios (postes) hacia sitio B ----
    box(20, 2, -2, 0.4, 4, 0.4, C.wall),
    box(20, 2, 2, 0.4, 4, 0.4, C.wall),
    box(20, 4.1, 0, 0.4, 0.4, 4.4, C.wall),
    box(24, 1, 6, 4, 2, 1, C.wall),
    box(16, 1, -6, 4, 2, 1, C.wall),
    box(22, 0.75, -12, 1.5, 1.5, 1.5, C.crate),
    box(18, 0.75, -14, 1.5, 1.5, 1.5, C.crate),

    // ---- sitio A (noroeste) ----
    box(-20, 0.05, -22, 10, 0.1, 10, C.siteA, { solid: false }),
    box(-15, 1, -18, 1, 2, 8, C.wall),
    box(-24, 0.75, -24, 1.5, 1.5, 1.5, C.crate),

    // ---- sitio B (noreste) ----
    box(20, 0.05, -22, 10, 0.1, 10, C.siteB, { solid: false }),
    box(15, 1, -18, 1, 2, 8, C.wall),
    box(24, 0.75, -24, 1.5, 1.5, 1.5, C.crate),
    box(24, 2.25, -24, 1.5, 1.5, 1.5, C.crate),

    // ---- pasillos medios / cobertura ----
    box(-10, 1, -12, 8, 2, 1, C.wall),
    box(10, 1, -12, 8, 2, 1, C.wall),
    box(-10, 1, 12, 8, 2, 1, C.wall),
    box(10, 1, 12, 8, 2, 1, C.wall),
    box(0, 1, 20, 12, 2, 1, C.wall),
    box(0, 1, -20, 1, 2, 8, C.wall),

    // ---- spawn B (sur): base ----
    box(-8, 0.75, 26, 1.5, 1.5, 1.5, C.crate),
    box(8, 0.75, 26, 1.5, 1.5, 1.5, C.crate),
  ],
  spawns: {
    A: line([[-6, 0, -26, Math.PI], [-3, 0, -26, Math.PI], [0, 0, -27, Math.PI], [3, 0, -26, Math.PI], [6, 0, -26, Math.PI]]),
    B: line([[-6, 0, 26, 0], [-3, 0, 26, 0], [0, 0, 27, 0], [3, 0, 26, 0], [6, 0, 26, 0]]),
    FFA: line([
      [-6, 0, -26, Math.PI], [6, 0, 26, 0], [-24, 0, 0, Math.PI / 2], [24, 0, 0, -Math.PI / 2],
      [-20, 0, -22, Math.PI], [20, 0, -22, Math.PI], [0, 0, 10, 0], [-12, 0, 18, 0.5], [12, 0, -18, -2.5], [0, 0, -10, Math.PI],
    ]),
  },
  bombsites: {
    A: { x: -20, y: 1, z: -22, sx: 10, sy: 4, sz: 10 },
    B: { x: 20, y: 1, z: -22, sx: 10, sy: 4, sz: 10 },
  },
  buyzones: {
    A: { x: 0, y: 1, z: -26, sx: 20, sy: 4, sz: 8 },
    B: { x: 0, y: 1, z: 26, sx: 20, sy: 4, sz: 8 },
  },
};
