import { describe, it, expect } from 'vitest';
import { computeDamage } from './damage.js';
import { roundReward } from './economy.js';
import { sanitizeAvatar } from './avatar.js';
import { DEFAULT_AVATAR, ECONOMY } from '@game/config';

describe('damage', () => {
  it('headshot deals more than body shot', () => {
    const head = computeDamage('rifle_star', 'head', 10, 0);
    const body = computeDamage('rifle_star', 'body', 10, 0);
    expect(head.healthDamage).toBeGreaterThan(body.healthDamage);
    expect(head.headshot).toBe(true);
  });
  it('armor absorbs part of the damage', () => {
    const noArmor = computeDamage('pistol_basic', 'body', 5, 0);
    const armor = computeDamage('pistol_basic', 'body', 5, 100);
    expect(armor.healthDamage).toBeLessThan(noArmor.healthDamage);
    expect(armor.armorDamage).toBeGreaterThan(0);
  });
});

describe('economy', () => {
  it('loss bonus is capped', () => {
    expect(roundReward(false, 100)).toBe(ECONOMY.roundLossMaxBonus);
    expect(roundReward(true, 0)).toBe(ECONOMY.roundWin);
  });
});

describe('avatar sanitization', () => {
  it('rejects wrong-slot items and bad colors', () => {
    const a = sanitizeAvatar({ items: { hair: 'top_hoodie' }, colors: { skin: 'red' } });
    expect(a.items.hair).toBe(DEFAULT_AVATAR.items.hair);
    expect(a.colors.skin).toBe(DEFAULT_AVATAR.colors.skin);
  });
  it('accepts valid customizations', () => {
    const a = sanitizeAvatar({ character: 'recruit', items: { hair: 'hair_spiky' }, colors: { hair: '#ff0000' }, sliders: { headSize: 5 } });
    expect(a.character).toBe('recruit');
    expect(a.items.hair).toBe('hair_spiky');
    expect(a.colors.hair).toBe('#ff0000');
    expect(a.sliders.headSize).toBe(1.0);
  });
});
