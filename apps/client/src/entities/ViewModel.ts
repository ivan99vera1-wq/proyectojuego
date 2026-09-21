import * as THREE from 'three';
import { WEAPONS, type WeaponId } from '@game/config';
import { buildWeaponMesh } from './WeaponMesh.js';

/**
 * Arma en primera persona, hija de la cámara. Retroceso, recarga y balanceo.
 */
export class ViewModel {
  readonly root = new THREE.Group();
  private weapon: THREE.Group | null = null;
  private weaponId = '';
  private kick = 0;
  private reloadT = 0;
  private reloadTotal = 0;
  private bob = 0;
  private swayX = 0;
  private swayY = 0;
  private hands: THREE.Mesh[] = [];
  // Tono de la piel del personaje. No hay personalización, así que es fijo.
  private handMat = new THREE.MeshStandardMaterial({ color: '#e8a276', roughness: 0.78 });

  constructor() {
    this.root.position.set(0.28, -0.26, -0.45);
    const geo = new THREE.SphereGeometry(0.055, 10, 8);
    for (let i = 0; i < 2; i++) { const h = new THREE.Mesh(geo, this.handMat); this.root.add(h); this.hands.push(h); }
  }

  setWeapon(id: string): void {
    if (id === this.weaponId) return;
    if (this.weapon) this.root.remove(this.weapon);
    this.weaponId = id;
    this.weapon = id ? buildWeaponMesh(id) : null;
    if (this.weapon) { this.weapon.scale.setScalar(1.15); this.root.add(this.weapon); }
    const w = WEAPONS[id as WeaponId];
    const long = w && (w.category === 'rifle' || w.category === 'sniper' || w.category === 'shotgun' || w.category === 'smg');
    this.hands[0]!.position.set(0, -0.02, 0.02);
    this.hands[1]!.position.set(-0.02, 0.0, long ? -0.22 : -0.08);
    this.hands[1]!.visible = !!w && w.category !== 'knife' && w.category !== 'grenade';
  }

  fire(): void {
    const w = WEAPONS[this.weaponId as WeaponId];
    this.kick = w ? Math.min(1, 0.35 + w.recoilVertical * 0.08) : 0.4;
  }

  startReload(seconds: number): void {
    this.reloadTotal = seconds;
    this.reloadT = seconds;
  }

  update(dt: number, speed: number, grounded: boolean, mouseDx: number, mouseDy: number): void {
    this.kick = Math.max(0, this.kick - dt * 6);
    if (this.reloadT > 0) this.reloadT = Math.max(0, this.reloadT - dt);
    const moving = grounded && speed > 0.5;
    this.bob += dt * (moving ? speed * 1.6 : 0);
    const bobX = moving ? Math.sin(this.bob) * 0.012 : 0;
    const bobY = moving ? Math.abs(Math.cos(this.bob)) * 0.01 : 0;
    this.swayX = THREE.MathUtils.lerp(this.swayX, -mouseDx * 0.4, Math.min(1, dt * 10));
    this.swayY = THREE.MathUtils.lerp(this.swayY, mouseDy * 0.4, Math.min(1, dt * 10));
    let reloadDip = 0, reloadRot = 0;
    if (this.reloadT > 0 && this.reloadTotal > 0) {
      const k = 1 - this.reloadT / this.reloadTotal;
      reloadDip = Math.sin(k * Math.PI) * 0.15;
      reloadRot = Math.sin(k * Math.PI) * 0.8;
    }
    this.root.position.set(0.28 + bobX + this.swayX * 0.05, -0.26 + bobY - reloadDip + this.swayY * 0.03, -0.45 + this.kick * 0.08);
    this.root.rotation.set(-this.kick * 0.25 + reloadRot + this.swayY * 0.1, this.swayX * 0.15 + 0.05, 0.02);
    if (!grounded) this.root.position.y += 0.02;
  }
}
