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
