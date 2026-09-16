/**
 * Personajes base (arquetipos chibi). No dan ventajas de juego, solo estética
 * y set de animaciones/voz por defecto. Las diferencias visuales vienen de
 * customization.ts.
 */
export interface CharacterArchetype {
  id: string;
  displayName: string;
  description: string;
  /** Modelo base (rig chibi) en /assets/models/characters/. */
  baseModel: string;
  /** Set de voz en /assets/audio/voices/<voiceSet>/. */
  voiceSet: string;
  /** Escala global del personaje (1 = estándar). */
  scale: number;
  /** Proporción cabeza/cuerpo típica chibi (afecta solo al modelo, no a la hitbox). */
  headScale: number;
}

export const CHARACTERS = {
  spark: {
    id: 'spark', displayName: 'Spark', description: 'Enérgica, rápida y con mucho cabello.',
    baseModel: 'chibi_base.glb', voiceSet: 'spark', scale: 1.0, headScale: 1.25,
  },
  bolt: {
    id: 'bolt', displayName: 'Bolt', description: 'Tranquilo, robusto y con gafas.',
    baseModel: 'chibi_base.glb', voiceSet: 'bolt', scale: 1.0, headScale: 1.2,
  },
  pixel: {
    id: 'pixel', displayName: 'Pixel', description: 'Curiosa, gamer y siempre con audífonos.',
    baseModel: 'chibi_base.glb', voiceSet: 'pixel', scale: 0.95, headScale: 1.3,
  },
  mochi: {
    id: 'mochi', displayName: 'Mochi', description: 'Adorable, redondito y sorprendentemente letal.',
    baseModel: 'chibi_base.glb', voiceSet: 'mochi', scale: 0.9, headScale: 1.35,
  },
} as const satisfies Record<string, CharacterArchetype>;

export type CharacterId = keyof typeof CHARACTERS;
export const DEFAULT_CHARACTER: CharacterId = 'spark';

/** Nombres de clips de animación que el rig chibi DEBE contener. */
export const ANIMATION_CLIPS = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  crouchIdle: 'CrouchIdle',
  crouchWalk: 'CrouchWalk',
  jump: 'Jump',
  fall: 'Fall',
  land: 'Land',
  fire: 'Fire',
  reload: 'Reload',
  plant: 'Plant',
  defuse: 'Defuse',
  death: 'Death',
  emote1: 'Emote_Dance',
  emote2: 'Emote_Wave',
} as const;
