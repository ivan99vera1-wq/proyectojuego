# tools/

Scripts de apoyo (no forman parte del juego en runtime).

| Script | Qué hace |
| --- | --- |
| `export-branding.ts` | Exporta la marca (`packages/config/src/branding.ts`) a JSON para Electron. Se ejecuta automáticamente en `npm run build:desktop`. |
| `optimize-assets.mjs` | Convierte y comprime los GLB de `assets/source` a `apps/client/public/assets`. |

Fase 2 añadirá: `validate-map.mjs` (comprueba que un mapa tiene los nodos SPAWN/BOMBSITE requeridos) y `validate-rig.mjs` (comprueba que un rig chibi tiene todos los `ANIMATION_CLIPS`).
