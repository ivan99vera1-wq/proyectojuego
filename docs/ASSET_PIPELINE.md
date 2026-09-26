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
- Presupuesto orientativo: personaje ≤ 16k tris (lo comprueba `character.test.ts`), arma ≤ 4k, mapa ≤ 300k tris totales.

## Personaje
Ver `docs/PERSONAJE.md`. El contrato con el modelo son los **nombres de hueso** (`hips`, `spine`, `chest`, `neck`,
`head`, `shoulder.L/R`, `upperarm.L/R`, `forearm.L/R`, `hand.L/R`, `thigh.L/R`, `shin.L/R`, `foot.L/R`) y que salgan
con los ejes alineados con los del mundo; `npm run check:rig` y `character.test.ts` lo comprueban.

Hoy la animación es procedural sobre ese esqueleto. Cuando se exporten clips, tendrán que llamarse exactamente como las
entradas de `ANIMATION_CLIPS`.

## Armas
Origen del modelo en el punto de agarre. Empty `MUZZLE` en la boca del cañón (fogonazo y origen del trazador). Para el
view model en primera persona se usa el mismo GLB.

## Mapas: los datos mandan, el arte sigue

Un mapa **no** se describe en el GLB. Se describe en datos, en `packages/shared/src/maps/<id>.ts`, con el kit de
construcción (`kit.ts`: muros con puertas, casetas, contenedores, rampas, torretas, jardineras). Esa lista de cajas es
la colisión real, idéntica en cliente y servidor.

El arte va al revés de lo habitual:

```
packages/shared/src/maps/<id>.ts      ← la fuente de verdad (jugabilidad y colisión)
        │  npm run assets:maps
        ▼
assets/blender/data/maps.json
        │  blender -b -P assets/blender/build_maps.py
        ▼
apps/client/public/assets/maps/<id>.glb   ← solo presentación
```

Blender construye el arte **a partir de esos mismos datos**, así que lo que se ve y contra lo que se choca no pueden
separarse. Si el GLB falta, el cliente dibuja las cajas del layout y el mapa sigue siendo jugable.

Reglas:

- Todo lo que estorba el paso va en `boxes`. Lo que va en `props` se atraviesa **siempre**.
- Los puntos de aparición, los sitios de bomba y las zonas de compra son campos del `MapLayout`, no nodos del GLB.
- `npm run check:map` da el informe y `packages/shared/src/maps/maps.test.ts` impide publicar un mapa con apariciones
  dentro de la geometría o sitios de bomba sin suelo pisable.

## Audio
Fuentes WAV 48 kHz en `assets/source/audio`; el juego carga OGG Vorbis (SFX mono para espacialización, música estéreo).
Rutas y nombres en `AUDIO`.

## Git LFS
`git lfs track "*.blend" "*.psd" "*.wav" "*.glb"` antes de subir arte pesado.
