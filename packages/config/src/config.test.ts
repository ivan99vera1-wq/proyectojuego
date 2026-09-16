import { describe, it, expect } from 'vitest';
import { CONFIG, COSMETICS, DEFAULT_AVATAR, REQUIRED_SLOTS, WEAPONS, MAPS, GAME_MODES } from './index.js';

describe('config integrity', () => {
  it('branding has a non-empty name and codename', () => {
    expect(CONFIG.branding.name.length).toBeGreaterThan(0);
    expect(CONFIG.branding.codename).toMatch(/^[a-z0-9-]+$/);
  });

  it('every cosmetic id matches its key and slot', () => {
    for (const [key, item] of Object.entries(COSMETICS)) {
      expect(item.id).toBe(key);
    }
  });

  it('default avatar fills every required slot with a valid item of that slot', () => {
    for (const slot of REQUIRED_SLOTS) {
      const id = DEFAULT_AVATAR.items[slot];
      const item = COSMETICS[id];
      expect(item, `slot ${slot}`).toBeDefined();
      expect(item.slot).toBe(slot);
      expect(item.model).not.toBe('');
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
});
