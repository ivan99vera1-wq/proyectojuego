import type { MapLayout, SpawnPoint } from './types.js';
import { MapBuilder, PALETTE } from './kit.js';

/**
 * =====================================================================
 *  FÁBRICA DE DULCES — nave 80 x 80 con dos sitios de bomba
 * =====================================================================
 *  Interior industrial de caramelo: una nave central con cintas
 *  transportadoras elevadas, silos de chocolate al oeste (sitio A) y la
 *  sala de empaquetado al este (sitio B). Alrededor de la nave queda un
 *  jardín de golosinas con hierba y arbolado que da aire al recinto.
 *
 *  Igual que en el resto de mapas: lo que estorba está en `boxes`.
 * =====================================================================
 */

export const ARENA_HALF = 40;

const C = {
  floor: '#f4c2d7', floorDark: '#e3a8c4', floorLight: '#ffd9ea',
  wall: '#a35c8f', wallInner: '#c07aa8',
  choc: '#5b3a29', chocLight: '#7a5138',
  belt: '#3d3d5c', beltRail: '#5a5a82',
  candy: '#ff7ab6', mint: '#7de3c4', lemon: '#ffe066', grape: '#b98bff',
  steel: '#9aa6bd', roofA: '#e8593c', roofB: '#3f7fd6',
  grass: '#6fc46a',
};

const m = new MapBuilder({ half: ARENA_HALF, wallHeight: 7 }, 771144);

// --------------------------------------------------------- suelo y perímetro
m.box(0, -0.5, 0, ARENA_HALF * 2, 1, ARENA_HALF * 2, C.floor);
m.perimeter(C.wall, PALETTE.trim, C.wallInner);

// Jardín perimetral: una banda de césped entre la nave y el muro.
for (const s of [-1, 1]) {
  m.patch(0, s * 33, ARENA_HALF * 2 - 6, 12, C.grass);
  m.patch(s * 33, 0, 12, ARENA_HALF * 2 - 6, C.grass);
}

// ---------------------------------------------- pintura de la nave central
m.patch(0, 0, 44, 44, C.floorLight);
m.patch(0, 0, 8, 54, C.floorDark);
m.patch(0, 24, 54, 8, C.floorDark);
m.patch(-24, -18, 18, 18, PALETTE.siteA);
m.patch(24, -18, 18, 18, PALETTE.siteB);
m.patch(0, -34, 24, 8, PALETTE.concreteDark);
m.patch(0, 34, 24, 8, PALETTE.concreteDark);

// ------------------------------------- cinta central elevada y sus pasarelas
m.box(0, 3.0, 0, 5, 0.5, 34, C.belt);
for (const sx of [-1, 1]) m.box(sx * 2.7, 3.45, 0, 0.35, 0.8, 34, C.beltRail);
for (let z = -15; z <= 15; z += 5) {
  m.box(0, 1.5, z, 0.7, 3.0, 0.7, C.steel);           // pilares de la cinta
  m.box(0, 3.35, z, 5.4, 0.25, 0.9, C.steel, { solid: false });
}
m.rampZ(0, 19.6, 5, 4.2, 3.0, C.beltRail);
m.rampZ(0, -19.6, 5, -4.2, 3.0, C.beltRail);
// Cajas que "caen" de la cinta: cobertura bajo la pasarela.
m.crateStack(-3.4, 8, 2, 1.5, 0.3, C.candy, C.mint);
m.crateStack(3.6, -6, 2, 1.5, -0.4, C.lemon, C.grape);
m.crateStack(-3.2, -13, 1, 1.6, 0.8, C.mint, C.candy);

// ------------------------------- sitio A (oeste): silos y sala de mezclado
for (const [x, z, r] of [[-27, -22, 3.0], [-20, -25, 2.4], [-30, -14, 2.6]] as const) {
  m.box(x, 3.0, z, r * 2, 6.0, r * 2, C.choc);
  m.box(x, 6.3, z, r * 2 + 0.6, 0.6, r * 2 + 0.6, C.chocLight);
  m.box(x, 7.0, z, r * 1.1, 0.8, r * 1.1, C.steel, { solid: false });
}
m.box(-24, 1.0, -30, 16, 2.0, 6, PALETTE.concrete);     // andén de carga
m.rampZ(-24, -25.0, 7, 4.0, 2.0);
m.shed(-33, -32, 6, 6, 3.4, C.roofA, 'south', C.wallInner);
m.container(-16, 0, -16, 0.2, '#d94f3d');
m.crateStack(-28, -17, 3, 1.6, 0.2, C.candy, C.mint);
m.crateStack(-19, -20, 2, 1.6, -0.3, C.lemon, C.grape);
m.sandbags(-17, -12, 8, 'x');
m.siteSign(-24, -10.5, PALETTE.siteA);
m.wallRun('x', -32.5, -38, -12, 3.4, C.wallInner, [[-23, -19]]);
m.wallRun('z', -13, -34, -12, 3.0, C.wallInner, [[-30, -26], [-20, -16]]);

// ---------------------------- sitio B (este): empaquetado, torreta y prensas
m.box(24, 1.0, -28, 16, 2.0, 7, PALETTE.concrete);
m.rampZ(24, -22.5, 7, 4.2, 2.0);
for (const [x, z] of [[18, -24], [30, -24]] as const) {
  m.box(x, 2.2, z, 4.4, 4.4, 4.4, C.steel);             // prensas de caramelo
  m.box(x, 4.7, z, 5.0, 0.6, 5.0, C.beltRail);
  m.box(x, 5.4, z, 1.2, 0.8, 1.2, C.candy, { solid: false });
}
m.container(16, 0, -15, -0.2, '#2f77c9');
m.container(18, 2.8, -15.6, -0.2, '#e0b13c');
m.tower(31, -13, 4.4, C.roofB);
m.crateStack(26, -18, 3, 1.6, -0.25, C.mint, C.lemon);
m.crateStack(21, -31, 2, 1.6, 0.35, C.grape, C.candy);
m.sandbags(17, -11, 8, 'x');
m.siteSign(24, -9.5, PALETTE.siteB);
m.wallRun('x', 32.5, 12, 38, 3.4, C.wallInner, [[19, 23]]);
m.wallRun('z', 13, -34, -12, 3.0, C.wallInner, [[-30, -26], [-20, -16]]);

// ---------------------------------------- rutas laterales y patio de golosinas
for (const s of [-1, 1]) {
  m.wallRun('z', s * 13, 4, 28, 3.0, C.wallInner, [[10, 15], [22, 26]]);
  m.box(s * 26, 1.1, 10, 8, 2.2, 1, C.wallInner);
  m.box(s * 30, 1.1, 22, 1, 2.2, 8, C.wallInner);
  m.crateStack(s * 20, 18, 2, 1.6, s * 0.4, C.candy, C.lemon);
  m.crateStack(s * 34, 4, 1, 1.7, -s * 0.3, C.mint, C.grape);
  m.sandbags(s * 22, 28, 7, 'x');
  // Piruletas gigantes: volumen alto y muy legible en silueta.
  for (const z of [6, 20]) {
    m.box(s * 33, 2.0, z, 0.5, 4.0, 0.5, '#ffffff');
    m.box(s * 33, 4.6, z, 2.6, 2.6, 0.7, z === 6 ? C.candy : C.mint);
  }
  m.planter(s * 36, -6, 1.8, '#3f8c46');
  m.planter(s * 20, 34, 1.7, '#57a851');
}

// ------------------------------------------------------- bases de cada equipo
m.spawnShelter(-34, C.roofA, PALETTE.siteA, C.wallInner);
m.spawnShelter(34, C.roofB, PALETTE.siteB, C.wallInner);

// ------------------------------------------------------------- decoración
m.scatterGreenery(260, ['#ff7ab6', '#7de3c4', '#ffe066', '#b98bff']);
m.scatterOutskirts(34, 20, ['#3f8c46', '#57a851', '#6cb75a']);
m.lamps(1.4);
m.banners(PALETTE.siteA, PALETTE.siteB, 5, 10);
for (const [x, y, z, s] of [[-26, 30, -20, 1.5], [24, 33, 12, 1.7], [2, 28, 30, 1.2],
                            [-30, 31, 22, 1.4], [16, 35, -32, 1.3]] as const) {
  m.prop('cloud', x, z, { y, scale: s });
}
for (const [x, z, color] of [[-24, -30, PALETTE.siteA], [24, -30, PALETTE.siteB],
                             [0, 16, '#ffd23f'], [-12, 30, C.mint], [12, 30, C.candy]] as const) {
  m.prop('balloon', x, z, { y: 7.2, scale: 1.9, color });
}

const line = (points: [number, number, number, number][]): SpawnPoint[] =>
  points.map(([x, y, z, yaw]) => ({ x, y, z, yaw }));

export const CANDY_FACTORY: MapLayout = {
  id: 'candy_factory',
  floorColor: C.floor,
  killY: -10,
  boxes: m.boxes,
  spawns: {
    A: line([[-7, 0, -32, Math.PI], [-3.5, 0, -32, Math.PI], [0, 0, -33, Math.PI],
             [3.5, 0, -32, Math.PI], [7, 0, -32, Math.PI]]),
    B: line([[-7, 0, 32, 0], [-3.5, 0, 32, 0], [0, 0, 33, 0], [3.5, 0, 32, 0], [7, 0, 32, 0]]),
    FFA: line([
      [-7, 0, -32, Math.PI], [7, 0, 32, 0], [-32, 0, 2, Math.PI / 2], [32, 0, 2, -Math.PI / 2],
      [-24, 0, -18, Math.PI], [24, 0, -18, Math.PI], [6, 0, 12, 0], [-6, 0, -10, Math.PI],
      [-20, 0, 24, 0.6], [20, 0, 24, -0.6],
    ]),
  },
  bombsites: {
    A: { x: -24, y: 2, z: -18, sx: 16, sy: 7, sz: 16 },
    B: { x: 24, y: 2, z: -18, sx: 16, sy: 7, sz: 16 },
  },
  buyzones: {
    A: { x: 0, y: 2, z: -32, sx: 26, sy: 7, sz: 10 },
    B: { x: 0, y: 2, z: 32, sx: 26, sy: 7, sz: 10 },
  },
  props: m.props,
};
