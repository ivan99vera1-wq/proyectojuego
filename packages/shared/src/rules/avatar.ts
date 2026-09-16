import { COSMETICS, DEFAULT_AVATAR, CHARACTERS, COLOR_CHANNELS, BODY_SLIDERS, REQUIRED_SLOTS } from '@game/config';
import type { AvatarConfig } from '../types/avatar.js';

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Valida y sanea un avatar recibido del cliente. Nunca confíes en el cliente:
 * el servidor llama a esto antes de aceptar un SetAvatar.
 * Devuelve un avatar válido (rellenando con valores por defecto lo inválido).
 */
export function sanitizeAvatar(input: unknown): AvatarConfig {
  const base = structuredClone(DEFAULT_AVATAR) as unknown as AvatarConfig;
  if (!input || typeof input !== 'object') return base;
  const a = input as Partial<AvatarConfig>;

  if (a.character && a.character in CHARACTERS) base.character = a.character;

  if (a.items && typeof a.items === 'object') {
    for (const slot of Object.keys(base.items) as (keyof typeof base.items)[]) {
      const id = a.items[slot];
      const item = id ? COSMETICS[id] : undefined;
      if (item && item.slot === slot) base.items[slot] = id!;
    }
  }
  for (const slot of REQUIRED_SLOTS) {
    if (COSMETICS[base.items[slot]].model === '') base.items[slot] = DEFAULT_AVATAR.items[slot];
  }

  if (a.colors && typeof a.colors === 'object') {
    for (const ch of Object.keys(COLOR_CHANNELS) as (keyof typeof COLOR_CHANNELS)[]) {
      const c = a.colors[ch];
      if (typeof c === 'string' && HEX.test(c)) base.colors[ch] = c;
    }
  }

  if (a.sliders && typeof a.sliders === 'object') {
    for (const s of Object.keys(BODY_SLIDERS) as (keyof typeof BODY_SLIDERS)[]) {
      const v = a.sliders[s];
      const def = BODY_SLIDERS[s];
      if (typeof v === 'number' && Number.isFinite(v)) base.sliders[s] = Math.min(def.max, Math.max(def.min, v));
    }
  }
  return base;
}

/** Serializa el avatar a una cadena compacta para sincronizar por red. */
export const encodeAvatar = (a: AvatarConfig): string => JSON.stringify(a);
export const decodeAvatar = (s: string): AvatarConfig => {
  try { return sanitizeAvatar(JSON.parse(s)); } catch { return sanitizeAvatar(undefined); }
};
