# El personaje

ChibiStrike tiene **un solo personaje** y no hay personalización. Todos los
jugadores usan el mismo cuerpo, así que nadie es más difícil de acertar que
otro: la silueta visible y la hitbox son las mismas para todos.

## De dónde sale

El modelo es *Caveman Boy*, que vive en `assets/source/caveman_boy.glb`. **Ese
archivo no se modifica nunca.** El proceso lo lee, trabaja sobre una copia y
escribe en otro sitio.

Llega como una escultura, no como un modelo de juego: 966.000 triángulos, 30 MB,
sin esqueleto, mirando hacia otro lado y con un martillo de piedra en la mano.

## Cómo se construye

Dos pasos, en este orden:

```bash
Blender --background --python assets/blender/build_base.py       # 1
Blender --background --python assets/blender/build_character.py  # 2
```

| | Antes | Después |
|---|---|---|
| Triángulos | 966.000 | 13.000 |
| Textura | 4096 px | 1024 px |
| Archivo | 30 MB | 0,7 MB |
| Huesos | 0 | 22 |

## Quitar el martillo

Es la parte delicada, porque el martillo **está soldado al cuerpo**: no es una
malla aparte ni una isla separada. Se quita en tres pasos, y ninguno basta por
sí solo.

**1. La cabeza de piedra, por color.** Es la única mancha gris grande del
modelo: la piel es naranja, el pelo marrón y la cinta amarilla. Se coge la
región gris conectada más extensa.

**2. El mango, creciendo desde ahí.** La almohadilla del martillo es color piel
y queda justo entre la piedra y el mango, así que un relleno que se detenga en
cualquier vértice de piel no pasa de ahí. Se admite piel solo muy cerca de la
piedra; más lejos ya es la mano.

**3. El tramo que atraviesa el puño, con un cilindro.** Ni el color ni un plano
sirven aquí. La madera del mango y la piel comparten rango de color (está
comprobado muestreando la textura) y la mano **envuelve** el mango, así que no
hay plano que los separe. Se quita con un cilindro sobre el eje del mango,
medido en una vista ortográfica calibrada. Se lleva por delante los dedos que lo
rodean, pero el hueco queda dentro del puño y no se ve.

Después quedan anillos sueltos entre los dedos. Como el personaje es una única
malla enorme, cualquier trozo suelto es basura y se descarta por tamaño.

### La trampa de las coordenadas

El importador de glTF cuelga las mallas de un nodo que convierte Y-up en Z-up.
Sin soltar ese padre, `transform_apply` deja las coordenadas en el espacio del
**padre**, no en el del mundo. Todo lo que se mida luego sobre un render (que sí
usa coordenadas de mundo) sale desplazado, y las cosas se borran donde no son.

Por eso `load_source()` hace `parent_clear` antes de aplicar nada.

## Simetría

Al quitar el martillo se va con él la mano derecha, porque los dedos envuelven
el mango. En vez de reconstruirla a mano, el modelo se corta por su plano de
simetría y se refleja el lado intacto.

El plano se mide en los **pies**: están lejos del martillo y de la melena, que
son las dos zonas asimétricas. De paso el personaje queda perfectamente
simétrico, que es justo lo que conviene para animarlo.

## Los pesos

Los pesos **no** los calcula Blender.

Su método por calor necesita una superficie cerrada y coherente. Esta malla
viene de una herramienta generativa y además le hemos abierto un boquete, así
que devuelve todos los pesos a cero **sin dar ningún error**. El método de
envolventes sí funciona, pero deforma fatal: estira la cabeza y rompe la cara.

Lo que hace `rig.skin()` es lo que haría un artista, automatizado:

1. cada vértice se asigna entero al hueso cuyo segmento tiene más cerca;
2. esa asignación se suaviza promediando con los vértices **vecinos**, catorce
   veces. En las articulaciones eso crea el degradado que hace que el codo o la
   rodilla se doblen de forma natural.

El paso 2 es seguro porque solo promedia a través de **aristas de la malla**: la
mano no puede contagiar peso al muslo aunque pasen cerca, porque no están
conectados.

## El esqueleto

22 huesos con nombres estándar, en `lib/rig.py`:

```
root  hips  spine  chest  neck  head
shoulder.L/R  upperarm.L/R  forearm.L/R  hand.L/R
thigh.L/R  shin.L/R  foot.L/R  toe.L/R
```

Las articulaciones salen de **medir la malla**: el cuello es la franja
horizontal más estrecha entre la cabeza y los hombros. Los números viven en
`lib/proportions.py`.

### La alineación de los huesos

Antes de exportar, `flatten_orientations()` deja todos los huesos apuntando
hacia arriba con roll 0. No es un capricho.

El cliente anima girando huesos (`hueso.rotation.x = ...`). En glTF cada hueso
guarda su transformación respecto a su padre, así que si cada hueso mira en una
dirección distinta, esa misma línea gira sobre un eje distinto en cada
articulación. Con los huesos alineados, rotar un hueso significa lo mismo que
rotar un grupo normal de Three.js.

Se comprueba con:

```bash
node tools/check-bone-axes.mjs apps/client/public/assets/models/characters/character.glb
```

### Las clavículas

El rig del cliente tiene `clavicleL` y `clavicleR` para **repartir los giros
grandes del brazo**. Subir el hombro de golpe retuerce la malla y hunde el
deltoides; con una tercera parte del giro en la clavícula, el hombro conserva su
volumen.

## Orientación

El personaje mira hacia **+Y en Blender**, que tras exportar a glTF con «+Y
arriba» se convierte en **−Z en el juego**, la dirección de avance.

| | Blender | Juego |
|---|---|---|
| Frente / pecho | +Y | −Z |
| Espalda | −Y | +Z |

## Cómo llega al juego

`apps/client/src/character/glb.ts` carga el GLB y lo clona por jugador con
`SkeletonUtils.clone`. El clon normal de Three duplica las mallas pero las deja
apuntando al esqueleto original, y entonces todos los jugadores se moverían a la
vez.

`rig.ts::rigFromSkeleton` adopta ese esqueleto: cada hueso pasa a ocupar el sitio
que antes tenía un grupo vacío. El cargador de glTF se come los puntos de los
nombres, así que `upperarm.L` llega como `upperarmL`; `boneKey()` normaliza los
dos lados.

## Animación

Todo es procedural, en `entities/PlayerEntity.ts`. Lo importante:

- **Idle con respiración.** Dos ondas de periodo distinto mueven cadera, torso y
  cabeza. Una sola se lee como un pulso mecánico. Sin esto el personaje parado
  es un maniquí, y eso es lo que separa un juego de una demo.
- **Ciclo de piernas** con la rodilla doblando solo hacia atrás y el tobillo
  compensando para que el pie no atraviese el suelo.
- **Postura de apuntar** repartida entre clavícula, hombro y codo.

## Qué falta

- Clips exportados desde Blender, para gestos que la animación procedural no
  alcanza.
- Personalización, cuando el personaje base esté cerrado.
