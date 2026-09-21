import * as THREE from 'three';

/**
 * =====================================================================
 *  ESCENARIO DEL MENÚ
 * =====================================================================
 *  Un rincón del mundo de ChibiStrike, no una peana con un personaje
 *  encima. La composición tiene tres planos para que la imagen tenga
 *  profundidad:
 *
 *    PRIMER PLANO   hierba y una roca a un lado, fuera de foco
 *    PERSONAJE      sobre un claro de tierra, junto a una hoguera
 *    FONDO          arboleda y colinas que se pierden en la niebla
 *
 *  Todo es geometría sencilla y de un solo color: el acabado lo pone la
 *  luz, no el detalle. Así el menú cuesta poco de dibujar.
 * =====================================================================
 */

/** Paleta del escenario. Cambiar aquí cambia el ambiente entero. */
export const STAGE = {
  ground: '#7a6a4e',
  groundDark: '#5f5540',
  grass: '#6f9f4a',
  grassDark: '#537c38',
  rock: '#8d8b86',
  rockDark: '#6c6a66',
  bark: '#5c4530',
  leaf: '#4e8a43',
  leafDeep: '#3d6f39',
  fire: '#ff9a3c',
  ember: '#ff5b2e',
  hill: '#63758b',
  hillFar: '#7d8 da3'.replace(' ', ''),
  sky: '#cfe4f2',
  skyTop: '#6f9dc4',
} as const;

const rnd = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

/** Material mate estilizado: sin brillos especulares que delaten el polígono. */
function matte(color: string, roughness = 0.95): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
}

function smooth(color: string, roughness = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

/** Mata de hierba: tres hojas en abanico. */
function grassTuft(mat: THREE.Material, scale: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.035, 0.26, 4, 1);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const blade = new THREE.Mesh(geo, mat);
    blade.position.set(Math.cos(a) * 0.03, 0.13, Math.sin(a) * 0.03);
    blade.rotation.set(Math.cos(a) * 0.3, a, Math.sin(a) * 0.3);
    g.add(blade);
  }
  g.scale.setScalar(scale);
  return g;
}

/** Árbol estilizado: tronco recto y dos o tres masas de copa. */
function tree(seed: number, mats: { bark: THREE.Material; leaf: THREE.Material; leafDeep: THREE.Material }): THREE.Group {
  const r = rnd(seed);
  const g = new THREE.Group();
  const h = 1.6 + r() * 1.1;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, h, 6), mats.bark);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const blobs = 3;
  for (let i = 0; i < blobs; i++) {
    const rad = 0.52 - i * 0.1 + r() * 0.12;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 0), i === 0 ? mats.leafDeep : mats.leaf);
    crown.position.set((r() - 0.5) * 0.4, h + 0.1 + i * 0.28, (r() - 0.5) * 0.4);
    crown.rotation.set(r() * 3, r() * 3, r() * 3);
    crown.castShadow = true;
    g.add(crown);
  }
  return g;
}

/** Roca: un icosaedro achatado y girado, que nunca se lee como una esfera. */
function rock(seed: number, mat: THREE.Material, scale: number): THREE.Mesh {
  const r = rnd(seed);
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat);
  m.scale.set(scale * (0.8 + r() * 0.5), scale * (0.5 + r() * 0.35), scale * (0.8 + r() * 0.5));
  m.rotation.set(r() * 3, r() * 3, r() * 3);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface MenuStage {
  root: THREE.Group;
  /** Luz de la hoguera: parpadea, así que la escena la anima. */
  fireLight: THREE.PointLight;
  fire: THREE.Group;
  dispose(): void;
}

/**
 * Construye el escenario. `heroX` es dónde se pone el personaje, para
 * dejarle un claro despejado y colocar la hoguera a su lado.
 */
export function buildMenuStage(heroX = 0.9): MenuStage {
  const root = new THREE.Group();
  const owned: (THREE.Material | THREE.BufferGeometry)[] = [];
  const keep = <T extends THREE.Material | THREE.BufferGeometry>(x: T): T => {
    owned.push(x);
    return x;
  };

  const mats = {
    ground: keep(matte(STAGE.ground, 1)),
    groundDark: keep(matte(STAGE.groundDark, 1)),
    grass: keep(matte(STAGE.grass)),
    grassDark: keep(matte(STAGE.grassDark)),
    rock: keep(matte(STAGE.rock)),
    rockDark: keep(matte(STAGE.rockDark)),
    bark: keep(matte(STAGE.bark)),
    leaf: keep(matte(STAGE.leaf)),
    leafDeep: keep(matte(STAGE.leafDeep)),
    hill: keep(smooth(STAGE.hill, 1)),
    hillFar: keep(smooth(STAGE.hillFar, 1)),
  };

  // --- suelo: una loma ancha de hierba con un claro de tierra ----------
  const groundGeo = keep(new THREE.CircleGeometry(26, 48));
  const ground = new THREE.Mesh(groundGeo, mats.grassDark);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const clearing = new THREE.Mesh(keep(new THREE.CircleGeometry(2.5, 32)), mats.ground);
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.set(heroX, 0.01, 0.1);
  clearing.receiveShadow = true;
  root.add(clearing);

  const patch = new THREE.Mesh(keep(new THREE.CircleGeometry(1.35, 24)), mats.groundDark);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(heroX - 0.15, 0.02, 0.25);
  patch.receiveShadow = true;
  root.add(patch);

  // Manchas de hierba clara sobre la oscura: un verde plano se lee como
  // cartulina en cuanto la cámara se acerca.
  const patchGeo = keep(new THREE.CircleGeometry(1, 12));
  const pr = rnd(4412);
  for (let i = 0; i < 26; i++) {
    const a = pr() * Math.PI * 2;
    const dist = 3 + pr() * 12;
    const m = new THREE.Mesh(patchGeo, pr() > 0.45 ? mats.grass : mats.groundDark);
    m.rotation.x = -Math.PI / 2;
    m.position.set(heroX + Math.cos(a) * dist, 0.005 + pr() * 0.004, Math.sin(a) * dist);
    m.scale.setScalar(0.9 + pr() * 2.4);
    m.receiveShadow = true;
    root.add(m);
  }

  // --- hoguera: el punto cálido de la escena ---------------------------
  const fire = new THREE.Group();
  fire.position.set(heroX - 1.55, 0, 0.75);
  const stoneGeo = keep(new THREE.IcosahedronGeometry(0.12, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = new THREE.Mesh(stoneGeo, mats.rock);
    s.position.set(Math.cos(a) * 0.34, 0.05, Math.sin(a) * 0.34);
    s.rotation.set(i, i * 2, i * 3);
    s.scale.setScalar(0.8 + (i % 3) * 0.2);
    s.castShadow = true;
    fire.add(s);
  }
  const logGeo = keep(new THREE.CylinderGeometry(0.045, 0.055, 0.55, 5));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const log = new THREE.Mesh(logGeo, mats.bark);
    log.position.set(Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1);
    log.rotation.set(Math.PI / 2.4, a, 0);
    log.castShadow = true;
    fire.add(log);
  }
  const flameMat = keep(new THREE.MeshBasicMaterial({ color: STAGE.fire, transparent: true, opacity: 0.92 }));
  const emberMat = keep(new THREE.MeshBasicMaterial({ color: STAGE.ember, transparent: true, opacity: 0.85 }));
  const flameGeo = keep(new THREE.ConeGeometry(0.115, 0.34, 6));
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = 0.24;
  flame.name = 'flame';
  fire.add(flame);
  const ember = new THREE.Mesh(keep(new THREE.ConeGeometry(0.075, 0.2, 6)), emberMat);
  ember.position.y = 0.16;
  ember.name = 'ember';
  fire.add(ember);
  root.add(fire);

  const fireLight = new THREE.PointLight(STAGE.fire, 6, 7, 2);
  fireLight.position.set(fire.position.x, 0.55, fire.position.z);
  root.add(fireLight);

  // --- entorno medio: rocas, troncos y matas alrededor del claro -------
  const r = rnd(7321);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.4;
    const dist = 3.1 + r() * 1.9;
    const m = rock(i * 977, i % 3 === 0 ? mats.rockDark : mats.rock, 0.3 + r() * 0.5);
    m.position.set(heroX + Math.cos(a) * dist, 0.06, Math.sin(a) * dist);
    root.add(m);
  }
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const dist = 2.6 + r() * 7.5;
    const t = grassTuft(i % 4 === 0 ? mats.grassDark : mats.grass, 0.7 + r() * 0.8);
    t.position.set(heroX + Math.cos(a) * dist, 0, Math.sin(a) * dist);
    t.rotation.y = r() * Math.PI;
    root.add(t);
  }

  // --- fondo: arboleda y dos filas de colinas --------------------------
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r() * 0.25;
    const dist = 9 + r() * 5;
    const t = tree(i * 131 + 5, mats);
    t.position.set(heroX + Math.cos(a) * dist, 0, Math.sin(a) * dist);
    t.scale.setScalar(0.85 + r() * 0.5);
    root.add(t);
  }
  for (const [radius, height, mat] of [[19, 3.4, mats.hill], [24, 5.2, mats.hillFar]] as const) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (radius === 19 ? 0.2 : 0.55);
      const h = new THREE.Mesh(keep(new THREE.ConeGeometry(4.5 + r() * 2.5, height + r() * 1.6, 5)), mat);
      h.position.set(heroX + Math.cos(a) * radius, -0.4, Math.sin(a) * radius);
      h.rotation.y = r() * 3;
      root.add(h);
    }
  }

  // --- primer plano: una roca y unas matas muy cerca de la cámara ------
  // Se recortan por el borde del encuadre y dan sensación de profundidad.
  const near = rock(999, mats.rockDark, 1.05);
  near.position.set(heroX + 1.15, 0.05, -1.95);
  root.add(near);
  for (let i = 0; i < 14; i++) {
    const t = grassTuft(mats.grassDark, 1.6 + r() * 1.0);
    t.position.set(heroX - 1.2 + r() * 3.0, 0, -2.3 + r() * 0.8);
    root.add(t);
  }

  return {
    root,
    fireLight,
    fire,
    dispose() {
      for (const x of owned) x.dispose();
    },
  };
}
