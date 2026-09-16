import * as THREE from 'three';
import { BRANDING, COSMETICS, WEAPONS, type CosmeticId, type WeaponId } from '@game/config';
import { decodeAvatar, type AvatarConfig } from '@game/shared';
import { buildChibi, type ChibiModel } from '../customization/AvatarBuilder.js';
import { buildWeaponMesh } from './WeaponMesh.js';

export interface PlayerPose {
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  speed: number;
  grounded: boolean;
  crouching: boolean;
  alive: boolean;
  reloading: boolean;
  weaponId: string;
  hasBomb: boolean;
  team: string;
}

/** Color de skin de arma según el cosmético weaponSkin del avatar. */
export function weaponSkinColor(avatar: AvatarConfig): string | undefined {
  const skin = COSMETICS[avatar.items.weaponSkin as CosmeticId];
  if (!skin || skin.model === '') return undefined;
  return avatar.colors.primary;
}

const lerp = THREE.MathUtils.lerp;
const damp = (current: number, target: number, speed: number, dt: number): number =>
  lerp(current, target, Math.min(1, speed * dt));

/**
 * Chibi de un jugador en el mundo (remoto, o el propio en el menú).
 *
 * Las animaciones son procedurales sobre el rig del personaje base:
 * ciclo de marcha con rodilla, agachado, salto, apuntado con el pitch de
 * la cámara, retroceso al disparar, recarga, muerte y emotes.
 * Nada de esto toca la hitbox, que vive en el servidor.
 */
export class PlayerEntity {
  readonly root = new THREE.Group();
  model: ChibiModel;
  avatar: AvatarConfig;
  private weapon: THREE.Group | null = null;
  private weaponId = '';
  private bomb: THREE.Mesh | null = null;
  private nameTag: THREE.Sprite | null = null;
  private phase = 0;
  private deathT = 0;
  private emoteT = 0;
  private emoteKind = 0;
  private fireKick = 0;
  private reloadT = 0;
  private wasAlive = true;

  constructor(avatarEncoded: string, public nickname: string, team: string) {
    this.avatar = decodeAvatar(avatarEncoded);
    this.model = buildChibi(this.avatar);
    this.root.add(this.model.root);
    this.setNameTag(nickname, team);
  }

  setAvatar(avatarEncoded: string): void {
    const next = decodeAvatar(avatarEncoded);
    if (JSON.stringify(next) === JSON.stringify(this.avatar)) return;
    this.avatar = next;
    this.model.dispose();
    this.root.remove(this.model.root);
    this.model = buildChibi(next);
    this.root.add(this.model.root);
    this.weaponId = '';
    this.weapon = null;
  }

  setNameTag(name: string, team: string): void {
    if (this.nameTag) { this.root.remove(this.nameTag); (this.nameTag.material as THREE.SpriteMaterial).map?.dispose(); }
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(name, 128, 32);
    ctx.fillStyle = team === 'A' ? BRANDING.colors.teamA : team === 'B' ? BRANDING.colors.teamB : '#ffffff';
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sprite.scale.set(1.0, 0.25, 1);
    sprite.position.y = this.model.height + 0.22;
    sprite.renderOrder = 10;
    this.nameTag = sprite;
    this.root.add(sprite);
  }

  playEmote(kind: number): void {
    this.emoteKind = kind;
    this.emoteT = 1.6;
  }

  /** Retroceso visible al disparar (lo dispara la escena con ShotFired). */
  playFire(): void {
    const w = WEAPONS[this.weaponId as WeaponId];
    this.fireKick = Math.min(1, 0.45 + (w?.recoilVertical ?? 2) * 0.07);
  }

  private ensureWeapon(weaponId: string): void {
    if (weaponId === this.weaponId) return;
    if (this.weapon) this.model.gripR.remove(this.weapon);
    this.weaponId = weaponId;
    this.weapon = weaponId ? buildWeaponMesh(weaponId, weaponSkinColor(this.avatar)) : null;
    if (this.weapon) {
      // El arma nace con el cañón hacia -Z; en la mano hay que alinearlo con
      // el eje del antebrazo y dejar la empuñadura dentro del puño.
      this.weapon.position.set(0, -0.01, 0.015);
      this.weapon.rotation.set(-Math.PI / 2 + 0.42, 0, 0);
      this.model.gripR.add(this.weapon);
    }
  }

  private ensureBomb(has: boolean): void {
    if (has && !this.bomb) {
      this.bomb = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.11, 0.07),
        new THREE.MeshStandardMaterial({ color: '#c0392b', emissive: '#ff0000', emissiveIntensity: 0.4 }),
      );
      this.bomb.position.z = -0.05;
      this.bomb.castShadow = true;
      this.model.back.add(this.bomb);
    } else if (!has && this.bomb) {
      this.model.back.remove(this.bomb);
      this.bomb.geometry.dispose();
      this.bomb = null;
    }
  }

  update(dt: number, pose: PlayerPose): void {
    const m = this.model;
    const hipY = m.proportions.y.hip;
    this.root.position.set(pose.x, pose.y, pose.z);
    this.root.rotation.y = pose.yaw;
    this.ensureWeapon(pose.alive ? pose.weaponId : '');
    this.ensureBomb(pose.hasBomb && pose.alive);
    if (this.nameTag) this.nameTag.visible = pose.alive;
    this.fireKick = Math.max(0, this.fireKick - dt * 5);
    this.reloadT = pose.reloading ? Math.min(1, this.reloadT + dt * 4) : Math.max(0, this.reloadT - dt * 4);

    // ---------------------------------------------------------- muerte
    if (!pose.alive) {
      if (this.wasAlive) { this.deathT = 0; this.wasAlive = false; }
      this.deathT = Math.min(1, this.deathT + dt * 3.2);
      const k = 1 - Math.pow(1 - this.deathT, 3);
      m.root.rotation.x = -Math.PI / 2 * k;
      m.root.position.y = hipY * 0.42 * k;
      m.hips.position.y = hipY;
      m.torso.rotation.set(0, 0, 0);
      m.hipL.rotation.set(-0.35 * k, 0, 0.12 * k);
      m.hipR.rotation.set(-0.15 * k, 0, -0.18 * k);
      m.kneeL.rotation.x = -0.9 * k;
      m.kneeR.rotation.x = -0.5 * k;
      m.shoulderL.rotation.set(0.3 * k, 0, 1.5 * k);
      m.shoulderR.rotation.set(0.2 * k, 0, -1.5 * k);
      m.elbowL.rotation.x = 0.4 * k;
      m.elbowR.rotation.x = 0.4 * k;
      m.head.rotation.set(0.25 * k, 0.2 * k, 0);
      return;
    }
    if (!this.wasAlive) { this.wasAlive = true; m.root.rotation.x = 0; m.root.position.y = 0; }

    // ---------------------------------------------------------- emotes
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      const t = performance.now() / 1000;
      m.hipL.rotation.set(0, 0, 0); m.hipR.rotation.set(0, 0, 0);
      m.kneeL.rotation.x = 0; m.kneeR.rotation.x = 0;
      if (this.emoteKind === 0) {
        m.hips.position.y = hipY + Math.abs(Math.sin(t * 8)) * 0.06;
        m.torso.rotation.set(0, Math.sin(t * 4) * 0.4, 0);
        m.shoulderL.rotation.set(0, 0, 2.5 + Math.sin(t * 8) * 0.5);
        m.shoulderR.rotation.set(0, 0, -2.5 - Math.sin(t * 8) * 0.5);
        m.elbowL.rotation.x = 0.6; m.elbowR.rotation.x = 0.6;
      } else {
        m.hips.position.y = hipY;
        m.torso.rotation.set(0, 0, 0);
        m.shoulderR.rotation.set(0, 0, -2.7 + Math.sin(t * 10) * 0.35);
        m.shoulderL.rotation.set(0, 0, 0.18);
        m.elbowR.rotation.x = 0.35; m.elbowL.rotation.x = 0.1;
      }
      m.head.rotation.set(0, 0, 0);
      return;
    }

    // -------------------------------------------------- postura general
    const crouch = pose.crouching ? 1 : 0;
    const walking = pose.grounded && pose.speed > 0.35;
    const amp = walking ? Math.min(1, pose.speed / 5.2) * 0.62 : 0;
    if (walking) this.phase += dt * Math.min(pose.speed, 8) * 2.1;

    const crouchDrop = hipY * 0.30;
    const bob = walking ? Math.abs(Math.sin(this.phase)) * 0.016 * amp : 0;
    m.hips.position.y = damp(m.hips.position.y, hipY - crouchDrop * crouch + bob, 14, dt);
    m.torso.rotation.x = damp(m.torso.rotation.x, 0.30 * crouch + amp * 0.10 - this.fireKick * 0.07, 12, dt);
    m.torso.rotation.y = damp(m.torso.rotation.y, 0, 12, dt);

    // ---------------------------------------------------- ciclo de piernas
    const swing = Math.sin(this.phase);
    let hipL: number, hipR: number, kneeL: number, kneeR: number;
    if (!pose.grounded) {
      // En el aire: una pierna recogida, la otra estirada.
      hipL = 0.55; hipR = 0.15;
      kneeL = -1.0; kneeR = -0.35;
    } else {
      hipL = swing * amp + crouch * 0.55;
      hipR = -swing * amp + crouch * 0.55;
      // La rodilla solo dobla hacia atrás, y más en la fase de recogida.
      kneeL = -Math.max(0, Math.sin(this.phase - 1.1)) * amp * 1.9 - crouch * 1.15;
      kneeR = -Math.max(0, Math.sin(this.phase + Math.PI - 1.1)) * amp * 1.9 - crouch * 1.15;
    }
    m.hipL.rotation.x = damp(m.hipL.rotation.x, hipL, 16, dt);
    m.hipR.rotation.x = damp(m.hipR.rotation.x, hipR, 16, dt);
    m.kneeL.rotation.x = damp(m.kneeL.rotation.x, kneeL, 16, dt);
    m.kneeR.rotation.x = damp(m.kneeR.rotation.x, kneeR, 16, dt);
    // El tobillo compensa para que el pie no atraviese el suelo.
    m.ankleL.rotation.x = damp(m.ankleL.rotation.x, -(hipL + kneeL) * 0.55, 16, dt);
    m.ankleR.rotation.x = damp(m.ankleR.rotation.x, -(hipR + kneeR) * 0.55, 16, dt);

    // ------------------------------------------------------- brazos
    const armed = !!this.weapon;
    if (armed) {
      // Apuntar: el brazo derecho sostiene el arma siguiendo el pitch de la
      // cámara y el izquierdo la acompaña por delante.
      const aim = 1.42 + pose.pitch * 0.62 - this.fireKick * 0.22;
      const reload = this.reloadT;
      const wobble = Math.sin(performance.now() / 1000 * 9) * 0.05 * reload;
      m.shoulderR.rotation.x = damp(m.shoulderR.rotation.x, aim, 14, dt);
      m.shoulderR.rotation.z = damp(m.shoulderR.rotation.z, -0.20, 14, dt);
      m.shoulderR.rotation.y = damp(m.shoulderR.rotation.y, 0.10, 14, dt);
      m.elbowR.rotation.x = damp(m.elbowR.rotation.x, 0.52 + this.fireKick * 0.30, 14, dt);
      // Mano izquierda: sujeta el guardamanos, o baja al cargador al recargar.
      const lx = lerp(aim - 0.12, 0.55 + wobble, reload);
      const ly = lerp(0.46, 0.30, reload);
      const lz = lerp(0.34, 0.55, reload);
      const le = lerp(0.95, 1.55, reload);
      m.shoulderL.rotation.x = damp(m.shoulderL.rotation.x, lx, 14, dt);
      m.shoulderL.rotation.y = damp(m.shoulderL.rotation.y, ly, 14, dt);
      m.shoulderL.rotation.z = damp(m.shoulderL.rotation.z, lz, 14, dt);
      m.elbowL.rotation.x = damp(m.elbowL.rotation.x, le, 14, dt);
    } else {
      // Desarmado: los brazos balancean en contrafase con las piernas.
      m.shoulderR.rotation.x = damp(m.shoulderR.rotation.x, -swing * amp * 0.85, 14, dt);
      m.shoulderL.rotation.x = damp(m.shoulderL.rotation.x, swing * amp * 0.85, 14, dt);
      m.shoulderR.rotation.z = damp(m.shoulderR.rotation.z, -0.26, 14, dt);
      m.shoulderL.rotation.z = damp(m.shoulderL.rotation.z, 0.26, 14, dt);
      m.shoulderR.rotation.y = damp(m.shoulderR.rotation.y, 0, 14, dt);
      m.shoulderL.rotation.y = damp(m.shoulderL.rotation.y, 0, 14, dt);
      m.elbowR.rotation.x = damp(m.elbowR.rotation.x, 0.30 + Math.max(0, swing) * amp * 0.5, 14, dt);
      m.elbowL.rotation.x = damp(m.elbowL.rotation.x, 0.30 + Math.max(0, -swing) * amp * 0.5, 14, dt);
    }

    // --------------------------------------------------------- cabeza
    m.head.rotation.x = damp(m.head.rotation.x, -pose.pitch * 0.45 - crouch * 0.12, 12, dt);
    m.head.rotation.y = damp(m.head.rotation.y, 0, 12, dt);
  }

  dispose(): void {
    this.model.dispose();
    if (this.nameTag) (this.nameTag.material as THREE.SpriteMaterial).map?.dispose();
  }
}
