/** Economía por ronda (estilo CS). */
export const ECONOMY = {
  startingMoney: 800,
  maxMoney: 16000,
  /** Recompensa por ganar la ronda. */
  roundWin: 3250,
  /** Recompensa por perder; se incrementa por cada derrota seguida hasta el máximo. */
  roundLossBase: 1400,
  roundLossIncrement: 500,
  roundLossMaxBonus: 3400,
  /** Bonus por plantar / desactivar la bomba. */
  bombPlant: 300,
  bombDefuse: 300,
  /** Bonus adicional al equipo que gana por explosión de bomba. */
  bombExplodeWinBonus: 250,
} as const;
