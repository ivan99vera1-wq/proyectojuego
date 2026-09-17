import * as THREE from 'three';
import { BRANDING } from '@game/config';
import type { AvatarConfig } from '@game/shared';
import type { Engine } from '../core/Engine.js';
import type { GameScene } from '../core/GameScene.js';
import { PlayerEntity } from '../entities/PlayerEntity.js';

/** Vestidor: el chibi en el centro, cámara orbital con arrastre y rueda. */
export class CustomizationScene implements GameScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private entity: PlayerEntity | null = null;
  private yaw = 0.4;
  private pitch = 0.15;
  private dist = 2.6;
  private dragging = false;
  private emoteT = 0;

  constructor(private readonly engine: Engine, private avatar: AvatarConfig) {}

  init(): void {
    this.scene.background = new THREE.Color(BRANDING.colors.background);
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(3, 6, 4); sun.castShadow = true;
    this.scene.add(sun, new THREE.HemisphereLight('#cfe5ff', '#3a2a40', 1.3), new THREE.AmbientLight('#ffffff', 0.25));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshStandardMaterial({ color: BRANDING.colors.surface, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.scene.add(floor);
    this.setAvatar(this.avatar);
    const c = this.engine.canvas;
    c.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    window.addEventListener('mousemove', this.onMove);
    c.addEventListener('wheel', this.onWheel, { passive: true });
    this.resize(window.innerWidth, window.innerHeight);
  }

  private onDown = (): void => { this.dragging = true; };
  private onUp = (): void => { this.dragging = false; };
  private onMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    this.yaw -= e.movementX * 0.01;
    this.pitch = Math.max(-0.4, Math.min(1.0, this.pitch + e.movementY * 0.006));
  };
  private onWheel = (e: WheelEvent): void => { this.dist = Math.max(1.6, Math.min(5, this.dist + Math.sign(e.deltaY) * 0.25)); };

  setAvatar(avatar: AvatarConfig): void {
    this.avatar = avatar;
    if (this.entity) { this.scene.remove(this.entity.root); this.entity.dispose(); }
    this.entity = new PlayerEntity(JSON.stringify(avatar), '', 'A');
    this.entity.setNameTag(' ', 'A');
    this.scene.add(this.entity.root);
  }

  playEmote(kind: number): void { this.entity?.playEmote(kind); this.emoteT = 1.6; }

  update(dt: number): void {
    const target = new THREE.Vector3(0, 0.62, 0);
    // El personaje mira hacia -Z (la dirección de avance del juego), así que
    // la cámara frontal va en el lado -Z.
    this.camera.position.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist,
      target.y + Math.sin(this.pitch) * this.dist,
      -Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist,
    );
    this.camera.lookAt(target);
    // El panel ocupa la derecha: se desplaza la cámara sobre su propio eje X
    // para dejar al personaje en el tercio izquierdo desde cualquier ángulo.
    this.camera.translateX(0.44);
    this.entity?.update(dt, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0, grounded: true, crouching: false, alive: true, reloading: false, weaponId: '', hasBomb: false, team: 'A' });
  }
  render(renderer: THREE.WebGLRenderer): void { renderer.render(this.scene, this.camera); }
  resize(width: number, height: number): void { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
  dispose(): void {
    const c = this.engine.canvas;
    c.removeEventListener('mousedown', this.onDown); window.removeEventListener('mouseup', this.onUp);
    window.removeEventListener('mousemove', this.onMove); c.removeEventListener('wheel', this.onWheel);
    this.entity?.dispose(); this.scene.clear();
  }
}
