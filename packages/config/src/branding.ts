/**
 * =====================================================================
 *  MARCA / IDENTIDAD DEL JUEGO
 * =====================================================================
 *  Cambia aquí el nombre del juego y TODO el proyecto lo refleja:
 *  título de la pestaña, menú principal, ventana de escritorio, logs
 *  del servidor, metadatos de build, etc.
 *
 *  Regla del proyecto: NINGÚN otro archivo puede contener el nombre
 *  del juego escrito "a mano". Siempre se importa desde aquí.
 * =====================================================================
 */
export const BRANDING = {
  /** Nombre público del juego. */
  name: 'TinyStrike',
  /** Identificador técnico (sin espacios, minúsculas). Se usa en storage keys, nombres de sala, ids de app. */
  codename: 'tinystrike',
  /** Eslogan que aparece bajo el logo. */
  tagline: 'Tácticas grandes. Héroes pequeños.',
  /** Estudio / autor. */
  studio: 'Tu Estudio',
  /** Versión semántica que se muestra en el menú y en el handshake de red. */
  version: '0.1.0',
  /** Id de aplicación para escritorio (Electron / Steam). Formato dominio invertido. */
  appId: 'com.tuestudio.tinystrike',
  /** Enlaces públicos (dejar vacío si no existen todavía). */
  urls: {
    website: '',
    discord: '',
    support: '',
    privacy: '',
  },
  /** Colores de marca (hex). Se inyectan como variables CSS y en materiales de UI 3D. */
  colors: {
    primary: '#ff5c7a',
    secondary: '#37d0ff',
    accent: '#ffd23f',
    background: '#141626',
    surface: '#1f2237',
    text: '#f5f6fa',
    teamA: '#3a8dff',
    teamB: '#ff7a3a',
  },
  /** Nombres de los dos equipos (equivalente a CT / T). */
  teams: {
    A: { id: 'A', name: 'Guardianes', short: 'GRD' },
    B: { id: 'B', name: 'Saboteadores', short: 'SAB' },
  },
} as const;

export type TeamId = keyof typeof BRANDING.teams;
