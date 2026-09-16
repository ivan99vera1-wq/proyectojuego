/**
 * =====================================================================
 *  @game/config — PUNTO ÚNICO DE CONFIGURACIÓN
 * =====================================================================
 *  Todo lo que un diseñador o el dueño del proyecto querría tocar sin
 *  entender el motor está en esta carpeta:
 *
 *    branding.ts        → nombre, eslogan, versión, colores, equipos
 *    gameplay.ts        → salud, velocidad, tiempos de ronda, físicas
 *    weapons.ts         → armas y equipamiento
 *    economy.ts         → dinero por ronda
 *    characters.ts      → arquetipos chibi y clips de animación
 *    customization.ts   → slots, cosméticos, colores, sliders
 *    maps.ts            → mapas
 *    modes.ts           → modos de juego
 *    network.ts         → tick, puertos, protocolo
 *    controls.ts        → teclas y ajustes por defecto
 *    audio.ts           → rutas de audio
 *    ui.ts              → textos (i18n) y HUD
 *
 *  Cliente, servidor y escritorio importan SOLO de aquí.
 * =====================================================================
 */
export * from './branding.js';
export * from './gameplay.js';
export * from './weapons.js';
export * from './economy.js';
export * from './characters.js';
export * from './customization.js';
export * from './maps.js';
export * from './modes.js';
export * from './network.js';
export * from './controls.js';
export * from './audio.js';
export * from './ui.js';

import { BRANDING } from './branding.js';
import { GAMEPLAY } from './gameplay.js';
import { WEAPONS, EQUIPMENT, DEFAULT_LOADOUT } from './weapons.js';
import { ECONOMY } from './economy.js';
import { CHARACTERS, ANIMATION_CLIPS } from './characters.js';
import { COSMETICS, DEFAULT_AVATAR, COLOR_CHANNELS, BODY_SLIDERS } from './customization.js';
import { MAPS } from './maps.js';
import { GAME_MODES } from './modes.js';
import { NETWORK } from './network.js';
import { DEFAULT_CONTROLS, DEFAULT_SETTINGS } from './controls.js';
import { AUDIO } from './audio.js';
import { UI } from './ui.js';

/** Objeto agregado por comodidad (útil para volcar la config completa en debug). */
export const CONFIG = {
  branding: BRANDING,
  gameplay: GAMEPLAY,
  weapons: WEAPONS,
  equipment: EQUIPMENT,
  defaultLoadout: DEFAULT_LOADOUT,
  economy: ECONOMY,
  characters: CHARACTERS,
  animationClips: ANIMATION_CLIPS,
  cosmetics: COSMETICS,
  defaultAvatar: DEFAULT_AVATAR,
  colorChannels: COLOR_CHANNELS,
  bodySliders: BODY_SLIDERS,
  maps: MAPS,
  modes: GAME_MODES,
  network: NETWORK,
  controls: DEFAULT_CONTROLS,
  settings: DEFAULT_SETTINGS,
  audio: AUDIO,
  ui: UI,
} as const;
