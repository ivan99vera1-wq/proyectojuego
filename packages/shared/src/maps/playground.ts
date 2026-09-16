import type { MapLayout, MapBox, MapProp, SpawnPoint } from './types.js';

/**
 * Paleta del mapa. Muros claros para que la arena se sienta abierta, y colores
 * saturados solo en lo que el jugador debe leer rápido: rampas, plataformas y
 * zonas de bomba.
 */
const C = {
  grass: '#7cc96a', grassDark: '#63b457', grassLight: '#93d97f',
  wall: '#ccd8ee', wallInner: '#a7b6d6', trim: '#8493b5',
  crate: '#d9a066', crateDark: '#b9793f',
  ramp: '#7fb2ff', platform: '#ffd257', slide: '#ff8f5e', rail: '#ff5c7a',
  sand: '#f2e0b0', path: '#e3d2a8',
  siteA: '#ff7a3a', siteB: '#3a8dff',
};

const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra: Partial<MapBox> = {}): MapBox =>
  ({ x, y, z, sx, sy, sz, color, ...extra });

const line = (points: [number, number, number, number][]): SpawnPoint[] =>
  points.map(([x, y, z, yaw]) => ({ x, y, z, yaw }));

/** Decorado plano sobre el césped: no colisiona ni proyecta sombra. */
const patch = (x: number, z: number, sx: number, sz: number, color: string): MapBox =>
  ({ x, y: 0.02, z, sx, sy: 0.04, sz, color, solid: false });

/**
 * Los adornos van SIEMPRE fuera de los muros o muy por encima de ellos.
 * Un árbol dentro de la arena parecería cobertura y no lo es: engañaría al
 * jugador. Fuera, solo aportan fondo y escala.
 */
function scenery(): MapProp[] {
  const props: MapProp[] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.2;
    const r = 37 + ((i * 7) % 9);
    props.push({
      kind: 'tree',
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      scale: 1.5 + ((i * 3) % 5) * 0.28,
      rot: a,
      color: i % 3 === 0 ? '#3f8c46' : i % 3 === 1 ? '#57a851' : '#6cb75a',
    });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.6;
    const r = 33.5 + ((i * 5) % 3);
    props.push({ kind: i % 4 === 0 ? 'rock' : 'bush', x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 0.9 + (i % 3) * 0.3, rot: a });
  }
  // Farolas en las cuatro esquinas, por fuera del muro.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      props.push({ kind: 'lamp', x: sx * 32.5, z: sz * 32.5, scale: 1.4 });
    }
  }
  // Nubes y globos: dan altura al cielo sin tocar la jugabilidad.
  const clouds: [number, number, number, number][] = [
    [-30, 30, -20, 1.5], [18, 34, -34, 1.2], [36, 28, 12, 1.7],
    [-12, 38, 26, 1.3], [8, 31, 30, 1.1], [-38, 33, 6, 1.4],
  ];
  for (const [x, y, z, s] of clouds) props.push({ kind: 'cloud', x, y, z, scale: s });
  for (const [x, z, color] of [[-20, -22, '#ff7a3a'], [20, -22, '#3a8dff'], [0, 26, '#ffd23f']] as const) {
    props.push({ kind: 'balloon', x, y: 5.4, z, scale: 1.6, color });
  }
  return props;
}

/**
 * "Patio de Juegos": arena 60x60 con tres rutas (tobogán oeste, arenero central,
 * columpios este). Equipo A (Guardianes) al norte (z-), equipo B (Saboteadores) al sur (z+).
 * Sitio A al noroeste, sitio B al noreste.
 */
export const PLAYGROUND: MapLayout = {
  id: 'playground',
  floorColor: C.grass,
  killY: -10,
  boxes: [
    // suelo
    box(0, -0.5, 0, 60, 1, 60, C.grass),
    // muros exteriores (con cornisa decorativa arriba)
    box(0, 2, -30.5, 62, 4, 1, C.wall),
    box(0, 2, 30.5, 62, 4, 1, C.wall),
    box(-30.5, 2, 0, 1, 4, 62, C.wall),
    box(30.5, 2, 0, 1, 4, 62, C.wall),
    box(0, 4.15, -30.5, 62.6, 0.4, 1.5, C.trim, { solid: false }),
    box(0, 4.15, 30.5, 62.6, 0.4, 1.5, C.trim, { solid: false }),
    box(-30.5, 4.15, 0, 1.5, 0.4, 62.6, C.trim, { solid: false }),
    box(30.5, 4.15, 0, 1.5, 0.4, 62.6, C.trim, { solid: false }),

    // ---- decorado del suelo: parches y caminos (sin colisión) ----
    patch(0, 0, 15, 15, C.sand),
    patch(0, -22, 52, 7, C.path),
    patch(0, 22, 46, 6, C.path),
    patch(-24, 0, 7, 40, C.path),
    patch(24, 0, 7, 40, C.path),
    patch(-20, -22, 11, 11, C.siteA),
    patch(20, -22, 11, 11, C.siteB),
    patch(-13, 9, 9, 7, C.grassDark),
    patch(11, -8, 8, 9, C.grassLight),
    patch(16, 16, 10, 8, C.grassDark),
    patch(-17, 17, 9, 9, C.grassLight),

    // ---- zona central: arenero con cajas ----
    box(-3, 0.75, -2, 1.5, 1.5, 1.5, C.crate),
    box(3, 0.75, 2, 1.5, 1.5, 1.5, C.crate),
    box(3, 2.25, 2, 1.5, 1.5, 1.5, C.crate),
    box(0, 0.75, 5, 3, 1.5, 1.5, C.crate),
    box(0, 0.75, -5, 3, 1.5, 1.5, C.crate),
    box(-6, 1, 0, 1, 2, 6, C.wallInner),
    box(6, 1, 0, 1, 2, 6, C.wallInner),

    // ---- ruta oeste: tobogán (rampa larga) hacia sitio A ----
    box(-20, 1.5, 4, 6, 3, 1, C.wallInner),
    box(-20, 0.9, -4, 6, 0.4, 9, C.ramp, { rx: -0.35 }),
    box(-20, 2.4, -10, 6, 0.4, 4, C.platform),
    box(-23, 3.4, -10, 0.4, 1.6, 4, C.slide),
    box(-17, 3.4, -10, 0.4, 1.6, 4, C.slide),

    // ---- ruta este: columpios (postes) hacia sitio B ----
    box(20, 2, -2, 0.4, 4, 0.4, C.trim),
    box(20, 2, 2, 0.4, 4, 0.4, C.trim),
    box(20, 4.1, 0, 0.4, 0.4, 4.4, C.trim),
    box(24, 1, 6, 4, 2, 1, C.wallInner),
    box(16, 1, -6, 4, 2, 1, C.wallInner),
    box(22, 0.75, -12, 1.5, 1.5, 1.5, C.crate),
    box(18, 0.75, -14, 1.5, 1.5, 1.5, C.crate),

    // ---- sitio A (noroeste) ----
    box(-15, 1, -18, 1, 2, 8, C.wallInner),
    box(-24, 0.75, -24, 1.5, 1.5, 1.5, C.crate),

    // ---- sitio B (noreste) ----
    box(15, 1, -18, 1, 2, 8, C.wallInner),
    box(24, 0.75, -24, 1.5, 1.5, 1.5, C.crate),
    box(24, 2.25, -24, 1.5, 1.5, 1.5, C.crate),

    // ---- pasillos medios / cobertura ----
    box(-10, 1, -12, 8, 2, 1, C.wallInner),
    box(10, 1, -12, 8, 2, 1, C.wallInner),
    box(-10, 1, 12, 8, 2, 1, C.wallInner),
    box(10, 1, 12, 8, 2, 1, C.wallInner),
    box(0, 1, 20, 12, 2, 1, C.wallInner),
    box(0, 1, -20, 1, 2, 8, C.wallInner),

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
  props: scenery(),
};
