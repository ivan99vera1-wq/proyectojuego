import * as THREE from 'three';
import { PALETTE, type MapLayout, type MapProp, type MapZone } from '@game/shared';
import { BRANDING, type MapDefinition } from '@game/config';
import { mapModelGroup } from '../character/glb.js';

/**
 * =====================================================================
 *  RENDERIZADO DEL MAPA
 * =====================================================================
 *  Dibuja un MapLayout. La geometría de juego son las cajas del layout,
 *  las mismas que usa el servidor para las colisiones, así que lo que se
 *  ve y contra lo que se choca nunca se separan.
 *
 *  Lo que añade este módulo es presentación: cielo en degradado,
 *  sombreado por cara horneado en las cajas, marcas de zona legibles y
 *  adornos sin colisión (árboles, nubes, farolas, banderas).
 * =====================================================================
 */

/**
 * El shader del cielo escribe directamente en el búfer final: no pasa por la
 * conversión de espacio de color que sí aplican los materiales de Three. Por
 * eso los colores se entregan tal cual (sRGB) y no convertidos a lineal.
 */
const skyColor = (hex: string): THREE.Color => new THREE.Color(hex);

/**
 * Cielo en degradado. Un color plano deja el horizonte muerto; con cenit y
 * horizonte distintos el mapa gana profundidad de inmediato.
 */
function buildSky(def: MapDefinition): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: skyColor(def.skyTop ?? def.skyColor) },
      horizonColor: { value: skyColor(def.skyHorizon ?? def.skyColor) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        gl_FragColor = vec4(mix(horizonColor, topColor, smoothstep(-0.10, 0.80, h)), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), material);
  sky.name = 'sky';
  sky.renderOrder = -1;
  return sky;
}

/**
 * Caja con sombreado por cara horneado en los vértices: arriba clara, laterales
 * intermedios y base oscura. Es lo que da volumen a un mapa hecho de cajas sin
 * coste alguno de dibujo, y no depende de la dirección del sol.
 */
function shadedBoxGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const normal = geo.getAttribute('normal');
  const colors = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const ny = normal.getY(i);
    const nx = Math.abs(normal.getX(i));
    let v = 0.86;
    if (ny > 0.5) v = 1.0;
    else if (ny < -0.5) v = 0.52;
    else if (nx > 0.5) v = 0.76;
    colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Cartel con la letra de la zona, para leer el sitio de un vistazo. */
function zoneLabel(letter: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(letter, 64, 68);
  ctx.fillStyle = color;
  ctx.fillText(letter, 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, fog: false }));
  sprite.scale.set(1.6, 1.6, 1);
  return sprite;
}

/** Marca de zona de bomba: losa translúcida, postes en las esquinas y letra. */
function buildZone(z: MapZone, color: string, letter: string): THREE.Group {
  const g = new THREE.Group();
  g.name = `zone_${letter}`;
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(Math.min(z.sx, z.sz) * 0.46, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(z.x, 0.06, z.z);
  g.add(pad);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.min(z.sx, z.sz) * 0.44, Math.min(z.sx, z.sz) * 0.48, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(z.x, 0.07, z.z);
  g.add(ring);

  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.3, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: '#f4f6fa', roughness: 0.7 });
  const capMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(z.x + sx * z.sx * 0.42, 0.65, z.z + sz * z.sz * 0.42);
      post.castShadow = true;
      g.add(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), capMat);
      cap.position.set(post.position.x, 1.36, post.position.z);
      g.add(cap);
    }
  }
  const label = zoneLabel(letter, color);
  label.position.set(z.x, 2.2, z.z);
  g.add(label);
  return g;
}

// ------------------------------------------------------------ adornos

/**
 * Escala: el personaje mide 1,20 m, así que una mata de hierba pasa de 0,30 m
 * y una flor de 0,25 m solo si se quiere que el mapa parezca una jungla. Las
 * medidas de aquí tienen que coincidir con `assets/blender/lib/mapbuild.py`.
 *
 * La hierba y las flores se repiten cientos de veces. Crear geometría y
 * material por adorno dispararía la memoria y las llamadas de dibujo, así que
 * aquí se comparten y cada adorno solo aporta su transformación.
 */
const shared = {
  blade: null as THREE.BufferGeometry | null,
  stem: null as THREE.BufferGeometry | null,
  petal: null as THREE.BufferGeometry | null,
  grassMat: null as THREE.MeshStandardMaterial | null,
  stemMat: null as THREE.MeshStandardMaterial | null,
  flowerMats: new Map<string, THREE.MeshStandardMaterial>(),
};

const bladeGeo = (): THREE.BufferGeometry =>
  (shared.blade ??= new THREE.ConeGeometry(0.05, 0.30, 4, 1));
const stemGeo = (): THREE.BufferGeometry =>
  (shared.stem ??= new THREE.CylinderGeometry(0.012, 0.016, 0.20, 4));
const petalGeo = (): THREE.BufferGeometry =>
  (shared.petal ??= new THREE.IcosahedronGeometry(0.055, 0));
const grassMat = (): THREE.MeshStandardMaterial =>
  (shared.grassMat ??= new THREE.MeshStandardMaterial({ color: '#5fae4d', roughness: 0.95, flatShading: true }));
const stemMat = (): THREE.MeshStandardMaterial =>
  (shared.stemMat ??= new THREE.MeshStandardMaterial({ color: '#4f9a42', roughness: 0.95 }));
const flowerMat = (color: string): THREE.MeshStandardMaterial => {
  let m = shared.flowerMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
    shared.flowerMats.set(color, m);
  }
  return m;
};


function buildProp(prop: MapProp): THREE.Object3D {
  const s = prop.scale ?? 1;
  const g = new THREE.Group();
  g.position.set(prop.x, prop.y ?? 0, prop.z);
  g.rotation.y = prop.rot ?? 0;

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, shadow = true): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    g.add(m);
    return m;
  };

  switch (prop.kind) {
    case 'tree': {
      const leaf = prop.color ?? '#4e9d4c';
      const trunk = new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.95 });
      const foliage = new THREE.MeshStandardMaterial({ color: leaf, roughness: 0.9, flatShading: true });
      mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.7 * s, 7), trunk, 0.85 * s);
      const blob = (r: number, y: number, x: number, z: number) => {
        const m = mesh(new THREE.IcosahedronGeometry(r * s, 0), foliage, y * s);
        m.position.x = x * s; m.position.z = z * s;
        m.rotation.set(Math.random(), Math.random(), Math.random());
      };
      blob(0.95, 2.2, 0, 0);
      blob(0.68, 2.85, 0.32, -0.2);
      blob(0.6, 1.95, -0.5, 0.35);
      break;
    }
    case 'bush': {
      const m = new THREE.MeshStandardMaterial({ color: prop.color ?? '#5cb35a', roughness: 0.95, flatShading: true });
      mesh(new THREE.IcosahedronGeometry(0.5 * s, 0), m, 0.38 * s);
      const side = mesh(new THREE.IcosahedronGeometry(0.34 * s, 0), m, 0.26 * s);
      side.position.set(0.42 * s, 0.26 * s, 0.12 * s);
      break;
    }
    case 'rock': {
      const m = new THREE.MeshStandardMaterial({ color: prop.color ?? '#9aa3b2', roughness: 1, flatShading: true });
      const r = mesh(new THREE.DodecahedronGeometry(0.55 * s, 0), m, 0.32 * s);
      r.scale.set(1, 0.7, 0.9);
      break;
    }
    case 'cloud': {
      // Las nubes van muy altas y sin niebla: dan escala al cielo sin estorbar.
      const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, fog: false, flatShading: true });
      const puff = (r: number, x: number, y: number, z: number) => {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), m);
        c.position.set(x * s, y * s, z * s);
        c.scale.y = 0.65;
        g.add(c);
      };
      puff(2.2, 0, 0, 0); puff(1.6, 2.4, -0.3, 0.4); puff(1.4, -2.2, -0.4, -0.3); puff(1.1, 0.8, 0.9, -0.8);
      break;
    }
    case 'lamp': {
      const post = new THREE.MeshStandardMaterial({ color: '#4a5468', roughness: 0.6, metalness: 0.3 });
      const bulbColor = prop.color ?? '#ffd98a';
      const bulb = new THREE.MeshStandardMaterial({ color: bulbColor, emissive: bulbColor, emissiveIntensity: 1.2, roughness: 0.3 });
      mesh(new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 3.2 * s, 8), post, 1.6 * s);
      mesh(new THREE.SphereGeometry(0.3 * s, 12, 10), bulb, 3.3 * s, false);
      break;
    }
    case 'balloon': {
      const color = prop.color ?? BRANDING.colors.accent;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35 });
      const b = mesh(new THREE.SphereGeometry(0.42 * s, 14, 12), mat, 2.6 * s, false);
      b.scale.y = 1.25;
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 2.1 * s, 4),
        new THREE.MeshStandardMaterial({ color: '#e8ecf4' }),
      );
      string.position.y = 1.2 * s;
      g.add(string);
      break;
    }
    case 'flag': {
      const color = prop.color ?? BRANDING.colors.accent;
      const pole = new THREE.MeshStandardMaterial({ color: '#e8ecf4', roughness: 0.55 });
      mesh(new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 3.4 * s, 7), pole, 1.7 * s);
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2 * s, 0.75 * s, 6, 1),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }),
      );
      // Ondulación fija: una bandera plana parece cartón.
      const pos = cloth.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(pos.getX(i) * 3.2) * 0.12 * s);
      }
      pos.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
      cloth.position.set(0.62 * s, 2.95 * s, 0);
      cloth.castShadow = true;
      g.add(cloth);
      break;
    }
    case 'grass': {
      // Cinco hojas abiertas en abanico. Sin sombra: son cientos.
      const mat = grassMat();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const blade = new THREE.Mesh(bladeGeo(), mat);
        blade.position.set(Math.cos(a) * 0.05 * s, 0.15 * s, Math.sin(a) * 0.05 * s);
        blade.scale.setScalar(s * (0.75 + (i % 3) * 0.18));
        blade.rotation.set(Math.cos(a) * 0.34, a, Math.sin(a) * 0.34);
        g.add(blade);
      }
      break;
    }
    case 'flower': {
      const stem = new THREE.Mesh(stemGeo(), stemMat());
      stem.position.y = 0.10 * s;
      stem.scale.setScalar(s);
      g.add(stem);
      const petals = flowerMat(prop.color ?? '#ffe066');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = new THREE.Mesh(petalGeo(), petals);
        p.position.set(Math.cos(a) * 0.05 * s, 0.21 * s, Math.sin(a) * 0.05 * s);
        p.scale.setScalar(s);
        g.add(p);
      }
      const heart = new THREE.Mesh(petalGeo(), flowerMat('#ffb020'));
      heart.position.y = 0.225 * s;
      heart.scale.setScalar(s * 0.7);
      g.add(heart);
      break;
    }
    case 'banner': {
      const color = prop.color ?? BRANDING.colors.accent;
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8 * s, 3.2 * s, 5, 1),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }),
      );
      // Ondulación fija en vertical: una banderola plana parece cartón.
      const pos = cloth.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 2.4) * 0.14 * s);
      pos.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
      g.add(cloth);
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 2.0 * s, 6),
        new THREE.MeshStandardMaterial({ color: '#e8ecf4', roughness: 0.5, metalness: 0.4 }),
      );
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 1.6 * s;
      g.add(bar);
      break;
    }
  }
  return g;
}

/** Color con el que se marca cada sitio de bomba. Tienen que ser distintos. */
const SITE_COLORS = { A: PALETTE.siteA, B: PALETTE.siteB } as const;

/**
 * Mapa dibujado. `dispose()` libera TODO lo que este módulo ha creado: sin él,
 * cada vez que se entra a una partida se quedaba en la GPU la geometría y los
 * materiales del mapa anterior.
 */
export interface RenderedMap {
  root: THREE.Group;
  dispose(): void;
}

/** Construye la geometría visual de un MapLayout. */
export function buildMapMeshes(layout: MapLayout, def: MapDefinition): RenderedMap {
  const group = new THREE.Group();
  group.name = 'map';
  const owned: (THREE.Material | THREE.BufferGeometry)[] = [];
  const keep = <T extends THREE.Material | THREE.BufferGeometry>(x: T): T => { owned.push(x); return x; };

  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, solid: boolean) => {
    const key = `${color}|${solid}`;
    let m = mats.get(key);
    if (!m) {
      m = keep(new THREE.MeshStandardMaterial({
        color,
        roughness: solid ? 0.82 : 0.95,
        metalness: 0,
        vertexColors: true,
      }));
      mats.set(key, m);
    }
    return m;
  };

  const zones = () => {
    for (const letter of ['A', 'B'] as const) {
      const zone = buildZone(layout.bombsites[letter], SITE_COLORS[letter], letter);
      zone.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) keep(m.geometry);
        if (m.material && !Array.isArray(m.material)) keep(m.material);
      });
      group.add(zone);
    }
  };
  const sky = () => {
    const mesh = buildSky(def);
    keep(mesh.geometry);
    keep(mesh.material as THREE.Material);
    group.add(mesh);
  };
  const dispose = () => {
    for (const x of owned) x.dispose();
    owned.length = 0;
    group.clear();
  };

  // Arte hecho en Blender si está disponible. La colisión no cambia nunca:
  // sale de las mismas cajas del layout, en el servidor y en el cliente.
  const art = mapModelGroup(layout.id);
  if (art) {
    group.add(art);
    zones();
    sky();
    return { root: group, dispose };
  }

  const geo = keep(shadedBoxGeometry());
  for (const b of layout.boxes) {
    const solid = b.solid !== false;
    const mesh = new THREE.Mesh(geo, mat(b.color ?? '#888888', solid));
    mesh.position.set(b.x, b.y, b.z);
    mesh.rotation.set(b.rx ?? 0, b.ry ?? 0, b.rz ?? 0);
    mesh.scale.set(b.sx, b.sy, b.sz);
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  zones();
  for (const prop of layout.props ?? []) group.add(buildProp(prop));
  sky();
  return { root: group, dispose };
}

/** Libera la geometría y los materiales compartidos por los adornos. */
export function disposeSharedProps(): void {
  shared.blade?.dispose();
  shared.stem?.dispose();
  shared.petal?.dispose();
  shared.grassMat?.dispose();
  shared.stemMat?.dispose();
  for (const m of shared.flowerMats.values()) m.dispose();
  shared.blade = shared.stem = shared.petal = null;
  shared.grassMat = shared.stemMat = null;
  shared.flowerMats.clear();
}
