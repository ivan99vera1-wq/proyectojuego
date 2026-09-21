import { describe, it, expect } from 'vitest';
import { CONFIG, CHARACTERS, DEFAULT_CHARACTER, WEAPONS, MAPS, GAME_MODES, ANIMATION_CLIPS } from './index.js';

describe('config integrity', () => {
  it('branding has a non-empty name and codename', () => {
    expect(CONFIG.branding.name.length).toBeGreaterThan(0);
    // El codename se usa como clave de almacenamiento y como id de aplicación,
    // así que no admite mayúsculas ni espacios.
    expect(CONFIG.branding.codename).toMatch(/^[a-z0-9-]+$/);
  });

  it('there is exactly one playable character and it points to a model', () => {
    const ids = Object.keys(CHARACTERS);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe(DEFAULT_CHARACTER);
    expect(CHARACTERS[DEFAULT_CHARACTER].baseModel).toMatch(/\.glb$/);
  });

  it('every animation clip has a non-empty name', () => {
    for (const [key, name] of Object.entries(ANIMATION_CLIPS)) {
      expect(name.length, key).toBeGreaterThan(0);
    }
  });

  it('weapon ids match keys and prices are non-negative', () => {
    for (const [key, w] of Object.entries(WEAPONS)) {
      expect(w.id).toBe(key);
      expect(w.price).toBeGreaterThanOrEqual(0);
    }
  });

  it('every map references only existing modes', () => {
    for (const map of Object.values(MAPS)) {
      for (const mode of map.modes) expect(GAME_MODES).toHaveProperty(mode);
    }
  });

  it('every mode needs at least one player to start', () => {
    for (const mode of Object.values(GAME_MODES)) {
      expect(mode.minPlayers, mode.id).toBeGreaterThanOrEqual(1);
    }
  });
});
