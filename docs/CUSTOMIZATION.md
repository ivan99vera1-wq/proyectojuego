# Personaje y personalización

TinyStrike tiene **un solo personaje jugable**. Todos los jugadores usan el mismo cuerpo base y construyen su
identidad en el vestidor. No hay clases ni arquetipos: dos jugadores nunca tienen siluetas de distinto tamaño,
porque comparten exactamente la misma hitbox.

## 1. El personaje base

Hoy el cuerpo es **procedural**: se genera en el cliente con un kit de geometría propio, sin necesidad de assets.
Cuando exista arte GLB se sustituye pieza a pieza sin tocar el rig, la red ni las reglas.

| Archivo | Responsabilidad |
| --- | --- |
| `apps/client/src/customization/geometry.ts` | Kit de formas: secciones superelípticas lofteadas, oclusión horneada en vértices, unión de mallas |
| `apps/client/src/customization/profiles.ts` | Perfiles del cuerpo (cráneo, torso, brazos, piernas, pie, mano) y utilidades para recortarlos e inflarlos |
| `apps/client/src/customization/rig.ts` | Medidas del personaje, reparto de proporciones y jerarquía de huesos y sockets |
| `apps/client/src/customization/body.ts` | Anatomía: construye las mallas del cuerpo sobre el rig y las cachea |
| `apps/client/src/customization/parts/` | Constructores de cosméticos: `face.ts`, `hair.ts`, `clothing.ts` |
| `apps/client/src/customization/AvatarBuilder.ts` | Orquesta todo: proporciones → rig → cuerpo → cosméticos |

### Por qué secciones superelípticas

Una superelipse `|x/w|ⁿ + |z/d|ⁿ = 1` pasa de elipse (n = 2) a caja redondeada (n = 6) con el mismo código.
Encadenando secciones a distintas alturas se obtienen **cambios de volumen reales**: mandíbula, hombros, cintura,
codo, rodilla, tobillo y suela. Eso es exactamente lo que separa un personaje diseñado de un montón de cápsulas.

### Proporciones

La altura total **siempre** es la de la cápsula de juego (`GAMEPLAY.player.capsuleHeight`, 1,20 m). Los sliders
reparten esa altura entre cabeza, torso y piernas, pero nunca la cambian.

| Zona | Altura desde el suelo |
| --- | --- |
| Tobillo | 0,085 m |
| Rodilla | 0,255 m |
| Cadera | 0,465 m |
| Hombro | 0,656 m |
| Mentón | 0,745 m |
| Coronilla | 1,200 m |

La cabeza ocupa el 38 % de la altura: proporción chibi de 1:2,6.

## 2. Huesos y sockets

```
root
└── hips
    ├── torso ── chest · back · neck ── head ── hairSocket · headwearSocket · eyewearSocket
    │   │                                        headAccessorySocket · eyeSocket · browSocket
    │   │                                        mouthSocket · earSocketL/R
    │   ├── shoulderL/R ── elbowL/R ── handL/R ── gripR (punto de agarre del arma)
    └── hipL/R ── kneeL/R ── ankleL/R
```

Los rasgos de la cara no usan posiciones fijas: se anclan a la **superficie real del cráneo** con
`headSurfaceAt(y, x)` y se orientan con su normal (`headSurfaceYaw`). Por eso los ojos siguen apoyados en la
mejilla aunque el jugador cambie el tamaño de la cabeza.

## 3. Slots de personalización

| Grupo | Slots |
| --- | --- |
| Cara | `eyes`, `brows`, `mouth`, `face` |
| Cabeza | `hair`, `headwear`, `eyewear`, `headAccessory` |
| Ropa | `top` (camiseta), `outer` (chaqueta o chaleco), `bottom`, `shoes`, `hands` |
| Extras | `back`, `accessory`, `weaponSkin`, `trail`, `killEffect` |

- `REQUIRED_SLOTS` no admiten "nada": pelo, ojos, cejas, boca, rostro, camiseta, pantalón y calzado.
- `NON_BODY_SLOTS` (`weaponSkin`, `trail`, `killEffect`) no montan geometría en el cuerpo: los aplican el arma y los efectos.
- `SLOT_ORDER` fija el orden de montaje para que la chaqueta caiga sobre la camiseta y la bota sobre el pantalón.

## 4. Cómo se construye una prenda

Una prenda **no cambia el color del cuerpo**: es una capa construida sobre el perfil de la zona que cubre.

```ts
// Recorta el tramo del cuerpo, engorda el grosor de la tela y marca el dobladillo
attach(rig.torso, shell(torsoProfile(p), T * -0.14, T * 0.94, 0.020, 0.2), cloth(color));
sleeve(c, 0.019, 1.0, 0.55);   // manga sobre brazo y antebrazo
c.hide('torso', 'armUpper');   // oculta la piel que queda debajo
```

Por eso una chaqueta gruesa ensancha de verdad los hombros y unas botas cambian la silueta del pie.

### Añadir un cosmético

1. Entrada en `packages/config/src/customization.ts` con su `slot`, precio y rareza.
2. Constructor en `apps/client/src/customization/parts/<zona>.ts`, usando los perfiles y sockets del rig.
3. `npm test`: hay pruebas que exigen constructor para todo id del catálogo y que la silueta cambie de verdad.

## 5. Colores y proporciones

- **Canales de color**: piel, cabello, ojos, principal y secundario. Cada prenda decide qué canal usa y con qué
  matiz (`shade()` aclara u oscurece), así una misma paleta da conjuntos coherentes.
- **Sliders**: tamaño de cabeza, tamaño de ojos, ancho de cuerpo y proporción piernas/torso. El torso absorbe la
  diferencia para que la altura total no cambie nunca.

## 6. Reglas que no se pueden romper

1. **La hitbox manda.** La geometría visible del cuerpo cabe dentro de la cápsula de juego y la cabeza visible
   dentro de la esfera de headshot. Hay un test que lo comprueba con distintos sliders.
2. **Los cosméticos no dan ventaja.** Pueden sobresalir de la hitbox (orejas de gato, alas, puntas del pelo), lo
   que significa que esas partes *no* son impactables. Nunca al revés.
3. **Prueba de silueta.** Un personaje completamente en negro debe seguir leyéndose como personaje: cabeza,
   hombros, torso, brazos, piernas y pies. Cambiar de pelo, chaqueta o calzado debe cambiar esa silueta.
4. **Un solo personaje.** Si aparece la tentación de añadir un segundo cuerpo, es un cosmético.

## 7. Rendimiento

Las geometrías del cuerpo se cachean por proporciones y se comparten entre jugadores: dos avatares con los mismos
sliders usan los mismos buffers en GPU. `dispose()` de un avatar libera solo sus materiales y sus piezas propias.
Un personaje completo ronda los 2.500 triángulos y unas 40 llamadas de dibujo.

## 8. Migración a arte GLB

El rig ya tiene la jerarquía que tendrá el modelo final. Migrar un id consiste en sustituir su constructor
procedural por una carga de GLB enganchada al mismo socket. Convenciones de exportación en `docs/ASSET_PIPELINE.md`.
