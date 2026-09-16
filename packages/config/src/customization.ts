/**
 * =====================================================================
 *  SISTEMA DE PERSONALIZACIÓN
 * =====================================================================
 *  Un avatar = arquetipo + un item por SLOT + paleta de colores.
 *  Cada item es una pieza GLB modular que se "engancha" al rig chibi.
 *  Para añadir cosméticos: agrega entradas aquí y sus GLB en
 *  apps/client/public/assets/models/cosmetics/<slot>/<id>.glb
 * =====================================================================
 */
export type CosmeticSlot =
  | 'hair'
  | 'eyes'
  | 'face'      // expresión / rasgos
  | 'headwear'
  | 'eyewear'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'back'      // mochilas, capas, alas
  | 'hands'     // guantes
  | 'accessory' // colgantes, cintas
  | 'weaponSkin'
  | 'trail'     // efecto al correr
  | 'killEffect';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  displayName: string;
  rarity: Rarity;
  /** Archivo GLB (o '' para "nada"). */
  model: string;
  /** Si el item admite recolor por parte del jugador. */
  recolorable: boolean;
  /** Precio en moneda blanda (0 = gratis / desbloqueado por defecto). */
  price: number;
  /** Etiquetas para filtrar en la UI. */
  tags: readonly string[];
}

/** Slots que SIEMPRE deben tener un valor (no admiten "vacío"). */
export const REQUIRED_SLOTS: readonly CosmeticSlot[] = ['hair', 'eyes', 'face', 'top', 'bottom', 'shoes'];

/** Canales de color que el jugador puede editar libremente (hex). */
export const COLOR_CHANNELS = {
  skin: { label: 'Piel', default: '#f6d3b8', presets: ['#f6d3b8', '#e8b591', '#c68642', '#8d5524', '#5c3a21'] },
  hair: { label: 'Cabello', default: '#3b2a20', presets: ['#3b2a20', '#f5e1a4', '#c0392b', '#2c3e50', '#ff5c7a', '#37d0ff', '#ffffff'] },
  eyes: { label: 'Ojos', default: '#4a90e2', presets: ['#4a90e2', '#27ae60', '#8e44ad', '#e67e22', '#2c3e50'] },
  primary: { label: 'Color principal', default: '#ff5c7a', presets: [] },
  secondary: { label: 'Color secundario', default: '#37d0ff', presets: [] },
} as const;
export type ColorChannel = keyof typeof COLOR_CHANNELS;

/** Sliders de forma (morph targets del rig chibi). Rango normalizado 0..1. */
export const BODY_SLIDERS = {
  headSize: { label: 'Tamaño de cabeza', default: 0.5, min: 0.3, max: 1.0 },
  eyeSize: { label: 'Tamaño de ojos', default: 0.5, min: 0.2, max: 1.0 },
  bodyWidth: { label: 'Ancho de cuerpo', default: 0.5, min: 0.3, max: 0.8 },
  height: { label: 'Altura', default: 0.5, min: 0.4, max: 0.7 },
} as const;
export type BodySlider = keyof typeof BODY_SLIDERS;

export const COSMETICS = {
  // ---- hair ----
  hair_spiky: { id: 'hair_spiky', slot: 'hair', displayName: 'Puntas', rarity: 'common', model: 'hair/hair_spiky.glb', recolorable: true, price: 0, tags: ['starter'] },
  hair_bob: { id: 'hair_bob', slot: 'hair', displayName: 'Bob', rarity: 'common', model: 'hair/hair_bob.glb', recolorable: true, price: 0, tags: ['starter'] },
  hair_ponytail: { id: 'hair_ponytail', slot: 'hair', displayName: 'Coleta', rarity: 'common', model: 'hair/hair_ponytail.glb', recolorable: true, price: 0, tags: ['starter'] },
  hair_afro: { id: 'hair_afro', slot: 'hair', displayName: 'Afro', rarity: 'rare', model: 'hair/hair_afro.glb', recolorable: true, price: 400, tags: [] },
  // ---- eyes ----
  eyes_round: { id: 'eyes_round', slot: 'eyes', displayName: 'Redondos', rarity: 'common', model: 'eyes/eyes_round.glb', recolorable: true, price: 0, tags: ['starter'] },
  eyes_sharp: { id: 'eyes_sharp', slot: 'eyes', displayName: 'Afilados', rarity: 'common', model: 'eyes/eyes_sharp.glb', recolorable: true, price: 0, tags: ['starter'] },
  eyes_star: { id: 'eyes_star', slot: 'eyes', displayName: 'Estrella', rarity: 'epic', model: 'eyes/eyes_star.glb', recolorable: true, price: 900, tags: [] },
  // ---- face ----
  face_neutral: { id: 'face_neutral', slot: 'face', displayName: 'Neutral', rarity: 'common', model: 'face/face_neutral.glb', recolorable: false, price: 0, tags: ['starter'] },
  face_smile: { id: 'face_smile', slot: 'face', displayName: 'Sonrisa', rarity: 'common', model: 'face/face_smile.glb', recolorable: false, price: 0, tags: ['starter'] },
  face_freckles: { id: 'face_freckles', slot: 'face', displayName: 'Pecas', rarity: 'rare', model: 'face/face_freckles.glb', recolorable: false, price: 300, tags: [] },
  // ---- headwear ----
  headwear_none: { id: 'headwear_none', slot: 'headwear', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  headwear_beanie: { id: 'headwear_beanie', slot: 'headwear', displayName: 'Gorro', rarity: 'common', model: 'headwear/beanie.glb', recolorable: true, price: 250, tags: [] },
  headwear_cat_ears: { id: 'headwear_cat_ears', slot: 'headwear', displayName: 'Orejas de gato', rarity: 'epic', model: 'headwear/cat_ears.glb', recolorable: true, price: 1200, tags: ['cute'] },
  headwear_helmet_tactical: { id: 'headwear_helmet_tactical', slot: 'headwear', displayName: 'Casco táctico', rarity: 'rare', model: 'headwear/helmet_tactical.glb', recolorable: true, price: 600, tags: ['military'] },
  // ---- eyewear ----
  eyewear_none: { id: 'eyewear_none', slot: 'eyewear', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  eyewear_round: { id: 'eyewear_round', slot: 'eyewear', displayName: 'Gafas redondas', rarity: 'common', model: 'eyewear/round.glb', recolorable: true, price: 200, tags: [] },
  eyewear_visor: { id: 'eyewear_visor', slot: 'eyewear', displayName: 'Visor neón', rarity: 'legendary', model: 'eyewear/visor.glb', recolorable: true, price: 2500, tags: ['neon'] },
  // ---- top ----
  top_hoodie: { id: 'top_hoodie', slot: 'top', displayName: 'Sudadera', rarity: 'common', model: 'top/hoodie.glb', recolorable: true, price: 0, tags: ['starter'] },
  top_tactical_vest: { id: 'top_tactical_vest', slot: 'top', displayName: 'Chaleco táctico', rarity: 'common', model: 'top/tactical_vest.glb', recolorable: true, price: 0, tags: ['starter', 'military'] },
  top_sailor: { id: 'top_sailor', slot: 'top', displayName: 'Marinero', rarity: 'rare', model: 'top/sailor.glb', recolorable: true, price: 500, tags: ['cute'] },
  // ---- bottom ----
  bottom_cargo: { id: 'bottom_cargo', slot: 'bottom', displayName: 'Cargo', rarity: 'common', model: 'bottom/cargo.glb', recolorable: true, price: 0, tags: ['starter'] },
  bottom_skirt: { id: 'bottom_skirt', slot: 'bottom', displayName: 'Falda', rarity: 'common', model: 'bottom/skirt.glb', recolorable: true, price: 0, tags: ['starter'] },
  bottom_shorts: { id: 'bottom_shorts', slot: 'bottom', displayName: 'Shorts', rarity: 'common', model: 'bottom/shorts.glb', recolorable: true, price: 150, tags: [] },
  // ---- shoes ----
  shoes_sneakers: { id: 'shoes_sneakers', slot: 'shoes', displayName: 'Zapatillas', rarity: 'common', model: 'shoes/sneakers.glb', recolorable: true, price: 0, tags: ['starter'] },
  shoes_boots: { id: 'shoes_boots', slot: 'shoes', displayName: 'Botas', rarity: 'common', model: 'shoes/boots.glb', recolorable: true, price: 0, tags: ['starter', 'military'] },
  // ---- back ----
  back_none: { id: 'back_none', slot: 'back', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  back_backpack: { id: 'back_backpack', slot: 'back', displayName: 'Mochila', rarity: 'common', model: 'back/backpack.glb', recolorable: true, price: 300, tags: [] },
  back_wings: { id: 'back_wings', slot: 'back', displayName: 'Alitas', rarity: 'legendary', model: 'back/wings.glb', recolorable: true, price: 3000, tags: ['cute'] },
  // ---- hands ----
  hands_none: { id: 'hands_none', slot: 'hands', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  hands_gloves: { id: 'hands_gloves', slot: 'hands', displayName: 'Guantes', rarity: 'common', model: 'hands/gloves.glb', recolorable: true, price: 200, tags: [] },
  // ---- accessory ----
  accessory_none: { id: 'accessory_none', slot: 'accessory', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  accessory_scarf: { id: 'accessory_scarf', slot: 'accessory', displayName: 'Bufanda', rarity: 'rare', model: 'accessory/scarf.glb', recolorable: true, price: 400, tags: [] },
  // ---- weaponSkin ----
  weaponskin_default: { id: 'weaponskin_default', slot: 'weaponSkin', displayName: 'Estándar', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  weaponskin_candy: { id: 'weaponskin_candy', slot: 'weaponSkin', displayName: 'Caramelo', rarity: 'epic', model: 'weaponSkin/candy.glb', recolorable: true, price: 1500, tags: ['cute'] },
  // ---- trail ----
  trail_none: { id: 'trail_none', slot: 'trail', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  trail_sparkles: { id: 'trail_sparkles', slot: 'trail', displayName: 'Chispas', rarity: 'rare', model: 'trail/sparkles.glb', recolorable: true, price: 700, tags: [] },
  // ---- killEffect ----
  killeffect_none: { id: 'killeffect_none', slot: 'killEffect', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  killeffect_confetti: { id: 'killeffect_confetti', slot: 'killEffect', displayName: 'Confeti', rarity: 'epic', model: 'killEffect/confetti.glb', recolorable: false, price: 1000, tags: [] },
} as const satisfies Record<string, CosmeticItem>;

export type CosmeticId = keyof typeof COSMETICS;

/** Avatar por defecto de un jugador nuevo. */
export const DEFAULT_AVATAR = {
  character: 'spark',
  items: {
    hair: 'hair_spiky',
    eyes: 'eyes_round',
    face: 'face_smile',
    headwear: 'headwear_none',
    eyewear: 'eyewear_none',
    top: 'top_hoodie',
    bottom: 'bottom_cargo',
    shoes: 'shoes_sneakers',
    back: 'back_none',
    hands: 'hands_none',
    accessory: 'accessory_none',
    weaponSkin: 'weaponskin_default',
    trail: 'trail_none',
    killEffect: 'killeffect_none',
  },
  colors: {
    skin: '#f6d3b8',
    hair: '#3b2a20',
    eyes: '#4a90e2',
    primary: '#ff5c7a',
    secondary: '#37d0ff',
  },
  sliders: { headSize: 0.5, eyeSize: 0.5, bodyWidth: 0.5, height: 0.5 },
} as const satisfies {
  character: string;
  items: Record<CosmeticSlot, CosmeticId>;
  colors: Record<ColorChannel, string>;
  sliders: Record<BodySlider, number>;
};

/** Colores de rareza para la UI. */
export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#b0b7c3',
  rare: '#37d0ff',
  epic: '#c56cff',
  legendary: '#ffd23f',
};
