/**
 * Fases por las que pasa una sala.
 *
 *   bomb:      waiting → warmup → (freeze → live → postround)* → ended → waiting
 *   tdm / ffa: waiting → warmup → live → ended → waiting
 *
 * El cambio de lado a mitad de partida no es una fase: ocurre dentro de la
 * transición de ronda (RoundSystem.nextRound), sin parar el reloj.
 */
export type MatchPhase =
  | 'waiting'    // esperando jugadores
  | 'warmup'
  | 'freeze'     // tiempo de compra
  | 'live'
  | 'postround'
  | 'ended';

export type BombState = 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded' | 'none';

/** Resultado de una ronda. En modos sin equipos el ganador de la partida es un id de jugador. */
export type RoundWinner = 'A' | 'B' | 'draw';
