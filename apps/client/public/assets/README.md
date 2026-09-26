# Assets procesados (los que carga el juego)

Generados por `tools/optimize-assets.mjs`. Estructura esperada por el código:

```
models/characters/<baseModel>.glb           ← CHARACTERS[id].baseModel
models/weapons/weapons.glb                  ← todas las armas en un GLB, una malla por WEAPONS[id].id
maps/<archivo>.glb + maps/previews/*.jpg    ← MAPS[id].file / preview
audio/music/*.ogg, audio/sfx/*.ogg          ← AUDIO
audio/voices/<voiceSet>/*.ogg               ← CHARACTERS[id].voiceSet
textures/                                   ← texturas compartidas (KTX2/PNG)
```
