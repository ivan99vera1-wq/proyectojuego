# Pipeline de assets

`assets/source` (fuentes) → `node tools/optimize-assets.mjs` → `apps/client/public/assets` (lo que carga el juego).

## Convenciones generales
- Formato de intercambio: **glTF binario (.glb)**, Y-up, 1 unidad = 1 metro, escala aplicada, sin transformaciones
  residuales en los nodos raíz.
- Texturas: PNG en fuente; el optimizador redimensiona a 1024 y comprime geometría con Draco. Fase 2: KTX2/Basis para
  texturas.
- Nombres de archivo en `snake_case`, iguales a los que referencia `packages/config`.
- Materiales PBR sencillos (base color + normal opcional). El estilo chibi funciona mejor con colores planos y una
  sombra suave, no con texturas realistas.
- Presupuesto orientativo: personaje ≤ 8k tris, cosmético ≤ 2k, arma ≤ 4k, mapa ≤ 300k tris totales.

## Personajes y cosméticos
Ver `docs/CUSTOMIZATION.md` (huesos, sockets, shape keys, prefijo `Recolor_`). Animaciones: un clip por entrada de
`ANIMATION_CLIPS`, con esos nombres exactos, en el GLB base. `tools/validate-rig.mjs` (Fase 2) comprobará que no falta
ninguno.

## Armas
Origen del modelo en el punto de agarre. Empty `MUZZLE` en la boca del cañón (fogonazo y origen del trazador). Para el
view model en primera persona se usa el mismo GLB.

## Mapas: nodos con nombre
Todo lo que el juego necesita saber de un mapa se lee de los **nombres de nodos** del GLB. Un solo archivo, sin
formatos propios.

| Prefijo | Tipo de nodo | Significado |
| --- | --- | --- |
| `COLLISION_*` | malla | geometría de colisión (Rapier). Invisible en runtime. Debe ser simple (cajas, rampas). |
| `VISUAL_*` | malla | solo se dibuja, no colisiona (decoración) |
| `SPAWN_A_01…` / `SPAWN_B_01…` | empty | puntos de aparición por equipo (mínimo `maxPlayersPerTeam` cada uno) |
| `SPAWN_FFA_*` | empty | apariciones para modos sin equipo |
| `BOMBSITE_A` / `BOMBSITE_B` | malla (caja) | volumen donde se puede plantar |
| `BUYZONE_A` / `BUYZONE_B` | malla (caja) | volumen de compra |
| `KILLZONE_*` | malla (caja) | muerte instantánea (caídas al vacío) |
| `LIGHT_*` | luz | luces exportadas (se limita el número por rendimiento) |
| `NAV_*` | malla | reservado para bots (Fase 3) |

`tools/validate-map.mjs` (Fase 2) verificará que existen los nodos obligatorios para cada modo declarado en `MAPS[id].modes`.

## Audio
Fuentes WAV 48 kHz en `assets/source/audio`; el juego carga OGG Vorbis (SFX mono para espacialización, música estéreo).
Rutas y nombres en `AUDIO`.

## Git LFS
`git lfs track "*.blend" "*.psd" "*.wav" "*.glb"` antes de subir arte pesado.
