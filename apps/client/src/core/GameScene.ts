import type * as THREE from 'three';

/** Contrato de una escena (menú, personalización, partida...). */
export interface GameScene {
  init(): void;
  update(dt: number): void;
  render(renderer: THREE.WebGLRenderer): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
