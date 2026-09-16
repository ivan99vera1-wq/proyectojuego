/**
 * Catálogo de armas. Para añadir un arma: agrega una entrada y un modelo GLB
 * en apps/client/public/assets/models/weapons/<id>.glb. Nada más.
 */
export type WeaponSlot = 'primary' | 'secondary' | 'melee' | 'grenade';
export type WeaponCategory = 'pistol' | 'smg' | 'rifle' | 'sniper' | 'shotgun' | 'knife' | 'grenade';

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
  /** Perdigones por disparo (escopetas). */
  pellets?: number;
  /** Recompensa por asesinato con esta arma. */
  killReward: number;
  /** Ruta del modelo 3D relativa a /assets/models/weapons/. */
  model: string;
}

export const WEAPONS = {
  knife: {
    id: 'knife', displayName: 'Cuchillo', slot: 'melee', category: 'knife',
    price: 0, damage: 40, fireRate: 2, magazineSize: 0, reserveAmmo: 0, reloadTime: 0,
    range: 1.5, damageFalloff: 0, spread: 0, recoilVertical: 0, recoilHorizontal: 0,
    armorPenetration: 0.85, movementSpeedFactor: 1.0, automatic: false, killReward: 1500,
    model: 'knife.glb',
  },
  pistol_basic: {
    id: 'pistol_basic', displayName: 'Pistola P-1', slot: 'secondary', category: 'pistol',
    price: 0, damage: 28, fireRate: 6, magazineSize: 13, reserveAmmo: 52, reloadTime: 1.8,
    range: 40, damageFalloff: 0.01, spread: 1.2, recoilVertical: 1.5, recoilHorizontal: 0.4,
    armorPenetration: 0.5, movementSpeedFactor: 1.0, automatic: false, killReward: 300,
    model: 'pistol_basic.glb',
  },
  pistol_heavy: {
    id: 'pistol_heavy', displayName: 'Revólver Bum', slot: 'secondary', category: 'pistol',
    price: 700, damage: 60, fireRate: 2.5, magazineSize: 7, reserveAmmo: 35, reloadTime: 2.4,
    range: 45, damageFalloff: 0.008, spread: 0.8, recoilVertical: 4, recoilHorizontal: 0.8,
    armorPenetration: 0.9, movementSpeedFactor: 0.98, automatic: false, killReward: 300,
    model: 'pistol_heavy.glb',
  },
  smg_bubble: {
    id: 'smg_bubble', displayName: 'SMG Burbuja', slot: 'primary', category: 'smg',
    price: 1200, damage: 22, fireRate: 12, magazineSize: 30, reserveAmmo: 120, reloadTime: 2.2,
    range: 30, damageFalloff: 0.02, spread: 1.8, recoilVertical: 1.0, recoilHorizontal: 0.6,
    armorPenetration: 0.55, movementSpeedFactor: 0.97, automatic: true, killReward: 600,
    model: 'smg_bubble.glb',
  },
  rifle_star: {
    id: 'rifle_star', displayName: 'Rifle Estrella', slot: 'primary', category: 'rifle',
    price: 2700, damage: 33, fireRate: 10, magazineSize: 30, reserveAmmo: 90, reloadTime: 2.5,
    range: 70, damageFalloff: 0.006, spread: 1.0, recoilVertical: 2.2, recoilHorizontal: 0.9,
    armorPenetration: 0.75, movementSpeedFactor: 0.92, automatic: true, killReward: 300,
    model: 'rifle_star.glb',
  },
  sniper_comet: {
    id: 'sniper_comet', displayName: 'Cometa', slot: 'primary', category: 'sniper',
    price: 4500, damage: 115, fireRate: 0.8, magazineSize: 5, reserveAmmo: 20, reloadTime: 3.5,
    range: 200, damageFalloff: 0.001, spread: 0.1, recoilVertical: 8, recoilHorizontal: 1.5,
    armorPenetration: 0.95, movementSpeedFactor: 0.8, automatic: false, killReward: 100,
    model: 'sniper_comet.glb',
  },
  shotgun_pop: {
    id: 'shotgun_pop', displayName: 'Escopeta Pop', slot: 'primary', category: 'shotgun',
    price: 1400, damage: 12, pellets: 8, fireRate: 1.5, magazineSize: 6, reserveAmmo: 24, reloadTime: 3.0,
    range: 15, damageFalloff: 0.05, spread: 6, recoilVertical: 5, recoilHorizontal: 1,
    armorPenetration: 0.5, movementSpeedFactor: 0.95, automatic: false, killReward: 900,
    model: 'shotgun_pop.glb',
  },
  grenade_frag: {
    id: 'grenade_frag', displayName: 'Granada Confeti', slot: 'grenade', category: 'grenade',
    price: 300, damage: 90, fireRate: 1, magazineSize: 1, reserveAmmo: 0, reloadTime: 0,
    range: 6, damageFalloff: 0.15, spread: 0, recoilVertical: 0, recoilHorizontal: 0,
    armorPenetration: 0.6, movementSpeedFactor: 1.0, automatic: false, killReward: 300,
    model: 'grenade_frag.glb',
  },
  grenade_smoke: {
    id: 'grenade_smoke', displayName: 'Humo de Algodón', slot: 'grenade', category: 'grenade',
    price: 300, damage: 0, fireRate: 1, magazineSize: 1, reserveAmmo: 0, reloadTime: 0,
    range: 5, damageFalloff: 0, spread: 0, recoilVertical: 0, recoilHorizontal: 0,
    armorPenetration: 0, movementSpeedFactor: 1.0, automatic: false, killReward: 300,
    model: 'grenade_smoke.glb',
  },
} as const satisfies Record<string, WeaponDefinition>;

export type WeaponId = keyof typeof WEAPONS;

/** Equipo con el que aparece cada jugador al inicio de una ronda de pistola. */
export const DEFAULT_LOADOUT: { secondary: WeaponId; melee: WeaponId } = {
  secondary: 'pistol_basic',
  melee: 'knife',
};

/** Equipamiento no-arma disponible en la tienda. */
export const EQUIPMENT = {
  armor: { id: 'armor', displayName: 'Chaleco', price: 650, armor: 100 },
  helmet: { id: 'helmet', displayName: 'Casco', price: 350, armor: 0 },
  defuse_kit: { id: 'defuse_kit', displayName: 'Kit de desactivación', price: 400, armor: 0 },
} as const;
export type EquipmentId = keyof typeof EQUIPMENT;
