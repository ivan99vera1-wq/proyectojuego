# tools/

Scripts de apoyo (no forman parte del juego en runtime). Todos tienen atajo en el `package.json` de la raíz.

| Script | Atajo | Qué hace |
| --- | --- | --- |
| `check-map.ts` | `npm run check:map` | Informe de cada mapa: cajas, metros pisables en cada sitio de bomba y apariciones mal puestas. Usa la física real del juego (`PhysicsWorld.isFree`), así que ve también las cajas rotadas. |
| `check-bone-axes.mjs` | `npm run check:rig` | Comprueba que los huesos del GLB del personaje salen de Blender con los ejes alineados con los del mundo (lo que asume `character/rig.ts`). |
| `export-map-layouts.ts` | `npm run assets:maps` | Vuelca los layouts de mapa a `assets/blender/data/maps.json` para que Blender construya el arte a partir de los MISMOS datos que la colisión. |
| `optimize-assets.mjs` | `npm run assets:optimize` | Comprime los GLB de `assets/source` a `apps/client/public/assets`. Requiere `@gltf-transform/cli`. |
| `export-branding.ts` | (automático) | Exporta la marca a JSON para Electron. Lo ejecuta `npm run build:desktop`. |

Lo que **no** puede romperse no vive aquí, vive en los tests: `packages/shared/src/maps/maps.test.ts` valida los mapas
y `apps/client/src/character/character.test.ts` valida el modelo del personaje. Los scripts de esta carpeta son para
mirar números mientras se construye contenido.
