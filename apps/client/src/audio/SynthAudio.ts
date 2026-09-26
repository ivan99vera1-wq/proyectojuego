import { AUDIO, WEAPONS, type WeaponId } from '@game/config';

/** Duración de cada nota del arpegio del menú (ms). */
const NOTE_MS = 320;

/**
 * Audio sintetizado con WebAudio: no requiere archivos. Cuando existan los OGG
 * de AUDIO, sustituir cada `play*` por reproducción de buffer manteniendo la API.
 * Sonido 3D simplificado: atenuación por distancia + paneo estéreo por ángulo.
 */
export class SynthAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  listener = { x: 0, y: 0, z: 0, yaw: 0 };
  private musicTimer: ReturnType<typeof setTimeout> | null = null;

  /** Debe llamarse tras una interacción del usuario. */
  ensure(): AudioContext | null {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return this.ctx; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.master); this.musicGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
    return this.ctx;
  }

  setVolumes(master: number, sfx: number, music: number): void {
    if (!this.ctx) return;
    this.master.gain.value = master; this.sfxGain.gain.value = sfx; this.musicGain.gain.value = music * 0.35;
  }

  private spatial(pos?: { x: number; y: number; z: number }): { gain: number; pan: number } {
    if (!pos) return { gain: 1, pan: 0 };
    const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z, dy = pos.y - this.listener.y;
    const d = Math.hypot(dx, dy, dz);
    const { refDistance, maxDistance, rolloff } = AUDIO.spatial;
    const gain = d <= refDistance ? 1 : Math.max(0, 1 - ((d - refDistance) / (maxDistance - refDistance)) ** (1 / rolloff));
    // ángulo relativo a la mirada (yaw): derecha = +1
    const fx = -Math.sin(this.listener.yaw), fz = -Math.cos(this.listener.yaw);
    const rx = fz, rz = -fx;
    const pan = d > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    return { gain, pan };
  }

  private out(gain: number, pan: number, when: number, dur: number, dest = this.sfxGain): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const p = this.ctx!.createStereoPanner();
    p.pan.value = pan;
    g.connect(p); p.connect(dest);
    return g;
  }

  private noise(gain: number, dur: number, filterHz: number, pan = 0, type: BiquadFilterType = 'lowpass', pos?: { x: number; y: number; z: number }): void {
    const ctx = this.ensure(); if (!ctx || !this.noiseBuffer) return;
    const sp = this.spatial(pos);
    if (sp.gain <= 0.01) return;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterHz;
    src.connect(f); f.connect(this.out(gain * sp.gain, pan || sp.pan, ctx.currentTime, dur));
    src.start(); src.stop(ctx.currentTime + dur + 0.05);
  }

  private tone(freq: number, gain: number, dur: number, type: OscillatorType = 'sine', slideTo?: number, pos?: { x: number; y: number; z: number }): void {
    const ctx = this.ensure(); if (!ctx) return;
    const sp = this.spatial(pos);
    if (sp.gain <= 0.01) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    o.connect(this.out(gain * sp.gain, sp.pan, ctx.currentTime, dur));
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }

  gunshot(weaponId: string, pos?: { x: number; y: number; z: number }): void {
    const w = WEAPONS[weaponId as WeaponId];
    switch (w?.category) {
      case 'knife': this.noise(0.25, 0.08, 3000, 0, 'highpass', pos); break;
      case 'pistol': this.noise(0.5, 0.12, 1800, 0, 'lowpass', pos); this.tone(180, 0.25, 0.08, 'square', 60, pos); break;
      case 'smg': this.noise(0.4, 0.09, 2200, 0, 'lowpass', pos); this.tone(220, 0.15, 0.05, 'square', 80, pos); break;
      case 'rifle': this.noise(0.6, 0.16, 1500, 0, 'lowpass', pos); this.tone(140, 0.3, 0.1, 'square', 50, pos); break;
      case 'sniper': this.noise(0.9, 0.35, 900, 0, 'lowpass', pos); this.tone(90, 0.45, 0.25, 'sawtooth', 30, pos); break;
      case 'grenade': this.tone(500, 0.1, 0.08, 'triangle', 300, pos); break;
      default: this.noise(0.4, 0.1, 1500, 0, 'lowpass', pos);
    }
  }
  hit(): void { this.tone(1200, 0.25, 0.06, 'square', 900); }
  headshot(): void { this.tone(1800, 0.3, 0.12, 'sine', 2400); this.tone(2400, 0.2, 0.18, 'sine'); }
  damage(): void { this.noise(0.35, 0.2, 400); this.tone(120, 0.3, 0.2, 'sawtooth', 60); }
  kill(): void { this.tone(660, 0.25, 0.1, 'triangle'); this.tone(880, 0.25, 0.14, 'triangle'); this.tone(1320, 0.25, 0.22, 'triangle'); }
  footstep(pos?: { x: number; y: number; z: number }): void { this.noise(0.18, 0.07, 500, 0, 'lowpass', pos); }
  jump(): void { this.tone(300, 0.15, 0.12, 'sine', 500); }
  land(): void { this.noise(0.3, 0.1, 400); }
  reload(): void { this.tone(900, 0.12, 0.04, 'square'); setTimeout(() => this.tone(700, 0.12, 0.05, 'square'), 120); }
  empty(): void { this.tone(400, 0.12, 0.04, 'square'); }
  buy(): void { this.tone(880, 0.2, 0.1, 'sine'); this.tone(1320, 0.2, 0.2, 'sine'); }
  uiClick(): void { this.tone(600, 0.1, 0.04, 'square'); }
  uiHover(): void { this.tone(900, 0.04, 0.03, 'sine'); }
  bombBeep(pos?: { x: number; y: number; z: number }): void { this.tone(1100, 0.3, 0.08, 'square', undefined, pos); }
  bombPlanted(): void { this.tone(300, 0.3, 0.3, 'sawtooth', 150); }
  bombDefused(): void { this.tone(500, 0.3, 0.2, 'sine', 900); }
  explosion(pos?: { x: number; y: number; z: number }): void { this.noise(1.2, 0.9, 300, 0, 'lowpass', pos); this.tone(50, 0.6, 0.7, 'sawtooth', 20, pos); }
  roundWin(): void { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.25, 'triangle'), i * 120)); }
  roundLose(): void { [392, 349, 311, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.3, 'triangle'), i * 160)); }

  /** Música de menú: arpegio suave en bucle. */
  startMenuMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    const notes = [261.6, 329.6, 392.0, 523.3, 392.0, 329.6];
    let i = 0;
    const tick = (): void => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = notes[i % notes.length]!;
      o.connect(this.out(0.5, 0, ctx.currentTime, 0.5, this.musicGain));
      o.start();
      o.stop(ctx.currentTime + 0.55);
      i++;
      this.musicTimer = setTimeout(tick, NOTE_MS);
    };
    tick();
  }

  stopMusic(): void {
    if (this.musicTimer !== null) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }
}

export const audio = new SynthAudio();
