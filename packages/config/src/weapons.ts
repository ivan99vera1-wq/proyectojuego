/**
 * Catálogo de armas.
 *
 * Las mallas salen del pack WWII (`assets/source/weapons/weapons/`) y se
 * preparan con `assets/blender/build_weapons.py`, que exporta un solo
 * `weapons.glb` donde cada objeto se llama EXACTAMENTE como el id de aquí.
 * Para añadir un arma: una entrada en esta tabla y otra en `PIEZAS` del script.
 */
export type WeaponSlot = 'primary' | 'secondary' | 'melee' | 'grenade';
export type WeaponCategory = 'pistol' | 'smg' | 'rifle' | 'sniper' | 'knife' | 'grenade';

/**
 * Cómo se anima la recarga.
 *  - `magazine`: el cargador se suelta y cae (la malla lo trae aparte).
 *  - `clip`: se carga por peine, no cae nada (Garand, Mauser C96).
 *  - `none`: no se recarga (cuchillo, granadas).
 */
export type ReloadStyle = 'magazine' | 'clip' | 'none';

export interface WeaponDefinition {
  id: string;
  displayName: string;
  slot: WeaponSlot;
  category: WeaponCategory;
  /** Precio en la tienda. */
  price: number;
  /** Daño base por impacto (antes de multiplicadores de zona). */
  damage: number;
  /** Disparos por segundo. */
  fireRate: number;
  /** Munición por cargador y reserva total. */
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number;
  /** Cómo se dibuja la recarga. */
  reloadStyle: ReloadStyle;
  /**
   * Segundos que tarda el arma en poder dispararse tras sacarla.
   * Lo aplica el SERVIDOR, no solo la animación: si no, se ve el arma subir
   * mientras ya estás disparando y el gesto es puro adorno.
   */
  drawTime: number;
  /** Alcance efectivo (m) y caída de daño por metro extra (0..1). */
  range: number;
  damageFalloff: number;
  /** Dispersión base en grados y recuperación. */
  spread: number;
  recoilVertical: number;
  recoilHorizontal: number;
  /** Penetración de armadura (0..1: proporción del daño que ignora armadura). */
  armorPenetration: number;
  /** Multiplicador de velocidad de movimiento mientras se empuña. */
  movementSpeedFactor: number;
  /** ¿Automática? (mantener pulsado). */
  automatic: boolean;
  /** Perdigones por disparo. Ninguna arma del catálogo actual lo usa. */
  pellets?: number;
  /** Recompensa por asesinato con esta arma. */
  killReward: number;
}

export const WEAPONS = {
  ka_bar: {
    id: 'ka_bar', displayName: 'KA-BAR', slot: 'melee', category: 'knife',
    price: 0, damage: 40, fireRate: 2, magazineSize: 0, reserveAmmo: 0, reloadTime: 0,
    reloadStyle: 'none', drawTime: 0.25,
    range: 1.5, damageFalloff: 0, spread: 0, recoilVertical: 0, recoilHorizontal: 0,
    armorPenetration: 0.85, movementSpeedFactor: 1.0, automatic: false, killReward: 1500,
  },
  tt_pistol: {
    id: 'tt_pistol', displayName: 'TT Pistol', slot: 'secondary', category: 'pistol',
    price: 0, damage: 28, fireRate: 6, magazineSize: 8, reserveAmmo: 48, reloadTime: 1.8,
    reloadStyle: 'magazine', drawTime: 0.25,
    range: 40, damageFalloff: 0.01, spread: 1.2, recoilVertical: 1.5, recoilHorizontal: 0.4,
    armorPenetration: 0.5, movementSpeedFactor: 1.0, automatic: false, killReward: 300,
  },
  mauser_c96: {
    id: 'mauser_c96', displayName: 'Mauser C96', slot: 'secondary', category: 'pistol',
    price: 700, damage: 60, fireRate: 2.5, magazineSize: 10, reserveAmmo: 30, reloadTime: 2.4,
    // Cargador interno: se llena por peine, no cae nada.
    reloadStyle: 'clip', drawTime: 0.25,
    range: 45, damageFalloff: 0.008, spread: 0.8, recoilVertical: 4, recoilHorizontal: 0.8,
    armorPenetration: 0.9, movementSpeedFactor: 0.98, automatic: false, killReward: 300,
  },
  ppsh_41: {
    id: 'ppsh_41', displayName: 'PPSh-41', slot: 'primary', category: 'smg',
    price: 1200, damage: 22, fireRate: 12, magazineSize: 35, reserveAmmo: 105, reloadTime: 2.2,
    reloadStyle: 'magazine', drawTime: 0.5,
    range: 30, damageFalloff: 0.02, spread: 1.8, recoilVertical: 1.0, recoilHorizontal: 0.6,
    armorPenetration: 0.55, movementSpeedFactor: 0.97, automatic: true, killReward: 600,
  },
  thompson_m1: {
    id: 'thompson_m1', displayName: 'Thompson M1', slot: 'primary', category: 'smg',
    // Ocupa el hueco que dejó la escopeta: el .45 pega más y dispara más despacio.
    price: 1400, damage: 30, fireRate: 8, magazineSize: 20, reserveAmmo: 80, reloadTime: 2.6,
    reloadStyle: 'magazine', drawTime: 0.5,
    range: 26, damageFalloff: 0.03, spread: 2.0, recoilVertical: 1.6, recoilHorizontal: 0.8,
    armorPenetration: 0.5, movementSpeedFactor: 0.95, automatic: true, killReward: 900,
  },
  stg_44: {
    id: 'stg_44', displayName: 'StG 44', slot: 'primary', category: 'rifle',
    price: 2700, damage: 33, fireRate: 10, magazineSize: 30, reserveAmmo: 90, reloadTime: 2.5,
    reloadStyle: 'magazine', drawTime: 0.7,
    range: 70, damageFalloff: 0.006, spread: 1.0, recoilVertical: 2.2, recoilHorizontal: 0.9,
    armorPenetration: 0.75, movementSpeedFactor: 0.92, automatic: true, killReward: 300,
  },
  m1_garand: {
    id: 'm1_garand', displayName: 'M1 Garand', slot: 'primary', category: 'sniper',
    // El arma cara de largo alcance. Semiautomática: pega menos que el antiguo
    // rifle de tirador pero dispara bastante más deprisa.
    price: 4500, damage: 80, fireRate: 3, magazineSize: 8, reserveAmmo: 32, reloadTime: 3.0,
    reloadStyle: 'clip', drawTime: 0.8,
    range: 200, damageFalloff: 0.001, spread: 0.3, recoilVertical: 6, recoilHorizontal: 1.2,
    armorPenetration: 0.95, movementSpeedFactor: 0.85, automatic: false, killReward: 150,
  },
  grenade_mk2: {
    id: 'grenade_mk2', displayName: 'Granada MK2', slot: 'grenade', category: 'grenade',
    price: 300, damage: 90, fireRate: 1, magazineSize: 1, reserveAmmo: 0, reloadTime: 0,
    reloadStyle: 'none', drawTime: 0.3,
    range: 6, damageFalloff: 0.15, spread: 0, recoilVertical: 0, recoilHorizontal: 0,
    armorPenetration: 0.6, movementSpeedFactor: 1.0, automatic: false, killReward: 300,
  },
  grenade_stick: {
    id: 'grenade_stick', displayName: 'Granada de humo', slot: 'grenade', category: 'grenade',
    price: 300, damage: 0, fireRate: 1, magazineSize: 1, reserveAmmo: 0, reloadTime: 0,
    reloadStyle: 'none', drawTime: 0.3,
    range: 5, damageFalloff: 0, spread: 0, recoilVertical: 0, recoilHorizontal: 0,
    armorPenetration: 0, movementSpeedFactor: 1.0, automatic: false, killReward: 300,
  },
} as const satisfies Record<string, WeaponDefinition>;

export type WeaponId = keyof typeof WEAPONS;

/** Equipo con el que aparece cada jugador al inicio de una ronda de pistola. */
export const DEFAULT_LOADOUT: { secondary: WeaponId; melee: WeaponId } = {
  secondary: 'tt_pistol',
  melee: 'ka_bar',
};

/** Equipamiento no-arma disponible en la tienda. */
export const EQUIPMENT = {
  armor: { id: 'armor', displayName: 'Chaleco', price: 650, armor: 100 },
  helmet: { id: 'helmet', displayName: 'Casco', price: 350, armor: 0 },
  defuse_kit: { id: 'defuse_kit', displayName: 'Kit de desactivación', price: 400, armor: 0 },
} as const;
export type EquipmentId = keyof typeof EQUIPMENT;
