import type { CosmeticId } from '@game/config';
import type { PartBuilder } from './context.js';
import { HEAD_PARTS } from './parts/head.js';
import { CLOTHING_PARTS } from './parts/clothing.js';

/**
 * Registro de constructores por cosmético. Cada pieza se monta sobre los
 * sockets del rig del personaje base; ninguna duplica el cuerpo.
 *
 * Cuando exista arte GLB, un id se migra sustituyendo su constructor por
 * una carga de modelo: el resto del sistema no cambia.
 */
export const PROCEDURAL_COSMETICS: Partial<Record<CosmeticId, PartBuilder>> = {
  ...HEAD_PARTS,
  ...CLOTHING_PARTS,
};

export type { PartContext, PartBuilder } from './context.js';
