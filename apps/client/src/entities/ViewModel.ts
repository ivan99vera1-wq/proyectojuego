import * as THREE from 'three';
import { WEAPONS, type WeaponId } from '@game/config';
import { buildWeaponMesh, findMagazine } from './WeaponMesh.js';
import { WeaponAnimator } from './WeaponAnimator.js';

/** Pose de reposo del arma delante de la cámara. */
const REPOSO = { x: 0.24, y: -0.24, z: -0.40 };

/**
 * Aumento del arma en primera persona, por categoría.
 *
 * Las mallas están a escala de mundo (una TT mide 13 cm), y a ese tamaño una
 * pistola no se lee en pantalla. Como en cualquier shooter, el arma que ves en
 * tus manos es más grande que la que ve el resto: esto sube las pequeñas sin
 * igualarlas a un fusil, para que un rifle siga imponiendo más que una pistola.
 */
const AUMENTO: Record<string, number> = {
  knife: 1.9, pistol: 1.9, grenade: 1.9, smg: 1.35, rifle: 1.25, sniper: 1.15,
};

/** Radio de las manos. Son de relleno hasta que el personaje tenga manos de verdad. */
const RADIO_MANO = 0.038;

/**
 * Arma en primera persona, hija de la cámara.
 *
 * Aquí vive lo que depende de la CÁMARA (balanceo al andar, arrastre del ratón,
 * posición de las manos); los gestos del arma —sacar, recargar, inspeccionar,
 * retroceso— los calcula `WeaponAnimator` y esto solo los suma a la pose.
 */
export class ViewModel {
  readonly root = new THREE.Group();
  readonly animator = new WeaponAnimator();
  private weapon: THREE.Group | null = null;
  private magazine: THREE.Object3D | null = null;
  /** Altura del cargador dentro del arma, para poder devolverlo a su sitio. */
  private magBaseY = 0;
  private weaponId = '';
  private bob = 0;
  private swayX = 0;
  private swayY = 0;
  private hands: THREE.Mesh[] = [];
  // Tono de la piel del personaje. No hay personalización, así que es fijo.
  private readonly handMat = new THREE.MeshStandardMaterial({ color: '#e8a276', roughness: 0.78 });
  private readonly handGeo = new THREE.SphereGeometry(RADIO_MANO, 10, 8);

  constructor() {
    this.root.position.set(REPOSO.x, REPOSO.y, REPOSO.z);
    for (let i = 0; i < 2; i++) {
      const h = new THREE.Mesh(this.handGeo, this.handMat);
      this.root.add(h);
      this.hands.push(h);
    }
  }

  /** Libera lo propio. El arma comparte geometría con el resto del juego. */
  dispose(): void {
    if (this.weapon) { this.root.remove(this.weapon); this.weapon = null; }
    this.handGeo.dispose();
    this.handMat.dispose();
    this.root.removeFromParent();
  }

  setWeapon(id: string): void {
    if (id === this.weaponId) return;
    if (this.weapon) this.root.remove(this.weapon);
    this.weaponId = id;
    this.weapon = id ? buildWeaponMesh(id) : null;
    this.magazine = this.weapon ? findMagazine(this.weapon, id) : null;
    this.magBaseY = this.magazine ? this.magazine.position.y : 0;
    this.animator.setWeapon(id);
    const w = WEAPONS[id as WeaponId];
    if (this.weapon) {
      this.weapon.scale.setScalar(AUMENTO[w?.category ?? ''] ?? 1.4);
      this.root.add(this.weapon);
      // Cambiar de arma la saca: es el gesto que da peso al cambio.
      this.animator.draw();
    }
    this.colocarManos(w?.category);
  }

  /**
   * Pone las manos sobre el arma midiendo su caja, no con números fijos por
   * tipo: el pack trae armas de 13 cm y de 72 cm, y una mano puesta "a 22 cm
   * del puño" queda flotando en la pistola y en mitad del cañón del fusil.
   */
  private colocarManos(categoria: string | undefined): void {
    const [derecha, izquierda] = this.hands as [THREE.Mesh, THREE.Mesh];
    derecha.position.set(0, -RADIO_MANO * 0.5, RADIO_MANO * 0.4);
    if (!this.weapon || categoria === 'knife' || categoria === 'grenade') {
      izquierda.visible = false;
      return;
    }
    // El guardamanos está por delante del puño; -Z es hacia el cañón.
    const caja = new THREE.Box3().setFromObject(this.weapon);
    const alcance = Math.max(0, -caja.min.z);
    izquierda.visible = alcance > 0.12;
    izquierda.position.set(-RADIO_MANO * 0.4, -RADIO_MANO * 0.3, -alcance * 0.55);
  }

  fire(): void { this.animator.fire(); }
  startReload(): void { this.animator.reload(); }
  inspect(): void { this.animator.inspect(); }
  cancel(): void { this.animator.cancel(); }

  update(dt: number, speed: number, grounded: boolean, mouseDx: number, mouseDy: number): void {
    const pose = this.animator.update(dt);

    const moving = grounded && speed > 0.5;
    this.bob += dt * (moving ? speed * 1.6 : 0);
    const bobX = moving ? Math.sin(this.bob) * 0.012 : 0;
    const bobY = moving ? Math.abs(Math.cos(this.bob)) * 0.01 : 0;
    this.swayX = THREE.MathUtils.lerp(this.swayX, -mouseDx * 0.4, Math.min(1, dt * 10));
    this.swayY = THREE.MathUtils.lerp(this.swayY, mouseDy * 0.4, Math.min(1, dt * 10));

    this.root.position.set(
      REPOSO.x + bobX + this.swayX * 0.05 + pose.x,
      REPOSO.y + bobY + this.swayY * 0.03 + pose.y + (grounded ? 0 : 0.02),
      REPOSO.z + pose.z,
    );
    this.root.rotation.set(
      pose.pitch + this.swayY * 0.1,
      pose.yaw + this.swayX * 0.15 + 0.05,
      pose.roll + 0.02,
    );

    // El cargador se mueve por su cuenta: es lo que hace que una recarga
    // parezca una recarga y no un meneo de muñeca.
    if (this.magazine) {
      this.magazine.visible = pose.magVisible;
      this.magazine.position.y = this.magBaseY + pose.magY;
    }
  }
}
