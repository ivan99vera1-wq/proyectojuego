/** Controles por defecto (código de KeyboardEvent.code / botones de ratón). Reasignables desde ajustes. */
export const DEFAULT_CONTROLS = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  sprint: 'ShiftLeft',
  reload: 'KeyR',
  interact: 'KeyE',
  buyMenu: 'KeyB',
  scoreboard: 'Tab',
  primaryWeapon: 'Digit1',
  secondaryWeapon: 'Digit2',
  melee: 'Digit3',
  grenade: 'Digit4',
  chat: 'KeyT',
  teamChat: 'KeyY',
  emote: 'KeyG',
  /** Alterna entre primera y tercera persona. */
  toggleCamera: 'KeyV',
  fire: 'Mouse0',
  aim: 'Mouse2',
} as const;
export type ControlAction = keyof typeof DEFAULT_CONTROLS;

export const DEFAULT_SETTINGS = {
  mouseSensitivity: 1.0,
  invertY: false,
  fov: 80,
  /** Calidad gráfica: 'low' | 'medium' | 'high'. */
  graphicsQuality: 'medium',
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 1.0,
  voiceVolume: 1.0,
  showFps: false,
  /** Cámara en tercera persona (se alterna en partida con la tecla de cámara). */
  thirdPerson: false,
  language: 'es',
} as const;
