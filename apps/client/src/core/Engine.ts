import * as THREE from 'three';
import type { GameScene } from './GameScene';

/**
 * Motor mínimo: renderer, bucle de juego con delta time fijo para lógica
 * (GAMEPLAY.tickRate en el servidor; aquí predicción a la misma tasa) y render
 * a la tasa del monitor.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly clock = new THREE.Clock();
  scene: GameScene | null = null;
  private running = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setScene(scene: GameScene): void {
    this.scene?.dispose();
    this.scene = scene;
    scene.init();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.scene?.update(dt);
    this.scene?.render(this.renderer);
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.scene?.resize(window.innerWidth, window.innerHeight);
  }
}
