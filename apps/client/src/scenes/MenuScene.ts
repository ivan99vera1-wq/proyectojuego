import * as THREE from 'three';
import { BRANDING } from '@game/config';
import type { AvatarConfig } from '@game/shared';
import type { Engine } from '../core/Engine.js';
import type { GameScene } from '../core/GameScene.js';
import { PlayerEntity } from '../entities/PlayerEntity.js';

/** Fondo 3D del menú: el avatar del jugador sobre una peana, girando lentamente. */
export class MenuScene implements GameScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private entity: PlayerEntity | null = null;
  private t = 0;

  constructor(private readonly engine: Engine, private avatar: AvatarConfig, private nickname: string) {}

  init(): void {
    this.scene.background = new THREE.Color(BRANDING.colors.background);
    this.scene.fog = new THREE.Fog(BRANDING.colors.background, 6, 14);
    // Cámara en el lado -Z: es hacia donde mira el personaje.
    this.camera.position.set(1.5, 1.05, -2.9);
    this.camera.lookAt(0.9, 0.62, 0);
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    this.scene.add(sun, new THREE.HemisphereLight('#cfe5ff', '#3a2a40', 1.3), new THREE.AmbientLight('#ffffff', 0.2));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshStandardMaterial({ color: BRANDING.colors.surface, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.x = 0.9; floor.receiveShadow = true;
    this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.03, 8, 64), new THREE.MeshStandardMaterial({ color: BRANDING.colors.secondary, emissive: BRANDING.colors.secondary, emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0.9, 0.02, 0);
    this.scene.add(ring);
    this.engine.renderer.shadowMap.enabled = true;
    this.setAvatar(this.avatar, this.nickname);
    this.resize(window.innerWidth, window.innerHeight);
  }

  setAvatar(avatar: AvatarConfig, nickname: string): void {
    this.avatar = avatar; this.nickname = nickname;
    if (this.entity) { this.scene.remove(this.entity.root); this.entity.dispose(); }
    this.entity = new PlayerEntity(JSON.stringify(avatar), nickname, 'A');
    this.entity.root.position.set(0.9, 0, 0);
    this.scene.add(this.entity.root);
  }

  update(dt: number): void {
    this.t += dt;
    this.entity?.update(dt, { x: 0.9, y: 0, z: 0, yaw: Math.sin(this.t * 0.5) * 0.5 + 0.25, pitch: 0, speed: 0, grounded: true, crouching: false, alive: true, reloading: false, weaponId: '', hasBomb: false, team: 'A' });
  }
  render(renderer: THREE.WebGLRenderer): void { renderer.render(this.scene, this.camera); }
  resize(width: number, height: number): void { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
  dispose(): void { this.entity?.dispose(); this.scene.clear(); }
}
