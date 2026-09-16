import { DEFAULT_CONTROLS, type ControlAction } from '@game/config';

/**
 * Captura teclado/ratón y expone el estado por ACCIÓN (no por tecla), de modo
 * que reasignar controles solo toca la tabla de bindings.
 */
export class InputManager {
  private readonly down = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private bindings: Record<ControlAction, string> = { ...DEFAULT_CONTROLS };
  yaw = 0;
  pitch = 0;
  /** Desplazamiento de rueda acumulado desde el último frame. */
  wheel = 0;
  pointerLocked = false;
  /** Cuando es false (menú abierto) no se registran acciones de juego. */
  enabled = true;
  private sensitivity = 1;
  private invertY = false;
  /** Callback para teclas que la UI quiere interceptar (p. ej. Tab, Escape, chat). */
  onKeyDown: ((code: string, e: KeyboardEvent) => boolean | void) | null = null;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.onKeyDown?.(e.code, e) === true) { e.preventDefault(); return; }
      if (!this.enabled) return;
      this.down.add(e.code);
      this.pressedThisFrame.add(e.code);
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('mousedown', (e) => {
      if (!this.enabled || !this.pointerLocked) return;
      this.down.add(`Mouse${e.button}`);
      this.pressedThisFrame.add(`Mouse${e.button}`);
    });
    window.addEventListener('mouseup', (e) => this.down.delete(`Mouse${e.button}`));
    window.addEventListener('contextmenu', (e) => { if (this.pointerLocked) e.preventDefault(); });
    window.addEventListener('wheel', (e) => { if (this.pointerLocked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked || !this.enabled) return;
      const k = 0.0022 * this.sensitivity;
      this.yaw -= e.movementX * k;
      this.pitch += (this.invertY ? 1 : -1) * e.movementY * k;
      const limit = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.target;
      if (!this.pointerLocked) this.down.clear();
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  requestPointerLock(): void {
    if (this.pointerLocked) return;
    try { const r = this.target.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => undefined); } catch { /* no disponible (iframe, headless) */ }
  }
  exitPointerLock(): void {
    if (this.pointerLocked) { try { document.exitPointerLock(); } catch { /* ignore */ } }
  }

  isDown(action: ControlAction): boolean {
    return this.enabled && this.down.has(this.bindings[action]);
  }
  /** True solo en el frame en que se pulsó. */
  wasPressed(action: ControlAction): boolean {
    return this.enabled && this.pressedThisFrame.has(this.bindings[action]);
  }
  /** Llamar al final de cada frame. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.wheel = 0;
  }

  setBindings(b: Record<ControlAction, string>): void { this.bindings = { ...b }; }
  setSensitivity(s: number): void { this.sensitivity = s; }
  setInvertY(v: boolean): void { this.invertY = v; }
  clear(): void { this.down.clear(); this.pressedThisFrame.clear(); }
}
