import * as THREE from 'three';
import { BRANDING, GAMEPLAY, COSMETICS, type CosmeticId } from '@game/config';
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

/**
 * Chibi de un jugador en el mundo (remoto, o el propio en tercera persona en el
 * menú). Animación procedural: ciclo de marcha, agacharse, salto, muerte, emotes.
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
  private bobT = 0;
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
    sprite.position.y = this.model.height + 0.25;
    sprite.renderOrder = 10;
    this.nameTag = sprite;
    this.root.add(sprite);
  }

  playEmote(kind: number): void {
    this.emoteKind = kind;
    this.emoteT = 1.6;
  }

  private ensureWeapon(weaponId: string): void {
    if (weaponId === this.weaponId) return;
    if (this.weapon) this.model.handR.remove(this.weapon);
    this.weaponId = weaponId;
    this.weapon = weaponId ? buildWeaponMesh(weaponId, weaponSkinColor(this.avatar)) : null;
    if (this.weapon) {
      this.weapon.position.set(0, 0, -0.02);
      this.weapon.rotation.set(-Math.PI / 2 + 0.35, 0, 0);
      this.model.handR.add(this.weapon);
    }
  }

  private ensureBomb(has: boolean): void {
    if (has && !this.bomb) {
      this.bomb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: '#c0392b', emissive: '#ff0000', emissiveIntensity: 0.4 }));
      this.bomb.position.z = -0.06;
      this.model.back.add(this.bomb);
    } else if (!has && this.bomb) {
      this.model.back.remove(this.bomb);
      this.bomb = null;
    }
  }

  update(dt: number, pose: PlayerPose): void {
    const m = this.model;
    this.root.position.set(pose.x, pose.y, pose.z);
    this.root.rotation.y = pose.yaw;
    this.ensureWeapon(pose.alive ? pose.weaponId : '');
    this.ensureBomb(pose.hasBomb && pose.alive);
    if (this.nameTag) this.nameTag.visible = pose.alive;

    // Muerte: cae hacia atrás y se queda tumbado.
    if (!pose.alive) {
      if (this.wasAlive) { this.deathT = 0; this.wasAlive = false; }
      this.deathT = Math.min(1, this.deathT + dt * 3);
      const k = 1 - Math.pow(1 - this.deathT, 3);
      m.root.rotation.x = -Math.PI / 2 * k;
      m.root.position.y = 0.12 * k;
      m.legL.rotation.x = m.legR.rotation.x = 0;
      m.armL.rotation.set(0, 0, 1.6 * k); m.armR.rotation.set(0, 0, -1.6 * k);
      return;
    }
    if (!this.wasAlive) { this.wasAlive = true; m.root.rotation.x = 0; m.root.position.y = 0; }

    // Emote
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      const t = performance.now() / 1000;
      if (this.emoteKind === 0) { // baile
        m.hips.position.y = GAMEPLAY.player.capsuleHeight * 0 + 0.3 + Math.abs(Math.sin(t * 8)) * 0.08;
        m.armL.rotation.set(0, 0, 2.6 + Math.sin(t * 8) * 0.5); m.armR.rotation.set(0, 0, -2.6 - Math.sin(t * 8) * 0.5);
        m.torso.rotation.y = Math.sin(t * 4) * 0.4;
      } else { // saludo
        m.armR.rotation.set(0, 0, -2.8 + Math.sin(t * 10) * 0.4); m.armL.rotation.set(0, 0, 0.2);
        m.torso.rotation.y = 0;
      }
      return;
    }
    m.torso.rotation.y = 0;

    // Agacharse
    const crouchK = pose.crouching ? 1 : 0;
    m.hips.position.y = THREE.MathUtils.lerp(m.hips.position.y, 0.30 - 0.12 * crouchK, Math.min(1, dt * 12));
    m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, 0.35 * crouchK, Math.min(1, dt * 12));

    // Ciclo de marcha
    const walking = pose.grounded && pose.speed > 0.3;
    if (walking) this.phase += dt * pose.speed * 2.2;
    const amp = walking ? Math.min(1, pose.speed / 5) * 0.7 : 0;
    const s = Math.sin(this.phase);
    const targetLegL = pose.grounded ? s * amp : 0.5;
    const targetLegR = pose.grounded ? -s * amp : -0.3;
    m.legL.rotation.x = THREE.MathUtils.lerp(m.legL.rotation.x, targetLegL, Math.min(1, dt * 15));
    m.legR.rotation.x = THREE.MathUtils.lerp(m.legR.rotation.x, targetLegR, Math.min(1, dt * 15));
    // Brazos: el derecho sostiene el arma delante; el izquierdo balancea
    const aim = -1.5 - pose.pitch * 0.6;
    m.armR.rotation.set(aim, 0, -0.15);
    m.armL.rotation.set(this.weapon ? aim + 0.2 : -s * amp * 0.8, this.weapon ? 0.5 : 0, this.weapon ? 0.35 : 0.15);
    // Cabeza sigue el pitch
    m.head.rotation.x = -pose.pitch * 0.5;
    // Bob sutil al correr
    this.bobT += dt;
    m.torso.position.y = walking ? Math.abs(Math.sin(this.phase * 2)) * 0.02 : 0;
  }

  dispose(): void {
    this.model.dispose();
    if (this.nameTag) (this.nameTag.material as THREE.SpriteMaterial).map?.dispose();
  }
}
