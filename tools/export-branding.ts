/**
 * Exporta packages/config/src/branding.ts a apps/desktop/dist/branding.json
 * para que Electron y electron-builder lean nombre/appId sin compilar TS.
 * Uso: npx tsx tools/export-branding.ts   (se ejecuta solo en `npm run build:desktop`)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDING } from '../packages/config/src/branding.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, '../apps/desktop/dist');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'branding.json'), JSON.stringify(BRANDING, null, 2));
console.log(`branding.json exportado → ${out} (${BRANDING.name} v${BRANDING.version})`);
