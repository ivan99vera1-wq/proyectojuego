# Presentación visual

Este documento recoge las decisiones de dirección de arte: qué hace que
ChibiStrike parezca un juego y no una demo técnica.

## El diagnóstico

La pantalla inicial era un personaje sobre una **plataforma circular** flotando
en un fondo vacío, con una sola luz direccional. Eso es exactamente el aspecto
de un ejemplo de Three.js, y por cuatro motivos concretos:

| Síntoma | Causa |
|---|---|
| Parecía un maniquí en una peana | No había escenario: solo un disco y niebla |
| Todo el mismo tono | Una luz direccional y un ambiente plano |
| Imagen sin profundidad | Un único plano de distancia, sin primer plano ni fondo |
| El personaje, inmóvil | El idle no tenía respiración ni peso |
| Interfaz sin jerarquía | Todos los botones con el mismo peso visual |
| Mapa como plano de colores | Sol casi cenital: todas las caras recibían igual |

## Lo que se hizo

### Escenario, no peana

`world/MenuStage.ts` construye un rincón del mundo con **tres planos de
distancia**, que es lo que crea la sensación de profundidad:

```
PRIMER PLANO   hierba y una roca recortando el borde del encuadre
PERSONAJE      sobre un claro de tierra, con una hoguera al lado
FONDO          arboleda y dos filas de colinas que se pierden en niebla
```

Todo es geometría sencilla y de un solo color: el acabado lo pone la luz, no el
detalle. El menú entero cuesta unos 14.000 triángulos.

### Luz que da volumen

Tres puntos, como en un estudio, más la hoguera:

- **Sol cálido por detrás.** Recorta la silueta del personaje contra el fondo.
  Es lo que separa una figura de un recorte plano.
- **Relleno frío desde la cámara.** Levanta las sombras sin aplanar el volumen.
- **Hemisférica** con el color del cielo arriba y el del suelo abajo.
- **Hoguera** que parpadea con dos ondas de periodo distinto.

En partida, el sol pasó de casi cenital a **bajo y de lado**. Con la luz cenital
todas las caras recibían lo mismo y el mapa se leía como un plano de colores;
con el sol tumbado cada volumen tiene una cara clara y otra en sombra.

El relleno se bajó a propósito: un relleno fuerte levanta las sombras hasta
borrarlas, y sin sombras no hay volumen.

### Tono de imagen

`ACESFilmicToneMapping` comprime las altas luces en vez de quemarlas. Sin esto
el cielo y las caras al sol se van a blanco plano y la imagen pierde el color.

### Composición

La cámara del menú usa **38 grados** de campo y va algo por debajo del pecho.
Con los 45 anteriores y la cámara alta, el personaje quedaba pequeño y el suelo
se comía media pantalla.

El personaje va **descentrado**, con el panel de interfaz a un lado, y su giro
en reposo oscila poco alrededor del ángulo exacto al que mira a cámara: si gira
de más se pone de perfil y pierde la mirada.

### Interfaz

Se conservó toda la estructura funcional. Lo que cambió:

- **Jerarquía en tres niveles.** Una sola acción principal (`primary`), el resto
  normales, y los ajustes en `subtle` y separados por una línea.
- **Etiquetas de campo** en mayúsculas pequeñas y apagadas: informan sin
  competir.
- **Elevación coherente.** Cuanto más "arriba" está un elemento, más larga es su
  sombra (`--shade-1/2/3`).
- **Ritmo de espaciado** con cuatro pasos fijos, en vez de números sueltos.
- **Estados** de hover, active y focus visibles, con transiciones cortas.

La regla: el juego está detrás. Los paneles flotan sobre él con desenfoque y
sombra larga, nunca lo tapan del todo.

### El personaje, vivo

El idle respira. Dos ondas de periodo distinto mueven cadera, torso y cabeza, y
se desvanecen al andar. Una sola onda se lee como un pulso mecánico.

## Qué falta

- Llevar el lenguaje visual del menú a los mapas: hoy son cajas de colores bien
  iluminadas, no un mundo construido.
- Oclusión ambiental y algún efecto de posproceso.
- Variantes de hora del día por mapa.
