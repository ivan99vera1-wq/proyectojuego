/**
 * =====================================================================
 *  PERSONAJE BASE
 * =====================================================================
 *  TinyStrike tiene UN SOLO personaje jugable. Todos los jugadores usan
 *  este cuerpo y construyen su identidad con `customization.ts`.
 *
 *  Aquí NO hay escalas por personaje a propósito: dos jugadores nunca
 *  pueden tener siluetas de distinto tamaño, porque comparten la misma
 *  hitbox. Las proporciones las reparten los sliders del avatar, siempre
 *  dentro de la altura de la cápsula de juego.
 * =====================================================================
 */
export interface CharacterBase {
  id: string;
  displayName: string;
  description: string;
  /** Modelo base cuando exista arte GLB (hoy el cuerpo es procedural). */
  baseModel: string;
  /** Set de voz en /assets/audio/voices/<voiceSet>/. */
  voiceSet: string;
}

export const CHARACTERS = {
  recruit: {
    id: 'recruit',
    displayName: 'Recluta',
    description: 'El operativo chibi de TinyStrike. Hazlo tuyo en el vestidor.',
    baseModel: 'chibi_base.glb',
    voiceSet: 'recruit',
  },
} as const satisfies Record<string, CharacterBase>;

export type CharacterId = keyof typeof CHARACTERS;
export const DEFAULT_CHARACTER: CharacterId = 'recruit';
/** Atajo al único personaje base. */
export const BASE_CHARACTER = CHARACTERS.recruit;

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
