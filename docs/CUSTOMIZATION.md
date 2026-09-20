# Personaje y personalización

ChibiStrike tiene **un solo personaje jugable**. Todos los jugadores usan el
mismo cuerpo base y construyen su identidad en el vestidor. No hay clases ni
arquetipos: dos jugadores nunca tienen siluetas de distinto tamaño, porque
comparten exactamente la misma hitbox.

Cómo se modela y se exporta el personaje está en [PERSONAJE.md](PERSONAJE.md).
Este documento cubre el **catálogo** y cómo se monta un avatar en el cliente.

## Montar un avatar

El personaje entero (cuerpo, cara y guardarropa) llega en un solo GLB con un
único esqueleto. Montar un avatar es por tanto:

```
clonar el modelo → borrar lo que no lleva puesto → pintar los colores
```

No hay «enganchar una prenda a un hueso»: la ropa está enlazada al mismo
esqueleto que el cuerpo, así que se dobla con él.

| Archivo | Responsabilidad |
| --- | --- |
| `apps/client/src/customization/glb.ts` | Carga el GLB y lo clona por jugador con `SkeletonUtils.clone` |
| `apps/client/src/customization/rig.ts` | Medidas del personaje y adopción del esqueleto del modelo |
| `apps/client/src/customization/AvatarBuilder.ts` | Clona, filtra las piezas puestas y devuelve el modelo listo |
| `packages/config/src/customization.ts` | El catálogo: slots, items, colores y avatar por defecto |

`SkeletonUtils.clone` es obligatorio. El `clone` normal de Three duplica las
mallas pero las deja apuntando al esqueleto original, y entonces todos los
jugadores se moverían a la vez.

## El contrato de nombres

Cada malla de ropa dentro del GLB se llama `<idDelCosmetico>__<Parte>`. Ese
prefijo es **literalmente** el `id` del catálogo.

Si los dos dejan de coincidir, el jugador elige una prenda y no aparece nada,
sin ningún error en consola. Por eso hay dos pruebas que lo vigilan:

- cada cosmético con modelo tiene su malla dentro del GLB;
- el GLB no trae piezas que el catálogo no ofrezca.

## Slots

| Grupo | Slots |
| --- | --- |
| Cara | `eyes`, `brows`, `mouth` |
| Cabeza | `hair`, `headwear`, `eyewear`, `headAccessory` |
| Ropa | `top`, `outer`, `bottom`, `shoes`, `hands` |
| Extras | `back`, `weaponSkin` |

- `SLOT_ORDER` fija el orden de montaje. Importa de verdad: el chaleco tiene que
  ir por fuera de la sudadera.
- `NON_BODY_SLOTS` (`weaponSkin`) no monta geometría en el cuerpo: lo aplica el
  arma.
- `REQUIRED_SLOTS` no admite «vacío». El resto sí lleva una opción «Nada».

El catálogo es **corto a propósito**: pocas opciones bien acabadas en vez de un
muestrario a medias. Añadir una pieza nueva es construirla en
`assets/blender/lib/wardrobe.py`, darla de alta en `ITEMS` y añadir su entrada
al catálogo con el mismo id.

## Colores

Cinco canales: `skin`, `hair`, `eyes`, `primary`, `secondary`. En el modelo, un
material llamado `Recolor_<canal>` se clona por jugador y se pinta con el color
elegido. Un material sin ese prefijo conserva siempre su color (la suela clara
de las zapatillas, el negro de los guantes).

## Sliders

La altura total **siempre** es la de la cápsula de juego
(`GAMEPLAY.player.capsuleHeight`, 1,20 m). Como la malla viene horneada desde
Blender, los sliders no pueden deformarla: el tamaño de cabeza se aplica como
escala del hueso `head`.

## Reglas que el sistema garantiza

- **La silueta nunca se sale de la hitbox.** Hay una prueba que lo comprueba.
- **La ropa exterior siempre queda por fuera de la interior.** Lo garantiza el
  escalonado de capas al construir el modelo, no el orden de dibujado.
- **Con gorro puesto, los mechones sueltos del pelo se ocultan.** Atravesarían
  cualquier gorra. El casquete sí se queda.
- **Una prenda nunca se separa del cuerpo al animarse**, porque comparte sus
  pesos.

## Red

El avatar viaja como una cadena corta (`encodeAvatar`) dentro del estado del
jugador. El servidor la sanea con `sanitizeAvatar`: cualquier id desconocido o
colocado en el slot que no le toca se sustituye por el del avatar por defecto.
