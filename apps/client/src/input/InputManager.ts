import { DEFAULT_CONTROLS, type ControlAction } from '@game/config';

/**
 * Captura teclado/ratón y expone el estado por ACCIÓN (no por tecla), de modo
 * que reasignar controles solo toca la tabla de bindings.
 */
export class InputManager {
  private readonly down = new Set<string>();
  private bindings: Record<ControlAction, string> = { ...DEFAULT_CONTROLS };
  yaw = 0;
  pitch = 0;
  private pointerLocked = false;

  constructor(private readonly target: HTMLElement, private sensitivity = 1) {
    window.addEventListener('keydown', (e) => this.down.add(e.code));
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('mousedown', (e) => this.down.add(`Mouse${e.button}`));
    window.addEventListener('mouseup', (e) => this.down.delete(`Mouse${e.button}`));
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.yaw -= e.movementX * 0.002 * this.sensitivity;
      this.pitch -= e.movementY * 0.002 * this.sensitivity;
      const limit = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.target;
    });
  }

  requestPointerLock(): void {
    this.target.requestPointerLock();
  }

  isDown(action: ControlAction): boolean {
    return this.down.has(this.bindings[action]);
  }

  rebind(action: ControlAction, code: string): void {
    this.bindings[action] = code;
  }

  setSensitivity(s: number): void {
    this.sensitivity = s;
  }
}
