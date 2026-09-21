/**
 * =====================================================================
 *  PERSONAJE JUGABLE
 * =====================================================================
 *  ChibiStrike tiene UN SOLO personaje. Todos los jugadores usan el
 *  mismo cuerpo, así que nadie es más difícil de acertar que otro: la
 *  silueta visible y la hitbox son las mismas para todos.
 *
 *  El modelo se prepara en `assets/blender` a partir del archivo fuente
 *  y se exporta a `assets/models/characters/character.glb`. Cómo, en
 *  docs/PERSONAJE.md.
 * =====================================================================
 */
export interface CharacterBase {
  id: string;
  displayName: string;
  description: string;
  /** Archivo del modelo en /assets/models/characters/. */
  baseModel: string;
  /** Set de voz en /assets/audio/voices/<voiceSet>/. */
  voiceSet: string;
}

export const CHARACTERS = {
  caveman: {
    id: 'caveman',
    displayName: 'Cavernícola',
    description: 'Pequeño, rápido y con muy malas ideas.',
    baseModel: 'character.glb',
    voiceSet: 'caveman',
  },
} as const satisfies Record<string, CharacterBase>;

export type CharacterId = keyof typeof CHARACTERS;
export const DEFAULT_CHARACTER: CharacterId = 'caveman';
/** Atajo al único personaje. */
export const BASE_CHARACTER = CHARACTERS.caveman;

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
  aim: 'Aim',
  fire: 'Fire',
  reload: 'Reload',
  plant: 'Plant',
  defuse: 'Defuse',
  death: 'Death',
  emote1: 'Emote_Dance',
  emote2: 'Emote_Wave',
} as const;
