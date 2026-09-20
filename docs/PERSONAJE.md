# El personaje principal

ChibiStrike tiene **un solo personaje jugable**: un chibi masculino. Todos los
jugadores usan ese mismo cuerpo y esqueleto, y construyen su identidad con el
vestidor.

## De dónde sale

La malla base es el modelo *Chibi Base Mesh Character (Male)* de Sketchfab, que
vive en `assets/source/`. **Ese archivo no se modifica nunca.** Todo el proceso
lo lee, trabaja sobre una copia y escribe en otro sitio; `build_base.py` aborta
si alguna vez fuera a escribir encima del original.

El modelo original es solo el punto de partida: llega como un maniquí neutro de
4,45 unidades, sin esqueleto, sin cara y mirando hacia el lado contrario.

## Cómo se construye

Dos pasos, en este orden:

```bash
Blender --background --python assets/blender/build_base.py       # 1
Blender --background --python assets/blender/build_character.py  # 2
```

**1. `build_base.py`** congela el espejo y la subdivisión, mete la escala y la
rotación dentro de la malla, deja al personaje de pie sobre z = 0 centrado en el
eje, lo escala a la altura exacta de la cápsula de colisión (1,20 m) y le da
media vuelta para que mire hacia +Y. Después lo reduce al presupuesto de
triángulos. Deja `out/base_male.blend`.

**2. `build_character.py`** aplica los retoques de forma que lo convierten en
*este* personaje (`lib/shape.py`: plano facial, reborde de ceja, mandíbula,
hombros, cintura), le añade la cara, construye el esqueleto, calcula los pesos,
monta el guardarropa y exporta todo junto.

## Un solo archivo para todo

Cuerpo, cara y ropa van en **un único GLB con un solo esqueleto**. No hay un
archivo por prenda.

El motivo es práctico: la ropa está enlazada al mismo esqueleto que el cuerpo.
Si cada prenda viviera en su propio archivo habría que reenlazarla al esqueleto
del jugador en tiempo de ejecución, con el riesgo de que el orden de los huesos
no coincida. Con un único archivo, el cliente clona el modelo y **borra las
mallas que el jugador no lleva puestas**.

Cada malla de ropa se llama `<idDelCosmetico>__<Parte>`. Ese prefijo es
literalmente el `id` del catálogo en `packages/config/src/customization.ts`, y
hay una prueba que falla si dejan de coincidir.

## La ropa se deriva del cuerpo

Una prenda ajustada **no se modela al lado del cuerpo**: se copia la región de
la malla que cubre y se separa un poco por su normal (`wardrobe.derive`).

Eso resuelve de raíz los dos problemas del sistema anterior:

- **El ajuste es exacto**, porque la prenda *es* la superficie del cuerpo
  desplazada. No puede quedar flotando ni encajarse dentro.
- **El peso es exacto**, porque la copia se lleva los grupos de vértices del
  cuerpo y se deforma igual que él. Una manga no se puede separar del brazo.

Las piezas con volumen propio (bolsas, hebillas, visera) se modelan aparte y
reciben los pesos del cuerpo por transferencia. Los pesos se recalculan
**siempre sobre la malla ya unida**: si no, las cajas modeladas a mano se
quedarían con peso cero y el esqueleto las mandaría al origen del mundo.

### Tres detalles que costaron encontrar

**Los bordes se cortan con un plano, no borrando vértices.** Borrar deja un
canto en dientes de sierra flotando a la altura del grosor; era el aspecto
"roto" que tenían los bajos del pantalón. Además el grosor se desvanece hacia
el borde, para que la prenda nazca de la piel en vez de acabar en un filo.

**Las capas están escalonadas** (`wardrobe.LAYER`). Una prenda exterior nunca
puede adelgazar por debajo del grosor de la interior, o en el borde se mete
debajo y la camiseta asoma en manchas a través del chaleco.

**Los detalles se apoyan lanzando un rayo** contra la prenda ya construida
(`front_y`, `side_x`, `radial_hit`), no con fracciones del ancho del pecho.
Colocarlos "a ojo" los deja flotando o hundidos en cuanto cambia la forma.
Cuidado con la dirección del rayo: un rayo vertical lanzado cerca del eje del
cuerpo golpea la **cabeza**, no el hombro. Por eso la correa del chaleco se
deriva del hombro en vez de trazarse con rayos.

## Orientación

El personaje mira hacia **+Y en Blender**, que tras exportar a glTF con «+Y
arriba» se convierte en **−Z en el juego**, la dirección de avance.

De ahí se deduce todo lo demás, y conviene tenerlo presente:

| | Blender | Juego |
|---|---|---|
| Frente / pecho | +Y | −Z |
| Espalda | −Y | +Z |

Una mochila va en −Y de Blender. Ponerla en +Y la coloca sobre el pecho, que es
exactamente el fallo que tenía el sistema anterior: los sockets `chest` y `back`
del rig del cliente estaban intercambiados.

## El esqueleto

22 huesos con nombres estándar, en `lib/rig.py`:

```
root  hips  spine  chest  neck  head
shoulder.L/R  upperarm.L/R  forearm.L/R  hand.L/R
thigh.L/R  shin.L/R  foot.L/R  toe.L/R
```

Las articulaciones salen de **medir la malla**: el cuello es la franja
horizontal más estrecha entre la cabeza y los hombros, la rodilla y el tobillo
son los mínimos de grosor de la pierna, la entrepierna es la altura a la que las
piernas dejan de tocarse. Los números viven en `lib/proportions.py`.

### La alineación de los huesos

Antes de exportar, `flatten_orientations()` deja **todos los huesos apuntando
hacia arriba con roll 0**. No es un capricho.

El cliente anima girando huesos (`hueso.rotation.x = ...`). En glTF cada hueso
guarda su transformación respecto a su padre, así que si cada hueso mira en una
dirección distinta, esa misma línea gira sobre un eje distinto en cada
articulación. Con los huesos alineados, rotar un hueso significa lo mismo que
rotar un grupo normal de Three.js, y el sistema de animación que ya existía
siguió funcionando sin cambios.

Se comprueba con:

```bash
node tools/check-bone-axes.mjs apps/client/public/assets/models/characters/character.glb
```

Cambiar la orientación de reposo cuando la pose es la de reposo **no deforma la
malla**, porque el modificador Armature multiplica la pose por la inversa del
reposo y sale la identidad. Por eso se puede hacer después de calcular los pesos.

### Las clavículas

El rig del cliente tiene dos huesos que el modelo usa poco: `clavicleL` y
`clavicleR`. Existen para **repartir los giros grandes del brazo**. Subir el
hombro 140 grados de golpe retuerce la malla y hunde el deltoides; con una
tercera parte del giro en la clavícula, el hombro conserva su volumen.

## Los rasgos de la cara

El modelo base viene con la cabeza lisa. Ojos, cejas, boca y nariz se construyen
en `lib/face.py` apoyándose en la superficie **real** del cráneo mediante rayos.

Hay tres variantes de ojo, tres de ceja y tres de boca. Todas salen de la misma
construcción con otros parámetros, así que ninguna variante puede romper el ojo.

El ojo son seis capas apiladas contra la cara. Sus medidas están en `EYE_LAYERS`
y **no se ajustan a ojo**: `_check_eye_stack()` comprueba al importar el módulo
que cada capa asoma por delante de la de debajo y que su borde queda por detrás.
Sin esa comprobación el fallo es silencioso: el iris se queda a la misma
profundidad que el blanco, desaparece, y nada falla.

## Las piezas rígidas

Un casco o unas gafas no se deforman: se cuelgan enteros de un hueso con un
grupo de vértices al 100 %. Antes de enlazarlas hay que **hornear su
transformación en los vértices**, porque al exportar a glTF una malla con skin
ignora la transformación de su nodo. Si no se hornea, el iris aparece en el
origen y el ojo se descompone.

## Pelo bajo un gorro

Cada peinado se exporta en dos partes: `__Cap` (el casquete, pegado al cráneo) y
`__Locks` (los mechones sueltos). Cuando el jugador lleva algo en la cabeza, el
cliente **borra los mechones** y deja solo el casquete: los mechones
atravesarían cualquier gorra.

## Presupuesto

| Concepto | Valor |
|---|---|
| Cuerpo | 7.000 triángulos |
| Modelo completo con todo el guardarropa | ~34.000 triángulos |
| Un jugador vestido en pantalla | ~13.000 triángulos |
| Huesos | 22 |
| Llamadas de dibujo en el vestidor | 30 |

## Qué falta

- Clips de animación exportados desde Blender. Hoy todo es procedural en
  `PlayerEntity.ts`, que funciona bien pero limita los gestos.
- Más variantes de cada slot cuando el estilo esté cerrado.
