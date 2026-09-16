import { GAMEPLAY, WEAPONS, type WeaponId } from '@game/config';

export type HitZone = keyof typeof GAMEPLAY.player.hitboxMultipliers;

export interface DamageResult {
  healthDamage: number;
  armorDamage: number;
  headshot: boolean;
}

/**
 * Calcula el daño de un impacto. Función pura: la usan el servidor (autoridad)
 * y el cliente (predicción de hitmarker).
 */
export function computeDamage(
  weaponId: WeaponId,
  zone: HitZone,
  distance: number,
  targetArmor: number,
): DamageResult {
  const w = WEAPONS[weaponId];
  const zoneMult = GAMEPLAY.player.hitboxMultipliers[zone];
  const extra = Math.max(0, distance - w.range);
  const falloff = Math.max(0, 1 - extra * w.damageFalloff);
  let raw = w.damage * zoneMult * falloff;

  let armorDamage = 0;
  if (targetArmor > 0) {
    const absorbed = raw * (1 - w.armorPenetration);
    armorDamage = Math.min(targetArmor, absorbed);
    raw -= armorDamage;
  }
  return { healthDamage: Math.round(raw), armorDamage: Math.round(armorDamage), headshot: zone === 'head' };
}
