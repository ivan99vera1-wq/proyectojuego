import { describe, it, expect } from 'vitest';
import { computeDamage } from './damage.js';
import { roundReward } from './economy.js';
import { ECONOMY } from '@game/config';

describe('damage', () => {
  it('headshot deals more than body shot', () => {
    const head = computeDamage('stg_44', 'head', 10, 0);
    const body = computeDamage('stg_44', 'body', 10, 0);
    expect(head.healthDamage).toBeGreaterThan(body.healthDamage);
    expect(head.headshot).toBe(true);
  });
  it('armor absorbs part of the damage', () => {
    const noArmor = computeDamage('tt_pistol', 'body', 5, 0);
    const armor = computeDamage('tt_pistol', 'body', 5, 100);
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
