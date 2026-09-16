# assets/

Fuentes de arte **sin procesar** (archivos `.blend`, PSD, WAV, GLB de exportación directa). Nunca se cargan en el juego directamente.

```
assets/source/
├── characters/   rig chibi base + cosméticos (uno por slot) → ver docs/CUSTOMIZATION.md
├── weapons/      un GLB por arma, id igual a WEAPONS[id].model
├── maps/         un GLB por mapa con nodos nombrados → ver docs/ASSET_PIPELINE.md
└── audio/        WAV/FLAC originales
```

El script `node tools/optimize-assets.mjs` produce las versiones optimizadas en `apps/client/public/assets/`, que es lo que el cliente carga.

Los archivos pesados de esta carpeta deberían ir en Git LFS (`git lfs track "*.blend" "*.psd" "*.wav"`).
