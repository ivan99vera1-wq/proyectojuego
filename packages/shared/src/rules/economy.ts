import { ECONOMY } from '@game/config';

/** Dinero que recibe un equipo al terminar la ronda. */
export function roundReward(won: boolean, consecutiveLosses: number): number {
  if (won) return ECONOMY.roundWin;
  const bonus = Math.min(ECONOMY.roundLossMaxBonus - ECONOMY.roundLossBase, consecutiveLosses * ECONOMY.roundLossIncrement);
  return ECONOMY.roundLossBase + bonus;
}

export const clampMoney = (m: number): number => Math.max(0, Math.min(ECONOMY.maxMoney, m));
