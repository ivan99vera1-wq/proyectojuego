export type MatchPhase =
  | 'waiting'    // esperando jugadores
  | 'warmup'
  | 'freeze'     // tiempo de compra
  | 'live'
  | 'postround'
  | 'halftime'
  | 'ended';

export type BombState = 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded' | 'none';
