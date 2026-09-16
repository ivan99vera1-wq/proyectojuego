import { BRANDING, DEFAULT_CONTROLS, DEFAULT_SETTINGS, type ControlAction } from '@game/config';

export interface SettingsData {
  mouseSensitivity: number;
  invertY: boolean;
  fov: number;
  graphicsQuality: 'low' | 'medium' | 'high';
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  showFps: boolean;
  language: string;
  nickname: string;
  bindings: Record<ControlAction, string>;
}

const KEY = `${BRANDING.codename}:settings`;

function defaults(): SettingsData {
  return { ...DEFAULT_SETTINGS, nickname: '', bindings: { ...DEFAULT_CONTROLS } } as SettingsData;
}

/** Ajustes del jugador persistidos en localStorage. */
export class Settings {
  data: SettingsData = defaults();
  private readonly listeners = new Set<(s: SettingsData) => void>();

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsData>;
        this.data = { ...defaults(), ...parsed, bindings: { ...DEFAULT_CONTROLS, ...(parsed.bindings ?? {}) } };
      }
    } catch { /* storage no disponible */ }
  }

  save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
    for (const l of this.listeners) l(this.data);
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    this.save();
  }

  onChange(fn: (s: SettingsData) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  resetBindings(): void {
    this.data.bindings = { ...DEFAULT_CONTROLS };
    this.save();
  }
}

export const settings = new Settings();
