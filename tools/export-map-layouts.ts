/**
 * Vuelca los layouts de mapa a JSON para que Blender los lea.
 *
 * El mapa jugable son datos: las mismas cajas que el servidor usa para las
 * colisiones. Blender construye el ARTE a partir de esos datos, así que lo que
 * se ve y contra lo que se choca no pueden separarse nunca.
 *
 *   npx tsx tools/export-map-layouts.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_LAYOUTS } from '../packages/shared/src/maps/index.js';
import { MAPS } from '../packages/config/src/maps.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, '../assets/blender/data');
mkdirSync(out, { recursive: true });

const payload = Object.fromEntries(
  Object.entries(MAP_LAYOUTS).map(([id, layout]) => [
    id,
    { ...layout, definition: MAPS[id as keyof typeof MAPS] },
  ]),
);
writeFileSync(path.join(out, 'maps.json'), JSON.stringify(payload, null, 2));
console.log(`maps.json exportado (${Object.keys(payload).join(', ')})`);
