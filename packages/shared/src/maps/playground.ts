import type { MapLayout, SpawnPoint } from './types.js';
import { MapBuilder, PALETTE } from './kit.js';

/**
 * =====================================================================
 *  PATIO DE JUEGOS — arena 90 x 90 con dos sitios de bomba
 * =====================================================================
 *  Norte (z-) es el lado de los Guardianes (equipo A) y sur (z+) el de
 *  los Saboteadores (equipo B). Los dos sitios están en la mitad norte,
 *  A al oeste y B al este, y hay tres rutas desde el sur: carril oeste,
 *  plaza central y carril este.
 *
 *  Todo lo que bloquea el paso vive en `boxes`, que es la colisión real
 *  de cliente y servidor. En `props` solo va lo que se atraviesa.
 * =====================================================================
 */

/** Semitamaño de la arena. Los muros exteriores caen justo aquí. */
export const ARENA_HALF = 45;

const C = {
  grass: '#7cc96a', grassDark: '#63b457', grassLight: '#93d97f',
  wall: '#ccd8ee', wallInner: '#a7b6d6',
  roofA: '#e8593c', roofB: '#3f7fd6',
  platform: '#ffd257', rail: '#ff5c7a',
  sand: '#f2e0b0', path: '#e3d2a8',
  containerA: '#d94f3d', containerB: '#2f77c9', containerC: '#e0b13c',
};

const m = new MapBuilder({ half: ARENA_HALF, wallHeight: 6 });

// --------------------------------------------------------- suelo y perímetro
m.box(0, -0.5, 0, ARENA_HALF * 2, 1, ARENA_HALF * 2, C.grass);
m.perimeter(C.wall, PALETTE.trim, C.wallInner);

// ------------------------------------------- pintura del suelo (sin colisión)
m.patch(0, 0, 22, 22, C.sand);
m.patch(0, 34, 60, 9, C.path);
m.patch(0, -34, 60, 9, C.path);
m.patch(-36, 4, 9, 66, C.path);
m.patch(36, 4, 9, 66, C.path);
m.patch(0, 16, 12, 34, C.path);
m.patch(-28, -20, 20, 20, PALETTE.siteA);
m.patch(28, -20, 20, 20, PALETTE.siteB);
m.patch(0, -41, 26, 8, PALETTE.concreteDark);
m.patch(0, 41, 26, 8, PALETTE.concreteDark);
for (const [px, pz, s] of [[-18, 12, 10], [17, -6, 9], [22, 20, 12], [-20, 24, 11],
                           [-8, -14, 8], [12, 30, 9], [-34, -32, 10], [34, 32, 11]] as const) {
  m.patch(px, pz, s, s * 0.8, (px + pz) % 2 ? C.grassDark : C.grassLight);
}

// ------------------------------------------ plaza central: cruce de las rutas
m.box(0, 0.6, 0, 16, 1.2, 16, PALETTE.concrete);
m.rampZ(0, 9.6, 7, 4.2, 1.2);
m.rampZ(0, -9.6, 7, -4.2, 1.2);
m.rampX(-9.6, 0, 7, -4.2, 1.2);
m.rampX(9.6, 0, 7, 4.2, 1.2);
// Torre-reloj: referencia visual desde cualquier punto del mapa.
m.box(0, 4.0, 0, 3.4, 8, 3.4, PALETTE.concrete);
m.box(0, 8.4, 0, 4.4, 0.8, 4.4, PALETTE.trim);
m.box(0, 9.4, 0, 2.6, 1.6, 2.6, C.platform);
m.box(0, 10.6, 0, 1.4, 1.2, 1.4, C.rail);
for (const [cx, cz] of [[-5.4, -5.4], [5.4, -5.4], [-5.4, 5.4], [5.4, 5.4]] as const) {
  m.box(cx, 1.9, cz, 1.4, 2.6, 1.4, C.wallInner);
  m.box(cx, 3.4, cz, 1.8, 0.4, 1.8, PALETTE.trim, { solid: false });
}
m.crateStack(-6.5, 1.5, 2, 1.5, 0.3);
m.crateStack(6.8, -1.8, 1, 1.6, -0.4);
m.sandbags(0, 11.5, 9, 'x');
m.sandbags(0, -11.5, 9, 'x');

// ------------------------- sitio A (oeste-norte): caseta, andén y jardineras
m.box(-28, 1.0, -26, 16, 2.0, 7, PALETTE.concrete);
m.rampZ(-28, -20.5, 8, 4.0, 2.0);
m.rampX(-36.5, -26, 7, -3.8, 2.0);
m.shed(-34, -14, 7, 7, 3.6, C.roofA, 'south');
m.container(-22, 0, -16, 0.22, C.containerA);
m.container(-24, 2.8, -16.6, 0.22, C.containerC);
m.crateStack(-31.5, -20.5, 3, 1.7, 0.25);
m.crateStack(-19.5, -24, 2, 1.7, -0.3);
m.crateStack(-33, -24.5, 1, 1.6, 0.5);
m.sandbags(-20.5, -12, 8, 'x');
m.planter(-38.5, -6, 1.7, '#3f8c46');
m.planter(-17.5, -30, 1.6, '#57a851');
m.siteSign(-28, -12.5, PALETTE.siteA);
m.wallRun('x', -30.5, -41, -15, 3.2, C.wallInner, [[-27, -23]]);

// --------------------- sitio B (este-norte): contenedores, torreta y andén
m.box(28, 0.9, -25, 15, 1.8, 8, PALETTE.concrete);
m.rampZ(28, -19.0, 8, 4.2, 1.8);
m.rampX(36.2, -25, 8, 4.0, 1.8);
m.container(21, 0, -15, -0.18, C.containerB);
m.container(23, 2.8, -15.6, -0.18, C.containerA);
m.container(33, 0, -18.5, 1.32, C.containerC);
m.tower(34, -30, 4.6, C.roofB);
m.crateStack(26, -20, 3, 1.7, -0.22);
m.crateStack(19, -24, 2, 1.6, 0.4);
m.sandbags(21, -11, 8, 'x');
m.planter(38.5, -6, 1.7, '#3f8c46');
m.planter(17.5, -30, 1.6, '#6cb75a');
m.siteSign(28, -11.5, PALETTE.siteB);
m.wallRun('x', 30.5, 15, 41, 3.2, C.wallInner, [[23, 27]]);

// ---------------------------------------- rutas: muros de carril con puertas
m.wallRun('z', -17, -8, 30, 3.0, C.wallInner, [[2, 7], [18, 23]]);
m.wallRun('z', 17, -8, 30, 3.0, C.wallInner, [[2, 7], [18, 23]]);
m.wallRun('x', -6, -41, -20, 3.0, C.wallInner, [[-33, -29]]);
m.wallRun('x', -6, 20, 41, 3.0, C.wallInner, [[29, 33]]);
for (const s of [-1, 1]) {
  m.box(s * 36, 1.0, 22, 7, 2.0, 1, C.wallInner);
  m.box(s * 36, 1.0, 6, 1, 2.0, 7, C.wallInner);
  m.box(s * 30, 1.0, 30, 1, 2.0, 7, C.wallInner);
  m.crateStack(s * 39, 14, 2, 1.6, s * 0.3);
  m.crateStack(s * 33, -2, 1, 1.7, -s * 0.4);
  m.sandbags(s * 36, -8, 7, 'x');
}

// ------------------------------------------------------- bases de cada equipo
m.spawnShelter(-41, C.roofA, PALETTE.siteA, C.wallInner);
m.spawnShelter(41, C.roofB, PALETTE.siteB, C.wallInner);

// ------------------------------------------------------------- vegetación
m.scatterGreenery(420);
m.scatterOutskirts(44, 26, ['#3f8c46', '#57a851', '#6cb75a']);
m.lamps(1.5);
m.banners(PALETTE.siteA, PALETTE.siteB);
for (const [x, y, z, s] of [[-34, 34, -24, 1.9], [20, 38, -38, 1.5], [40, 32, 14, 2.1],
                            [-14, 42, 30, 1.6], [10, 35, 36, 1.4], [-42, 37, 6, 1.7],
                            [4, 40, -6, 1.3], [-26, 33, 18, 1.5]] as const) {
  m.prop('cloud', x, z, { y, scale: s });
}
for (const [x, z, color] of [[-28, -30, PALETTE.siteA], [28, -30, PALETTE.siteB], [0, 20, '#ffd23f'],
                             [-38, 30, '#7ee081'], [38, 30, '#ff7a9c']] as const) {
  m.prop('balloon', x, z, { y: 6.4, scale: 1.8, color });
}

const line = (points: [number, number, number, number][]): SpawnPoint[] =>
  points.map(([x, y, z, yaw]) => ({ x, y, z, yaw }));

export const PLAYGROUND: MapLayout = {
  id: 'playground',
  floorColor: C.grass,
  killY: -10,
  boxes: m.boxes,
  spawns: {
    A: line([[-8, 0, -39, Math.PI], [-4, 0, -39, Math.PI], [0, 0, -40, Math.PI],
             [4, 0, -39, Math.PI], [8, 0, -39, Math.PI]]),
    B: line([[-8, 0, 39, 0], [-4, 0, 39, 0], [0, 0, 40, 0], [4, 0, 39, 0], [8, 0, 39, 0]]),
    // Verificados por `maps.test.ts` (y por `npm run check:map`): cada punto
    // tiene que estar libre de geometría y poder andar hacia delante un segundo
    // entero sin chocar. Los dos del centro-norte estaban dentro de una pila de
    // cajas y de la rampa del sitio A, y quien apareciera allí no podía moverse.
    FFA: line([
      [-8, 0, -39, Math.PI], [8, 0, 39, 0], [-36, 0, 0, Math.PI / 2], [36, 0, 0, -Math.PI / 2],
      [-22, 0, -22, -Math.PI / 2], [20, 0, -20, Math.PI / 2], [0, 0, 14, Math.PI / 2], [-20, 0, 26, 0.5],
      [22, 0, -38, Math.PI], [0, 0, -14, 0], [-36, 0, 26, 0.8], [39, 0, -24, Math.PI],
    ]),
  },
  bombsites: {
    A: { x: -28, y: 2, z: -20, sx: 18, sy: 7, sz: 18 },
    B: { x: 28, y: 2, z: -20, sx: 18, sy: 7, sz: 18 },
  },
  buyzones: {
    A: { x: 0, y: 2, z: -39, sx: 28, sy: 7, sz: 11 },
    B: { x: 0, y: 2, z: 39, sx: 28, sy: 7, sz: 11 },
  },
  props: m.props,
};
