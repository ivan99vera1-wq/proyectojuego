import * as THREE from 'three';
import { BRANDING, GAMEPLAY } from '@game/config';
import type { Engine } from '../core/Engine';
import type { GameScene } from '../core/GameScene';

/**
 * Escena de arranque (placeholder de Fase 1).
 * Dibuja un "chibi" hecho de primitivas con las proporciones de GAMEPLAY.player
 * para validar que renderer, config y bucle funcionan.
 */
export class BootScene implements GameScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  private chibi = new THREE.Group();

  constructor(private readonly engine: Engine) {}

  init(): void {
    this.scene.background = new THREE.Color(BRANDING.colors.background);
    this.camera.position.set(0, 1.4, 3.5);
    this.camera.lookAt(0, 0.7, 0);

    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    this.scene.add(sun, new THREE.HemisphereLight(0xbfd8ff, 0x3a2a40, 1.2));

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3, 48),
      new THREE.MeshStandardMaterial({ color: BRANDING.colors.surface }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.chibi = this.buildPlaceholderChibi();
    this.scene.add(this.chibi);
    this.resize(window.innerWidth, window.innerHeight);
  }

  private buildPlaceholderChibi(): THREE.Group {
    const g = new THREE.Group();
    const { capsuleHeight, capsuleRadius } = GAMEPLAY.player;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(capsuleRadius * 0.8, capsuleHeight * 0.45, 8, 16),
      new THREE.MeshStandardMaterial({ color: BRANDING.colors.primary }),
    );
    body.position.y = capsuleHeight * 0.45;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(capsuleRadius * 1.25, 24, 24),
      new THREE.MeshStandardMaterial({ color: '#f6d3b8' }),
    );
    head.position.y = capsuleHeight * 0.45 + capsuleRadius * 0.8 + capsuleRadius;
    const eyeMat = new THREE.MeshStandardMaterial({ color: BRANDING.colors.secondary });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), eyeMat);
      eye.position.set(sx * 0.15, head.position.y + 0.05, capsuleRadius * 1.15);
      g.add(eye);
    }
    body.castShadow = head.castShadow = true;
    g.add(body, head);
    return g;
  }

  update(dt: number): void {
    this.chibi.rotation.y += dt * 0.8;
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.scene.clear();
  }
}
