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
  | 'brows'
  | 'mouth'
  | 'headwear'      // gorra, gorro, casco
  | 'eyewear'       // gafas tácticas
  | 'headAccessory' // auriculares
  | 'top'           // camiseta / sudadera
  | 'outer'         // chaleco, chaqueta
  | 'bottom'
  | 'shoes'
  | 'hands'         // guantes
  | 'back'          // mochila
  | 'weaponSkin';

/**
 * Orden en que se montan las capas: lo interior primero, lo exterior después.
 * Importa de verdad: el chaleco tiene que ir por fuera de la sudadera.
 */
export const SLOT_ORDER: readonly CosmeticSlot[] = [
  'eyes', 'brows', 'mouth', 'hair', 'headwear', 'eyewear', 'headAccessory',
  'top', 'bottom', 'shoes', 'hands', 'outer', 'back', 'weaponSkin',
];

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

/**
 * Slots que NO montan geometría en el cuerpo: la skin de arma la aplica el
 * arma y la estela y el efecto de eliminación los dibujan los efectos.
 */
export const NON_BODY_SLOTS: readonly CosmeticSlot[] = ['weaponSkin'];

/** Slots que SIEMPRE deben tener un valor (no admiten "vacío"). */
export const REQUIRED_SLOTS: readonly CosmeticSlot[] = ['hair', 'eyes', 'brows', 'mouth', 'top', 'bottom', 'shoes'];

/** Canales de color que el jugador puede editar libremente (hex). */
export const COLOR_CHANNELS = {
  skin: { label: 'Piel', default: '#f0c6a2', presets: ['#f7dcc4', '#f0c6a2', '#d9a173', '#a9703f', '#7a4b28', '#4d2f1a'] },
  hair: { label: 'Cabello', default: '#2e2620', presets: ['#2e2620', '#5b3a22', '#a8672c', '#e8d29a', '#8e8e96', '#ffffff', '#c0392b', '#37d0ff', '#ff5c7a'] },
  eyes: { label: 'Ojos', default: '#5b4636', presets: ['#5b4636', '#4a90e2', '#27ae60', '#8e44ad', '#e67e22', '#2c3e50'] },
  primary: { label: 'Color principal', default: '#2c3240', presets: ['#3d4860', '#2b2f3a', '#6d7a8c', '#7a3b46', '#3f6b52', '#b4894f', '#ff5c7a', '#37d0ff'] },
  secondary: { label: 'Color secundario', default: '#d8d2c4', presets: ['#9aa6b8', '#e2e7ef', '#4a5162', '#c0a678', '#5a7f9c', '#ffd23f'] },
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

/**
 * Catálogo. Pocas opciones y bien hechas, no un muestrario a medias.
 *
 * El `id` de cada pieza es LITERALMENTE el prefijo con el que sale del
 * modelo (`<id>__<Parte>` en character.glb). Si no coinciden, el cliente
 * no encuentra la malla y el jugador se queda sin esa prenda.
 */
export const COSMETICS = {
  // ---- pelo ----
  hair_short: { id: 'hair_short', slot: 'hair', displayName: 'Corto', rarity: 'common', model: 'hair_short', recolorable: true, price: 0, tags: ['starter'] },
  hair_spiky: { id: 'hair_spiky', slot: 'hair', displayName: 'Puntas', rarity: 'common', model: 'hair_spiky', recolorable: true, price: 0, tags: ['starter'] },
  hair_ponytail: { id: 'hair_ponytail', slot: 'hair', displayName: 'Coleta', rarity: 'common', model: 'hair_ponytail', recolorable: true, price: 0, tags: ['starter'] },
  // ---- ojos ----
  eyes_round: { id: 'eyes_round', slot: 'eyes', displayName: 'Redondos', rarity: 'common', model: 'eyes_round', recolorable: true, price: 0, tags: ['starter'] },
  eyes_sharp: { id: 'eyes_sharp', slot: 'eyes', displayName: 'Afilados', rarity: 'common', model: 'eyes_sharp', recolorable: true, price: 0, tags: ['starter'] },
  eyes_calm: { id: 'eyes_calm', slot: 'eyes', displayName: 'Serenos', rarity: 'common', model: 'eyes_calm', recolorable: true, price: 0, tags: ['starter'] },
  // ---- cejas ----
  brows_straight: { id: 'brows_straight', slot: 'brows', displayName: 'Rectas', rarity: 'common', model: 'brows_straight', recolorable: true, price: 0, tags: ['starter'] },
  brows_angry: { id: 'brows_angry', slot: 'brows', displayName: 'Marcadas', rarity: 'common', model: 'brows_angry', recolorable: true, price: 0, tags: ['starter'] },
  brows_calm: { id: 'brows_calm', slot: 'brows', displayName: 'Suaves', rarity: 'common', model: 'brows_calm', recolorable: true, price: 0, tags: ['starter'] },
  // ---- boca ----
  mouth_smile: { id: 'mouth_smile', slot: 'mouth', displayName: 'Sonrisa', rarity: 'common', model: 'mouth_smile', recolorable: false, price: 0, tags: ['starter'] },
  mouth_neutral: { id: 'mouth_neutral', slot: 'mouth', displayName: 'Neutra', rarity: 'common', model: 'mouth_neutral', recolorable: false, price: 0, tags: ['starter'] },
  mouth_smirk: { id: 'mouth_smirk', slot: 'mouth', displayName: 'Ladeada', rarity: 'common', model: 'mouth_smirk', recolorable: false, price: 0, tags: ['starter'] },
  // ---- gorros ----
  headwear_none: { id: 'headwear_none', slot: 'headwear', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  headwear_cap: { id: 'headwear_cap', slot: 'headwear', displayName: 'Gorra táctica', rarity: 'common', model: 'headwear_cap', recolorable: true, price: 0, tags: ['starter', 'tactical'] },
  headwear_beanie: { id: 'headwear_beanie', slot: 'headwear', displayName: 'Gorro', rarity: 'common', model: 'headwear_beanie', recolorable: true, price: 200, tags: ['urban'] },
  headwear_helmet: { id: 'headwear_helmet', slot: 'headwear', displayName: 'Casco', rarity: 'rare', model: 'headwear_helmet', recolorable: true, price: 600, tags: ['tactical'] },
  // ---- gafas ----
  eyewear_none: { id: 'eyewear_none', slot: 'eyewear', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  eyewear_goggles: { id: 'eyewear_goggles', slot: 'eyewear', displayName: 'Gafas tácticas', rarity: 'common', model: 'eyewear_goggles', recolorable: false, price: 350, tags: ['tactical'] },
  // ---- accesorios de cabeza ----
  headacc_none: { id: 'headacc_none', slot: 'headAccessory', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  headacc_headset: { id: 'headacc_headset', slot: 'headAccessory', displayName: 'Auriculares', rarity: 'common', model: 'headacc_headset', recolorable: false, price: 0, tags: ['starter', 'tactical'] },
  // ---- camisetas ----
  top_tee: { id: 'top_tee', slot: 'top', displayName: 'Camiseta', rarity: 'common', model: 'top_tee', recolorable: true, price: 0, tags: ['starter'] },
  top_hoodie: { id: 'top_hoodie', slot: 'top', displayName: 'Sudadera', rarity: 'common', model: 'top_hoodie', recolorable: true, price: 0, tags: ['starter'] },
  // ---- chaquetas y chalecos ----
  outer_none: { id: 'outer_none', slot: 'outer', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  outer_vest: { id: 'outer_vest', slot: 'outer', displayName: 'Chaleco táctico', rarity: 'common', model: 'outer_vest', recolorable: true, price: 0, tags: ['starter', 'tactical'] },
  outer_jacket: { id: 'outer_jacket', slot: 'outer', displayName: 'Chaqueta', rarity: 'common', model: 'outer_jacket', recolorable: true, price: 300, tags: ['urban'] },
  // ---- pantalones ----
  bottom_cargo: { id: 'bottom_cargo', slot: 'bottom', displayName: 'Cargo', rarity: 'common', model: 'bottom_cargo', recolorable: true, price: 0, tags: ['starter', 'tactical'] },
  bottom_jeans: { id: 'bottom_jeans', slot: 'bottom', displayName: 'Vaqueros', rarity: 'common', model: 'bottom_jeans', recolorable: true, price: 0, tags: ['starter', 'urban'] },
  // ---- zapatos ----
  shoes_sneakers: { id: 'shoes_sneakers', slot: 'shoes', displayName: 'Zapatillas', rarity: 'common', model: 'shoes_sneakers', recolorable: true, price: 0, tags: ['starter', 'urban'] },
  shoes_boots: { id: 'shoes_boots', slot: 'shoes', displayName: 'Botas', rarity: 'common', model: 'shoes_boots', recolorable: true, price: 0, tags: ['starter', 'tactical'] },
  // ---- guantes ----
  hands_none: { id: 'hands_none', slot: 'hands', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  hands_gloves: { id: 'hands_gloves', slot: 'hands', displayName: 'Guantes', rarity: 'common', model: 'hands_gloves', recolorable: false, price: 0, tags: ['starter', 'tactical'] },
  // ---- mochila ----
  back_none: { id: 'back_none', slot: 'back', displayName: 'Nada', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  back_backpack: { id: 'back_backpack', slot: 'back', displayName: 'Mochila', rarity: 'common', model: 'back_backpack', recolorable: true, price: 250, tags: [] },
  // ---- skin de arma (no monta geometría: solo tiñe el arma) ----
  weaponskin_default: { id: 'weaponskin_default', slot: 'weaponSkin', displayName: 'Estándar', rarity: 'common', model: '', recolorable: false, price: 0, tags: ['starter'] },
  weaponskin_desert: { id: 'weaponskin_desert', slot: 'weaponSkin', displayName: 'Desierto', rarity: 'rare', model: 'weaponskin_desert', recolorable: true, price: 500, tags: [] },
} as const satisfies Record<string, CosmeticItem>;

export type CosmeticId = keyof typeof COSMETICS;

/** Avatar por defecto de un jugador nuevo. */
export const DEFAULT_AVATAR = {
  character: 'recruit',
  items: {
    hair: 'hair_short',
    eyes: 'eyes_round',
    brows: 'brows_straight',
    mouth: 'mouth_smile',
    headwear: 'headwear_cap',
    eyewear: 'eyewear_none',
    headAccessory: 'headacc_headset',
    top: 'top_hoodie',
    outer: 'outer_vest',
    bottom: 'bottom_cargo',
    shoes: 'shoes_sneakers',
    hands: 'hands_gloves',
    back: 'back_none',
    weaponSkin: 'weaponskin_default',
  },
  colors: {
    skin: '#f0c6a2',
    hair: '#241f1c',
    eyes: '#5b4636',
    primary: '#2c3240',
    secondary: '#d8d2c4',
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
