# El personaje principal

TinyStrike tiene **un solo personaje jugable**: un chibi masculino. Todos los
jugadores usan ese mismo cuerpo y esqueleto, y construyen su identidad con el
vestidor (ver `CUSTOMIZATION.md`).

## De dónde sale

La malla base es el modelo *Chibi Base Mesh Character (Male)* de Sketchfab, que
vive en `assets/source/`. **Ese archivo no se modifica nunca.** Todo el proceso
lo lee, trabaja sobre una copia y escribe en otro sitio; `build_base.py` aborta
si alguna vez fuera a escribir encima del original.

El modelo original es solo el punto de partida: llega como un maniquí neutro de
4,45 unidades, sin esqueleto, sin cara y mirando hacia el lado contrario. Lo que
usa el juego es el resultado de transformarlo.

## Cómo se construye

Son dos pasos, en este orden:

```bash
Blender --background --python assets/blender/build_base.py       # 1
Blender --background --python assets/blender/build_character.py  # 2
```

**1. `build_base.py` — la base.** Congela el espejo y la subdivisión, mete la
escala y la rotación dentro de la malla, deja al personaje de pie sobre z = 0
centrado en el eje, lo escala a la altura exacta de la cápsula de colisión
(1,20 m) y le da media vuelta para que mire hacia +Y. Después lo reduce al
presupuesto de triángulos del juego. Deja `out/base_male.blend`.

**2. `build_character.py` — el personaje.** Sobre esa base aplica los retoques
de forma que lo convierten en *este* personaje y no en un maniquí
(`lib/shape.py`: plano facial, reborde de ceja, mandíbula, hombros, cintura),
le añade los rasgos de la cara, construye el esqueleto, calcula los pesos y
exporta. Deja `out/character.blend` y el GLB del juego.

## Por qué el orden importa

- Los **retoques de forma van antes de los pesos**. Deformar la malla después
  de calcularlos los deja sin sentido.
- La **alineación de huesos va después de los pesos**. Ver más abajo.
- Las piezas rígidas (ojos, cejas, boca) llevan su **transformación horneada en
  los vértices** antes de enlazarse. Al exportar a glTF, una malla con skin
  ignora la transformación de su nodo: si no se hornea, el iris aparece en el
  origen y el ojo se descompone.

## El esqueleto

22 huesos con nombres estándar, en `lib/rig.py`:

```
root  hips  spine  chest  neck  head
shoulder.L/R  upperarm.L/R  forearm.L/R  hand.L/R
thigh.L/R  shin.L/R  foot.L/R  toe.L/R
```

Las articulaciones no están puestas a ojo: salen de **medir la malla**. El
cuello es la franja horizontal más estrecha entre la cabeza y los hombros; la
rodilla y el tobillo son los mínimos de grosor de la pierna; la entrepierna es
la altura a la que las piernas dejan de tocarse. Los números viven en
`lib/proportions.py`.

### La alineación de los huesos

Antes de exportar, `flatten_orientations()` deja **todos los huesos apuntando
hacia arriba con roll 0**. No es un capricho:

El cliente anima girando huesos (`hueso.rotation.x = ...`). En glTF cada hueso
guarda su transformación respecto a su padre, así que si cada hueso mira en una
dirección distinta, esa misma línea gira sobre un eje distinto en cada
articulación. Con los huesos alineados, la rotación de un hueso significa
exactamente lo mismo que la de un grupo normal de Three.js, y el sistema de
animación que ya existía siguió funcionando sin cambios.

Apuntar hacia +Z (y no hacia +Y) es lo que hace que, tras la conversión a glTF
con «+Y arriba», los ejes locales coincidan con los del mundo. Lo comprueba:

```bash
node tools/check-bone-axes.mjs apps/client/public/assets/models/characters/character.glb
```

Cambiar la orientación de reposo cuando la pose es la de reposo **no deforma la
malla**, porque el modificador Armature multiplica la pose por la inversa del
reposo y sale la identidad. Por eso se puede hacer después de calcular los pesos.

## Cómo llega al juego

`apps/client/src/customization/glb.ts` carga el GLB y lo clona por jugador con
`SkeletonUtils.clone` (el clon normal de Three duplica las mallas pero las deja
apuntando al esqueleto original, y entonces todos los jugadores se moverían a la
vez). `rig.ts::rigFromSkeleton` adopta ese esqueleto: cada hueso pasa a ocupar
el sitio que antes tenía un grupo vacío, y los puntos de anclaje de los
cosméticos se cuelgan de los huesos que les tocan.

El cargador de glTF de Three limpia los nombres de nodo y se come los puntos, así
que `upperarm.L` llega como `upperarmL`. `boneKey()` normaliza los dos lados.

Si el GLB no trae esqueleto o le faltan huesos, el cliente avisa por consola y
cae al cuerpo procedural de respaldo: preferimos un personaje feo a una pantalla
vacía.

## Los rasgos de la cara

El modelo base viene con la cabeza lisa. Ojos, cejas, boca y nariz se construyen
en `lib/face.py` apoyándose en la superficie **real** del cráneo mediante
rayos, así que siguen la forma aunque el modelo cambie.

El ojo son seis capas apiladas contra la cara. Sus medidas están en
`EYE_LAYERS` y **no se ajustan a ojo**: `_check_eye_stack()` comprueba al
importar el módulo que cada capa asoma por delante de la de debajo y que su
borde queda por detrás. Sin esa comprobación el fallo es silencioso: el iris se
queda a la misma profundidad que el blanco, desaparece, y nada falla.

## Presupuesto

| Concepto | Valor |
|---|---|
| Cuerpo | 7.000 triángulos |
| Cara (18 piezas) | 1.660 triángulos |
| Huesos | 22 |
| GLB | ~330 KB |

Con diez jugadores en pantalla son unos 87.000 triángulos de personajes, que
junto a los ~32.000 del mapa dejan el fotograma holgado.

## Qué falta

- Reajustar la ropa a la nueva silueta: las prendas se diseñaron para el cuerpo
  procedural anterior y todavía no siguen el cuerpo real.
- Ojos, cejas y boca como piezas intercambiables de Blender, para que los slots
  de cara del vestidor vuelvan a ofrecer variantes.
- Clips de salto, caída, aterrizaje y daño.
