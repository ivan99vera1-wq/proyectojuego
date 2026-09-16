/** Rutas de audio relativas a /assets/audio/. */
export const AUDIO = {
  music: {
    menu: 'music/menu.ogg',
    roundStart: 'music/round_start.ogg',
    victory: 'music/victory.ogg',
    defeat: 'music/defeat.ogg',
  },
  sfx: {
    footstep: 'sfx/footstep.ogg',
    jump: 'sfx/jump.ogg',
    land: 'sfx/land.ogg',
    hit: 'sfx/hit.ogg',
    headshot: 'sfx/headshot.ogg',
    death: 'sfx/death.ogg',
    bombPlant: 'sfx/bomb_plant.ogg',
    bombBeep: 'sfx/bomb_beep.ogg',
    bombExplode: 'sfx/bomb_explode.ogg',
    bombDefused: 'sfx/bomb_defused.ogg',
    buy: 'sfx/buy.ogg',
    uiClick: 'sfx/ui_click.ogg',
    uiHover: 'sfx/ui_hover.ogg',
  },
  /** Distancias de atenuación 3D (m). */
  spatial: { refDistance: 2, maxDistance: 60, rolloff: 1.2 },
} as const;
