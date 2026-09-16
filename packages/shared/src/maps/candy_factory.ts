import type { MapLayout, MapBox, SpawnPoint } from './types.js';

const C = { wall: '#a35c8f', choc: '#5b3a29', belt: '#3d3d5c', candy: '#ff7ab6', mint: '#7de3c4', siteA: '#ff7a3a', siteB: '#3a8dff' };
const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra: Partial<MapBox> = {}): MapBox =>
  ({ x, y, z, sx, sy, sz, color, ...extra });
const line = (points: [number, number, number, number][]): SpawnPoint[] => points.map(([x, y, z, yaw]) => ({ x, y, z, yaw }));

/** "Fábrica de Dulces": layout compacto con pasarelas elevadas (cintas) y tanques como cobertura. */
export const CANDY_FACTORY: MapLayout = {
  id: 'candy_factory',
  floorColor: '#f4c2d7',
  killY: -10,
  boxes: [
    box(0, -0.5, 0, 50, 1, 50, '#f4c2d7'),
    box(0, 2.5, -25.5, 52, 5, 1, C.wall), box(0, 2.5, 25.5, 52, 5, 1, C.wall),
    box(-25.5, 2.5, 0, 1, 5, 52, C.wall), box(25.5, 2.5, 0, 1, 5, 52, C.wall),
    // cinta central elevada con rampas a ambos lados
    box(0, 2.5, 0, 4, 0.4, 30, C.belt),
    box(0, 1.2, 17.5, 4, 0.4, 6, C.belt, { rx: 0.42 }),
    box(0, 1.2, -17.5, 4, 0.4, 6, C.belt, { rx: -0.42 }),
    // tanques de chocolate
    box(-10, 1.5, 0, 4, 3, 4, C.choc), box(10, 1.5, 0, 4, 3, 4, C.choc),
    box(-10, 1.5, -12, 4, 3, 4, C.choc), box(10, 1.5, 12, 4, 3, 4, C.choc),
    // caramelos gigantes (cobertura baja)
    box(-16, 0.6, 8, 1.2, 1.2, 1.2, C.candy), box(16, 0.6, -8, 1.2, 1.2, 1.2, C.candy),
    box(-6, 0.6, 20, 1.2, 1.2, 1.2, C.mint), box(6, 0.6, -20, 1.2, 1.2, 1.2, C.mint),
    // sitios
    box(-17, 0.05, -17, 10, 0.1, 10, C.siteA, { solid: false }),
    box(17, 0.05, -17, 10, 0.1, 10, C.siteB, { solid: false }),
    box(-12, 1, -20, 1, 2, 8, C.wall), box(12, 1, -20, 1, 2, 8, C.wall),
  ],
  spawns: {
    A: line([[-4, 0, -22, Math.PI], [-2, 0, -22, Math.PI], [0, 0, -23, Math.PI], [2, 0, -22, Math.PI], [4, 0, -22, Math.PI]]),
    B: line([[-4, 0, 22, 0], [-2, 0, 22, 0], [0, 0, 23, 0], [2, 0, 22, 0], [4, 0, 22, 0]]),
    FFA: line([[-4, 0, -22, Math.PI], [4, 0, 22, 0], [-20, 0, 0, Math.PI / 2], [20, 0, 0, -Math.PI / 2], [-17, 0, -17, Math.PI], [17, 0, -17, Math.PI], [0, 0, 10, 0], [0, 0, -10, Math.PI]]),
  },
  bombsites: { A: { x: -17, y: 1, z: -17, sx: 10, sy: 4, sz: 10 }, B: { x: 17, y: 1, z: -17, sx: 10, sy: 4, sz: 10 } },
  buyzones: { A: { x: 0, y: 1, z: -22, sx: 16, sy: 4, sz: 7 }, B: { x: 0, y: 1, z: 22, sx: 16, sy: 4, sz: 7 } },
};
