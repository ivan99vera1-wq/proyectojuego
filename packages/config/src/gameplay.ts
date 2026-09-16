/**
 * Reglas de juego generales (movimiento, salud, tiempos, físicas).
 * Todas las unidades: metros, segundos, metros/segundo.
 */
export const GAMEPLAY = {
  /** Frecuencia de simulación del servidor (ticks por segundo). */
  tickRate: 30,
  /** Gravedad (m/s²). Negativo = hacia abajo. */
  gravity: -20,

  player: {
    maxHealth: 100,
    maxArmor: 100,
    /** Alto y radio de la cápsula de colisión. Chibi = bajito y cabezón. */
    capsuleHeight: 1.2,
    capsuleRadius: 0.35,
    /** Altura de los ojos (cámara en primera persona) respecto al suelo. */
    eyeHeight: 1.0,
    walkSpeed: 5.0,
    runSpeed: 7.0,
    crouchSpeed: 2.5,
    crouchHeightFactor: 0.6,
    jumpVelocity: 7.0,
    /** Aceleración en el aire (0 = sin control aéreo). */
    airControl: 0.3,
    /** Daño por caída: velocidad vertical a partir de la cual duele, y daño por m/s extra. */
    fallDamageThreshold: 12,
    fallDamagePerUnit: 6,
    /** Multiplicadores de daño por zona de impacto. */
    hitboxMultipliers: {
      head: 4.0,
      body: 1.0,
      limbs: 0.75,
    },
  },

  round: {
    /** Segundos de congelación al empezar la ronda (tiempo de compra). */
    freezeTime: 10,
    /** Duración de la ronda. */
    roundTime: 115,
    /** Tiempo tras terminar la ronda antes de la siguiente. */
    postRoundTime: 6,
    /** Segundos hasta que explota la bomba tras plantarla. */
    bombTimer: 40,
    plantTime: 3.5,
    defuseTime: 8,
    defuseTimeWithKit: 4,
  },

  match: {
    /** Rondas necesarias para ganar (formato MR12 → 13). */
    roundsToWin: 13,
    /** Ronda en la que se cambian los equipos de lado. */
    halftimeRound: 12,
    maxPlayersPerTeam: 5,
    /** Mínimo de jugadores para iniciar el calentamiento. */
    minPlayersToStart: 2,
    warmupTime: 20,
  },

  /** Rangos de nombres, límites de chat, etc. */
  limits: {
    nicknameMin: 3,
    nicknameMax: 16,
    chatMessageMax: 120,
  },
} as const;
