import type { MapBox, MapProp, MapPropKind } from './types.js';

/**
 * =====================================================================
 *  KIT DE CONSTRUCCIÓN DE MAPAS
 * =====================================================================
 *  Un mapa se describe con piezas de arquitectura (muros con puertas,
 *  casetas, contenedores, andenes, torretas, jardineras) en vez de con
 *  cajas sueltas. Así un mapa se lee, se corrige y se amplía sin tener
 *  que recalcular a mano las coordenadas de cada bloque.
 *
 *  Regla que no se rompe: TODO lo que estorba el paso entra en `boxes`,
 *  porque esas cajas son la colisión real en cliente y servidor. Lo que
 *  va en `props` se atraviesa siempre.
 * =====================================================================
 */

/** Paleta común a todos los mapas. Cada mapa puede añadir la suya encima. */
export const PALETTE = {
  concrete: '#c9cfd9', concreteDark: '#9aa3b2', trim: '#8493b5',
  metal: '#7f8aa0', crate: '#d9a066', crateDark: '#b9793f',
  sandbag: '#c9b083', sandbagDark: '#b8a075',
  ramp: '#7fb2ff', dirt: '#6b4b2f',
  siteA: '#ff7a3a', siteB: '#3a8dff',
} as const;

export interface BuilderOptions {
  /** Semitamaño de la arena (los muros exteriores caen justo aquí). */
  half: number;
  /** Altura de los muros exteriores. */
  wallHeight: number;
}

export class MapBuilder {
  readonly boxes: MapBox[] = [];
  readonly props: MapProp[] = [];
  readonly half: number;
  readonly wallHeight: number;
  /** Ruido determinista: el mismo mapa en cliente y en servidor. */
  private seed: number;

  constructor(options: BuilderOptions, seed = 20260918) {
    this.half = options.half;
    this.wallHeight = options.wallHeight;
    this.seed = seed;
  }

  /** Número pseudoaleatorio reproducible en [0, 1). */
  random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  box(x: number, y: number, z: number, sx: number, sy: number, sz: number,
      color: string, extra: Partial<MapBox> = {}): MapBox {
    const b: MapBox = { x, y, z, sx, sy, sz, color, ...extra };
    this.boxes.push(b);
    return b;
  }

  /** Decorado pegado al suelo: se dibuja pero no colisiona. */
  patch(x: number, z: number, sx: number, sz: number, color: string, y = 0.02): MapBox {
    return this.box(x, y, z, sx, 0.04, sz, color, { solid: false });
  }

  prop(kind: MapPropKind, x: number, z: number, extra: Partial<MapProp> = {}): MapProp {
    const p: MapProp = { kind, x, z, ...extra };
    this.props.push(p);
    return p;
  }

  /**
   * Tramo de muro con huecos de paso. Los huecos se dan como pares
   * [desde, hasta] sobre el eje largo: una puerta es un dato, no tres cajas
   * escritas a mano que se descuadran en cuanto se mueve el muro.
   */
  wallRun(axis: 'x' | 'z', fixed: number, from: number, to: number, height: number,
          color: string, gaps: [number, number][] = [], thickness = 1): void {
    const segments: [number, number][] = [];
    let cursor = Math.min(from, to);
    const end = Math.max(from, to);
    for (const [gs, ge] of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (ge <= cursor || gs >= end) continue;
      if (gs > cursor) segments.push([cursor, Math.min(gs, end)]);
      cursor = Math.max(cursor, ge);
    }
    if (cursor < end) segments.push([cursor, end]);
    for (const [a, b] of segments) {
      const len = b - a;
      if (len < 0.05) continue;
      const mid = (a + b) / 2;
      if (axis === 'x') this.box(mid, height / 2, fixed, len, height, thickness, color);
      else this.box(fixed, height / 2, mid, thickness, height, len, color);
    }
  }

  /** Muros exteriores con cornisa y contrafuertes. */
  perimeter(wallColor: string, trimColor: string, innerColor: string): void {
    const h = this.wallHeight;
    const e = this.half + 0.5;
    const span = this.half * 2 + 2;
    for (const s of [-1, 1]) {
      this.box(0, h / 2, s * e, span, h, 1, wallColor);
      this.box(s * e, h / 2, 0, 1, h, span, wallColor);
      this.box(0, h + 0.25, s * e, span + 0.6, 0.5, 1.6, trimColor, { solid: false });
      this.box(s * e, h + 0.25, 0, 1.6, 0.5, span + 0.6, trimColor, { solid: false });
    }
    // Contrafuertes: rompen decenas de metros de muro liso.
    const step = 10;
    for (let i = -Math.floor(this.half / step); i <= Math.floor(this.half / step); i++) {
      if (i === 0) continue;
      for (const s of [-1, 1]) {
        this.box(i * step, h * 0.4, s * (this.half - 0.4), 1.6, h * 0.8, 1.2, innerColor);
        this.box(s * (this.half - 0.4), h * 0.4, i * step, 1.2, h * 0.8, 1.6, innerColor);
      }
    }
  }

  /** Pila de cajas. Cada capa gira un poco para que no se lea repetida. */
  crateStack(x: number, z: number, n: number, size = 1.6, rot = 0,
             a: string = PALETTE.crate, b: string = PALETTE.crateDark): void {
    for (let i = 0; i < n; i++) {
      const s = size * (1 - i * 0.06);
      this.box(x + i * 0.08, size * (i + 0.5), z - i * 0.06, s, size, s,
               i % 2 ? b : a, { ry: rot + i * 0.12 });
    }
  }

  /** Contenedor de carga con nervios: el volumen grande que ancla un sitio. */
  container(x: number, y: number, z: number, rot: number, color: string): void {
    this.box(x, y + 1.4, z, 6.4, 2.8, 2.6, color, { ry: rot });
    for (const d of [-2.4, -0.8, 0.8, 2.4]) {
      this.box(x + Math.cos(rot) * d, y + 1.4, z - Math.sin(rot) * d,
               0.5, 2.6, 2.75, PALETTE.metal, { ry: rot, solid: false });
    }
    this.box(x, y + 2.9, z, 6.5, 0.2, 2.7, PALETTE.metal, { ry: rot, solid: false });
  }

  /** Caseta con puerta y tejado a dos aguas. */
  shed(x: number, z: number, w: number, d: number, h: number, roof: string,
       doorSide: 'north' | 'south', wall: string = PALETTE.concrete): void {
    const t = 0.5;
    this.box(x - w / 2, h / 2, z, t, h, d, wall);
    this.box(x + w / 2, h / 2, z, t, h, d, wall);
    const back = doorSide === 'north' ? z + d / 2 : z - d / 2;
    const front = doorSide === 'north' ? z - d / 2 : z + d / 2;
    this.box(x, h / 2, back, w + t, h, t, wall);
    this.box(x - w * 0.34, h / 2, front, w * 0.32, h, t, wall);
    this.box(x + w * 0.34, h / 2, front, w * 0.32, h, t, wall);
    this.box(x, h - 0.5, front, w * 0.36, 1, t, wall);
    this.box(x - w * 0.26, h + 0.55, z, w * 0.62, 0.35, d + 1.2, roof, { rz: 0.42 });
    this.box(x + w * 0.26, h + 0.55, z, w * 0.62, 0.35, d + 1.2, roof, { rz: -0.42 });
    this.box(x, h + 1.15, z, 0.4, 0.4, d + 1.3, PALETTE.trim, { solid: false });
  }

  /** Jardinera de obra con un árbol encima. El conjunto sí tapa de verdad. */
  planter(x: number, z: number, r: number, treeColor: string, wall: string = PALETTE.concreteDark): void {
    this.box(x, 0.45, z, r * 2, 0.9, r * 2, wall);
    this.patch(x, z, r * 1.7, r * 1.7, PALETTE.dirt, 0.92);
    this.prop('tree', x, z, { y: 0.9, scale: 1.5, rot: x * 0.7, color: treeColor });
  }

  /** Barrera de sacos terreros: cobertura baja que se salta de un brinco. */
  sandbags(x: number, z: number, len: number, axis: 'x' | 'z'): void {
    const n = Math.max(2, Math.round(len / 1.4));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const px = axis === 'x' ? x + t * len : x;
      const pz = axis === 'z' ? z + t * len : z;
      this.box(px, 0.35, pz, axis === 'x' ? 1.4 : 1.2, 0.7, axis === 'z' ? 1.4 : 1.2,
               i % 2 ? PALETTE.sandbag : PALETTE.sandbagDark, { ry: i * 0.18 });
      this.box(px + 0.1, 0.95, pz - 0.05, axis === 'x' ? 1.2 : 1.0, 0.55, axis === 'z' ? 1.2 : 1.0,
               i % 2 ? PALETTE.sandbagDark : PALETTE.sandbag, { ry: -i * 0.14 });
    }
  }

  /** Torreta con patas, plataforma, barandilla y rampa de acceso. */
  tower(x: number, z: number, h: number, color: string): void {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) this.box(x + sx * 1.9, h / 2, z + sz * 1.9, 0.45, h, 0.45, PALETTE.metal);
    }
    this.box(x, h * 0.5, z, 4.6, 0.3, 0.3, PALETTE.metal, { solid: false });
    this.box(x, h + 0.2, z, 5.2, 0.4, 5.2, PALETTE.concrete);
    for (const sx of [-1, 1]) this.box(x + sx * 2.5, h + 1.0, z, 0.25, 1.2, 5.2, color);
    this.box(x, h + 1.0, z - 2.5, 5.2, 1.2, 0.25, color);
    this.box(x + 3.6, h * 0.5, z + 3.6, 3.0, 0.4, 7.4, PALETTE.ramp, { rx: -0.52, ry: -0.78 });
  }

  /** Rampa recta a lo largo de Z. `rise` es cuánto sube en `len` metros. */
  rampZ(x: number, z: number, w: number, len: number, rise: number, color: string = PALETTE.ramp): void {
    this.box(x, rise / 2, z, w, 0.4, Math.hypot(len, rise), color, { rx: Math.atan2(rise, len) });
  }

  /** Rampa recta a lo largo de X. */
  rampX(x: number, z: number, d: number, len: number, rise: number, color: string = PALETTE.ramp): void {
    this.box(x, rise / 2, z, Math.hypot(len, rise), 0.4, d, color, { rz: -Math.atan2(rise, len) });
  }

  /** Cartel de sitio: plinto, poste y placa de color con la letra. */
  siteSign(x: number, z: number, color: string, facing = -1): void {
    this.box(x, 0.3, z, 1.6, 0.6, 1.6, PALETTE.concreteDark);
    this.box(x, 2.1, z, 0.35, 3.0, 0.35, PALETTE.trim);
    this.box(x, 4.0, z, 2.6, 2.0, 0.3, color);
    this.box(x, 4.0, z + facing * 0.2, 2.2, 1.6, 0.1, '#ffffff', { solid: false });
  }

  /** Cobertizo de salida de un equipo: columnas, techo y muros laterales. */
  spawnShelter(z: number, roof: string, sign: string, innerColor: string): void {
    const dir = Math.sign(z) || 1;
    this.box(0, 3.4, z + dir * 3, 26, 0.6, 1.2, roof, { solid: false });
    for (const x of [-12, -6, 0, 6, 12]) this.box(x, 1.7, z + dir * 3, 0.6, 3.4, 0.6, PALETTE.trim);
    this.box(-13.5, 1.6, z, 1, 3.2, 8, innerColor);
    this.box(13.5, 1.6, z, 1, 3.2, 8, innerColor);
    this.box(0, 1.6, z + dir * 4.4, 8, 3.2, 1, innerColor);
    this.crateStack(-10, z - dir * 4, 2, 1.6, 0.2);
    this.crateStack(10, z - dir * 4, 1, 1.7, -0.2);
    this.box(0, 2.6, z + dir * 4.9, 5, 1.6, 0.25, sign, { solid: false });
  }

  /** ¿Sobresale algo del suelo en este punto? Sirve para no sembrar encima. */
  onStructure(x: number, z: number, margin = 0.6): boolean {
    return this.boxes.some((b) => b.solid !== false
      // El suelo es una caja enorme: solo cuenta lo que asoma por encima.
      && b.y + b.sy / 2 > 0.25
      && Math.abs(x - b.x) < b.sx / 2 + margin && Math.abs(z - b.z) < b.sz / 2 + margin);
  }

  /**
   * Siembra hierba, flores y matojos por el suelo libre. Es lo que quita al
   * mapa el aspecto de maqueta gris sin tocar ni una colisión.
   */
  scatterGreenery(count: number, colors: string[] = ['#ffe066', '#ff7a9c', '#ffffff', '#b98bff']): void {
    for (let i = 0; i < count; i++) {
      const x = (this.random() * 2 - 1) * (this.half - 1.5);
      const z = (this.random() * 2 - 1) * (this.half - 1.5);
      if (this.onStructure(x, z)) continue;
      const roll = this.random();
      if (roll < 0.72) this.prop('grass', x, z, { scale: 0.7 + this.random() * 0.7, rot: this.random() * 6.28 });
      else if (roll < 0.9) {
        this.prop('flower', x, z, {
          scale: 0.7 + this.random() * 0.5, rot: this.random() * 6.28,
          color: colors[Math.floor(this.random() * colors.length)],
        });
      } else this.prop('bush', x, z, { scale: 0.6 + this.random() * 0.5, rot: this.random() * 6.28 });
    }
  }

  /** Arbolado, rocas y matorral por FUERA del muro: fondo y escala, no cobertura. */
  scatterOutskirts(trees: number, scrub: number, palette: string[]): void {
    for (let i = 0; i < trees; i++) {
      const a = (i / trees) * Math.PI * 2 + 0.2;
      const r = this.half + 6 + ((i * 7) % 11);
      this.prop('tree', Math.cos(a) * r, Math.sin(a) * r, {
        scale: 1.6 + ((i * 3) % 5) * 0.34, rot: a, color: palette[i % palette.length],
      });
    }
    for (let i = 0; i < scrub; i++) {
      const a = (i / scrub) * Math.PI * 2 + 0.6;
      const r = this.half + 2.5 + ((i * 5) % 3);
      this.prop(i % 4 === 0 ? 'rock' : 'bush', Math.cos(a) * r, Math.sin(a) * r,
                { scale: 1.0 + (i % 3) * 0.35, rot: a });
    }
  }

  /** Banderolas colgadas de los muros norte y sur, con el color de cada lado. */
  banners(colorNorth: string, colorSouth: string, count = 7, spacing = 9): void {
    const k = Math.floor(count / 2);
    for (let i = -k; i <= k; i++) {
      this.prop('banner', i * spacing, -this.half + 0.6, { y: 4.6, scale: 1.2, color: colorNorth });
      this.prop('banner', i * spacing, this.half - 0.6, { y: 4.6, scale: 1.2, color: colorSouth, rot: Math.PI });
    }
  }

  /** Farolas en las esquinas y a media pared. */
  lamps(scale = 1.5): void {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.prop('lamp', sx * (this.half - 2), sz * (this.half - 2), { scale });
        this.prop('lamp', sx * (this.half * 0.45), sz * (this.half - 2), { scale: scale * 0.9 });
      }
    }
  }
}
