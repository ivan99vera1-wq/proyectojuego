# Arte en Blender

Todo el arte 3D de TinyStrike se genera con scripts de Blender en modo consola.
Nada se modela a mano: el `.blend` es un resultado reproducible, no la fuente.
La fuente son estos scripts, que se versionan y se revisan como cualquier código.

## Requisitos

Blender 4.2 o superior (probado con 5.1). En macOS:
`/Applications/Blender.app/Contents/MacOS/Blender`

## Comandos

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender

# Personaje base -> apps/client/public/assets/models/characters/character.glb
$B --background --python assets/blender/build_character.py

# Hoja de personaje (vistas + silueta) para revisión visual
$B --background --python assets/blender/render_sheet.py -- /ruta/salida
```

## Estructura

```
lib/
├── proportions.py  medidas del personaje, atadas a la hitbox del juego
├── mesh.py         caja de control por secciones, cubo-esfera, subdivisión, pliegues
├── sculpt.py       empujes con caída suave: pómulos, ceja, mandíbula, cuádriceps
├── profiles.py     (en el cliente) equivalente para la versión procedural
├── body.py         anatomía: cabeza, cuello, torso, brazos, manos, piernas, pies
├── face.py         ojos, cejas y boca, apoyados en la superficie real del cráneo
├── clothing.py     camiseta, mangas, chaleco, pantalón, botas, guantes, pelo
├── materials.py    materiales; el prefijo Recolor_* es el contrato con el juego
├── rig.py          esqueleto y correspondencia hueso ↔ pieza
└── scene.py        escena de estudio, luces, cámara y render
```

## Cómo se modela aquí

La técnica es la misma que usaría un artista: una **caja de control** de pocos
polígonos y **subdivisión Catmull-Clark** encima. Los pliegues (`crease`)
devuelven dureza donde hace falta (suela, visera, borde de chaleco). Encima se
aplican **pasadas de escultura** con caída suave para pómulos, ceja, mandíbula,
cuádriceps o glúteo. Nada de esferas y cilindros sueltos.

## Contratos con el juego

1. **Altura total = altura de la cápsula de colisión** (1,20 m). Está aseverado
   en `proportions.py`. Si se rompe, la silueta se sale de la hitbox.
2. **El personaje mira hacia +Y en Blender.** Al exportar con "+Y up", eso se
   convierte en -Z de glTF, que es la dirección de avance en el juego.
3. **Cada pieza tiene su origen en su articulación.** El cliente anima rotando
   por articulación, así que el origen es el pivote.
4. **Materiales `Recolor_<canal>`**: el cliente los busca por nombre y les
   aplica el color elegido por el jugador. Un material sin ese prefijo conserva
   su color siempre.
5. **Nombres de pieza** según `rig.PART_BONE`: son la llave con la que el
   cliente engancha cada malla a su hueso.

## Comandos completos

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender

# 1. Personaje base (cuerpo desnudo) -> models/characters/character.glb
$B --background --python assets/blender/build_character.py

# 2. Cosméticos (pelo, gorros, gafas, ropa…) -> models/cosmetics/cosmetics.glb
$B --background --python assets/blender/build_cosmetics.py

# 3. Armas -> models/weapons/weapons.glb
$B --background --python assets/blender/build_weapons.py

# 4. Mapas: primero se vuelcan los datos de colisión, luego se construye el arte
npx tsx tools/export-map-layouts.ts
$B --background --python assets/blender/build_maps.py

# Revisión visual del personaje
$B --background --python assets/blender/render_sheet.py -- /ruta/salida
```

## Reparto entre GLB

| Archivo | Contiene |
| --- | --- |
| `character.glb` | Solo el CUERPO: cabeza, cara, torso, extremidades. Sin ropa ni pelo. |
| `cosmetics.glb` | Todas las piezas intercambiables, con nombre `<idCosmetico>__<Pieza>`. |
| `weapons.glb` | Un objeto por arma, con el id del catálogo como nombre. |
| `maps/<id>.glb` | Arte del mapa, generado desde los datos de colisión del juego. |

## Añadir un cosmético nuevo

1. Escribe su constructor en `lib/cosmetics.py` y regístralo en `BUILDERS`.
2. Devuelve las piezas con `_rename(piezas, "<id>")`; si se modelan en el
   espacio de la cabeza, envuélvelas antes con `_head_space(...)`.
3. Nombra cada pieza según las reglas de `socketFor` en
   `apps/client/src/customization/glb.ts` (por ejemplo `HatPeak`, `SleeveUpperL`).
4. Añade la entrada al catálogo en `packages/config/src/customization.ts`.
5. Reconstruye: el cliente lo recoge sin cambios de código.
