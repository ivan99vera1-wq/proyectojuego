import * as THREE from 'three';
import { WEAPONS, type WeaponId } from '@game/config';
import { cloneWeapon, hasWeaponModels } from '../character/glb.js';

const cache = new Map<string, THREE.Group>();

/**
 * El cargador extraíble de un arma, si su malla lo trae aparte.
 *
 * `build_weapons.py` lo exporta emparentado al cuerpo y con el nombre
 * `<id>__mag`; las armas de peine (Garand, Mauser) y las que no se recargan
 * no lo tienen, y entonces esto devuelve null y el gesto de recarga no mueve
 * ningún cargador.
 */
export function findMagazine(weapon: THREE.Object3D, weaponId: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  weapon.traverse((o) => {
    if (!found && o.name.replace(/\.\d+$/, '') === `${weaponId}__mag`) found = o;
  });
  return found;
}

/**
 * Malla procedural de un arma (hasta que exista arte GLB). El origen está en la
 * empuñadura y el cañón apunta hacia -Z. `skinColor` recolorea el cuerpo (weaponSkin).
 */
export function buildWeaponMesh(weaponId: string, skinColor?: string): THREE.Group {
  // Modelo hecho en Blender si está disponible; si no, la versión procedural.
  if (hasWeaponModels()) {
    const model = cloneWeapon(weaponId, skinColor);
    if (model) {
      const group = new THREE.Group();
      group.add(model);
      return group;
    }
  }
  const key = `${weaponId}:${skinColor ?? ''}`;
  const cached = cache.get(key);
  if (cached) return cached.clone();

  const w = WEAPONS[weaponId as WeaponId];
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: skinColor ?? '#3b3f4a', roughness: 0.5, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1e2027', roughness: 0.6, metalness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: skinColor ? '#ffffff' : '#ffd23f', roughness: 0.5 });
  const add = (m: THREE.Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const B = (sx: number, sy: number, sz: number, mat = body) => new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  const C = (r: number, h: number, mat = dark) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat); m.rotation.x = Math.PI / 2; return m; };

  if (!w) return g;
  switch (w.category) {
    case 'knife':
      add(B(0.03, 0.09, 0.03, dark), 0, 0, 0);
      add(B(0.012, 0.04, 0.22, accent), 0, 0.05, -0.13);
      break;
    case 'pistol':
      add(B(0.04, 0.1, 0.05, dark), 0, -0.04, 0.02);
      add(B(0.045, 0.05, 0.2), 0, 0.03, -0.08);
      add(C(0.012, 0.08), 0, 0.03, -0.2);
      break;
    case 'smg':
      add(B(0.04, 0.1, 0.05, dark), 0, -0.04, 0.02);
      add(B(0.05, 0.07, 0.3), 0, 0.03, -0.12);
      add(B(0.03, 0.12, 0.03, dark), 0, -0.04, -0.1);
      add(C(0.013, 0.12), 0, 0.04, -0.32);
      add(B(0.03, 0.04, 0.12, dark), 0, 0.02, 0.12);
      break;
    case 'rifle':
      add(B(0.04, 0.1, 0.05, dark), 0, -0.04, 0.02);
      add(B(0.05, 0.07, 0.42), 0, 0.03, -0.16);
      add(B(0.03, 0.14, 0.04, dark), 0, -0.05, -0.1);
      add(C(0.012, 0.22), 0, 0.045, -0.46);
      add(B(0.04, 0.06, 0.16, dark), 0, 0.02, 0.14);
      add(B(0.02, 0.03, 0.08, accent), 0, 0.085, -0.1);
      break;
    case 'sniper':
      add(B(0.04, 0.1, 0.05, dark), 0, -0.04, 0.02);
      add(B(0.045, 0.06, 0.5), 0, 0.03, -0.2);
      add(C(0.011, 0.4), 0, 0.045, -0.6);
      add(B(0.04, 0.06, 0.2, dark), 0, 0.02, 0.16);
      { const scope = C(0.02, 0.16, accent); add(scope, 0, 0.1, -0.15); }
      add(B(0.02, 0.05, 0.02, dark), 0, 0.075, -0.15);
      break;
    case 'grenade': {
      const isSmoke = w.damage === 0;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshStandardMaterial({ color: isSmoke ? '#cfd8dc' : '#ff5c7a', roughness: 0.6 }));
      add(m, 0, 0.02, -0.02);
      add(C(0.02, 0.04, dark), 0, 0.08, -0.02).rotation.x = 0;
      break;
    }
  }
  cache.set(key, g);
  return g.clone();
}
