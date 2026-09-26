# Armas WWII y animaciones de arma

Fecha: 2026-09-26 · Estado: aprobado

Sustituir el catálogo de armas procedurales por las 13 mallas WWII de
`assets/source/weapons/weapons/LowPolyWWIIWeaponsSketchfab.blend`, y darles los
gestos que hacen que un shooter se sienta vivo: sacar el arma, recargar con el
cargador de verdad e inspeccionarla.

## Por qué

Las armas actuales se generan por código en Blender (`lib/weapons.py`, 262
líneas) a partir de bloques biselados. Cumplen, pero son maquetas. El pack trae
modelos reales de 176 a 2685 triángulos, y sobre todo trae **los cargadores como
objetos separados**, que es lo que permite que una recarga sea una recarga y no
un meneo de la muñeca.

## Decisiones tomadas

| Decisión | Elegido | Descartado |
| --- | --- | --- |
| Catálogo | Sustituye entero: 9 armas WWII en los 9 huecos | Convivir con las actuales; re-tematizar con nombres chibi |
| Animación | Procedural, con el camino al rig documentado | Riggear 9 armas y montar `AnimationMixer` |
| Inspeccionar | Lo ven los demás (patrón de los emotes) | Solo local; armería en el menú |
| Escala | 65 % uniforme | Por hueco con largo objetivo; tamaño real |

Sobran del pack y quedan en reserva: **NR-40**, **German Knife**, **M1911** y
**F1 Grenade**. No se exportan todavía; son el material obvio para skins o para
ampliar el catálogo más adelante.

## 1 · Pipeline de assets

`assets/blender/build_weapons.py` deja de construir geometría y pasa a
**importar, colocar y exportar**. `assets/blender/lib/weapons.py` se borra: ya no
hay armas procedurales que generar.

```
LowPolyWWIIWeaponsSketchfab.blend
        │  blender -b -P assets/blender/build_weapons.py
        ▼
apps/client/public/assets/models/weapons/weapons.glb
```

### Contrato de orientación (no cambia)

El que ya espera el cliente, documentado en el encabezado del script:

- El **origen** del objeto está en la **empuñadura**, donde lo agarra la mano.
- El **cañón** apunta a `+Y` en Blender → `-Z` en glTF (la dirección de disparo).
- La parte de **arriba** del arma es `+Z`.

### Lo que hay que corregir en origen

Medido sobre el `.blend`:

| | Estado en el pack | Hay que hacer |
| --- | --- | --- |
| Eje largo | `X` en armas de fuego y cuchillos, `Z` en granadas | Girar `+90°` sobre Z para llevar `+X → +Y` |
| Rotación | Toda a cero | — |
| Origen | Disperso por la escena (`-1.18` a `1.31` en X) | Trasladar a la empuñadura |
| Escala | 1:1 real (Garand 1,10 m) | Factor uniforme `0.65` |

El sentido del cañón (qué extremo del eje X es la boca) y la posición exacta de
la empuñadura **no se pueden deducir de la caja englobante** sin equivocarse. Van
en una tabla explícita en el script, un registro por arma:

```python
PIEZAS = {
    "stg_44": Pieza(
        malla="STG 44",
        cargador="STG 44 Maganize",
        volteada=False,      # True si la boca mira a -X
        empunadura=(x, y, z),  # en coordenadas del objeto original
    ),
    ...
}
```

Esos números se afinan mirando renders, no a ojo sobre el código.

### Cargadores

El cargador se exporta **emparentado a la malla del arma** y se llama
`<id>__mag`. Dos consecuencias buenas:

- `cloneWeapon` lo arrastra sin tocar nada: el `clone()` de Three ya es
  recursivo, y ya resetea la transformación del padre sin romper la local del
  hijo.
- El animador lo encuentra con `getObjectByName` y lo mueve suelto.

Las armas sin cargador extraíble (cuchillo, granadas, y el Garand, que usa
peine) no llevan `__mag`; el animador lo comprueba y usa un gesto sin cargador.

### Trampa: hay que APLICAR las transformaciones

`cloneWeapon` hace `clone.scale.set(1, 1, 1)` sobre el objeto que saca del GLB.
Con las armas procedurales daba igual, porque se construían ya a su tamaño final
con transformación identidad. Las del pack **no**: tienen escala de objeto
`0.0417` sobre una malla de 26 unidades de largo.

Si se exportan tal cual, el nodo del GLB lleva esa escala, el cliente la pisa con
`1` y el arma sale **24 veces más grande**. `export_apply=True` no salva: aplica
*modificadores*, no transformaciones de objeto.

El script tiene que hornear la transformación en los vértices antes de exportar,
y en este orden:

1. Colocar y girar el arma y su cargador en coordenadas de mundo (giro, escala
   0,65, y el sentido del cañón).
2. `transform_apply(location, rotation, scale)` sobre ambos.
3. Mover los dos para que la empuñadura caiga en el origen.
4. `transform_apply` otra vez.
5. Emparentar el cargador al arma **conservando la transformación**, de modo que
   su desplazamiento local quede bien.

Al terminar, cada arma exportada tiene transformación identidad, que es lo que el
cliente da por supuesto. Un test lo comprueba leyendo el GLB.

## 2 · Catálogo

`packages/config/src/weapons.ts` cambia de ids y de nombres. Los huecos
(`slot`) y el papel de cada arma se conservan, así que la economía y la tienda
siguen equilibradas.

| id | Nombre | slot | categoría | precio | daño | cad./s | cargador | recarga | `reloadStyle` | `drawTime` |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | --- | ---: |
| `ka_bar` | KA-BAR | melee | knife | 0 | 40 | 2 | — | — | `none` | 0,25 |
| `tt_pistol` | TT Pistol | secondary | pistol | 0 | 28 | 6 | 8/48 | 1,8 | `magazine` | 0,25 |
| `mauser_c96` | Mauser C96 | secondary | pistol | 700 | 60 | 2,5 | 10/30 | 2,4 | `magazine` | 0,25 |
| `ppsh_41` | PPSh-41 | primary | smg | 1200 | 22 | 12 | 35/105 | 2,2 | `magazine` | 0,5 |
| `thompson_m1` | Thompson M1 | primary | smg | 1400 | 30 | 8 | 20/80 | 2,6 | `magazine` | 0,5 |
| `stg_44` | StG 44 | primary | rifle | 2700 | 33 | 10 | 30/90 | 2,5 | `magazine` | 0,7 |
| `m1_garand` | M1 Garand | primary | sniper | 4500 | 80 | 3 | 8/32 | 3,0 | `clip` | 0,8 |
| `grenade_mk2` | Granada MK2 | grenade | grenade | 300 | 90 | 1 | 1 | — | `none` | 0,3 |
| `grenade_stick` | Stielhandgranate | grenade | grenade | 300 | 0 | 1 | 1 | — | `none` | 0,3 |

Cambios de equilibrio respecto al catálogo anterior, todos deliberados:

- **Desaparece la escopeta.** El pack no trae ninguna. El Thompson ocupa ese
  hueco como segundo subfusil: calibre .45, pega más que el PPSh y dispara más
  despacio. La categoría `shotgun` se elimina del tipo `WeaponCategory` porque
  se quedaría sin dueño, junto con sus ramas en `WeaponMesh`, `ViewModel` y
  `SynthAudio`. Volver a añadirla el día que haya una escopeta es una línea.
- **El M1 Garand sustituye al rifle de tirador.** El anterior hacía 115 de daño
  a 0,8 disparos/s; el Garand es semiautomático, así que baja a 80 y sube a 3
  disparos/s. Mantiene el precio y el papel: el arma cara de largo alcance.
- **La granada de palo hace de humo.** Es una licencia: en la realidad es
  explosiva. Se elige porque su silueta se distingue de la MK2 de un vistazo, y
  eso importa en el HUD y en el killfeed.

El Garand conserva `category: 'sniper'` aunque no lleve mira. Es una imprecisión
conocida: la categoría describe el **papel** (largo alcance, lento, caro), no el
tipo de arma real. Renombrarla a `marksman` es un cambio limpio para otro día.

### Campos nuevos

`WeaponDefinition` gana dos campos, ambos con significado de juego:

```ts
/** Segundos que tarda en poder dispararse tras sacarla. */
drawTime: number;
/** Cómo se anima la recarga: con cargador extraíble, con peine, o ninguna. */
reloadStyle: 'magazine' | 'clip' | 'none';
```

## 3 · Animación

### Dónde vive

Módulo nuevo `apps/client/src/entities/WeaponAnimator.ts`. Una sola clase con
un método por gesto y un `update(dt)` que devuelve la **pose** del arma
(posición, rotación) y la del cargador. El `ViewModel` la consume y la aplica;
no contiene ninguna curva.

```
ViewModel  ──usa──►  WeaponAnimator
  (cámara, bob,            (draw, reload,
   sway, munición)          inspect, fire)
```

Esta frontera es la que permite cambiar de animación procedural a clips sin
tocar el `ViewModel`: quien quiera sustituirla solo tiene que devolver la misma
pose leyéndola de un `AnimationMixer`. **Queda documentado en el encabezado del
módulo**, con la lista concreta de lo que haría falta (rig de manos en primera
persona, clips por arma, y el hueco donde enchufarlo), para cuando el personaje
tenga manos de verdad y deje de ser dos esferas.

### Los cuatro gestos

| Gesto | Duración | Qué hace |
| --- | --- | --- |
| `draw` | `drawTime` del arma | El arma entra desde abajo girada y se endereza |
| `reload` | `reloadTime` del arma | Baja e inclina · el cargador cae y se desvanece · entra el nuevo · golpe seco y vuelve |
| `inspect` | 2,0 s | Sube, gira para enseñar el lado, la inclina al otro y vuelve |
| `fire` | 0,1 s | Retroceso (ya existe en el `ViewModel`, se traslada aquí) |

Prioridad entre gestos: `fire` > `reload` > `draw` > `inspect`. Un gesto de más
prioridad **corta** al de menos.

Para `reloadStyle: 'clip'` (el Garand) el gesto de recarga no mueve ningún
cargador: la mano izquierda baja y sube, y el arma da un tirón arriba.

### Sacar el arma bloquea el disparo

`drawTime` lo **aplica el servidor**, no solo el cliente: `CombatSystem.onFire`
rechaza el disparo mientras el arma se está sacando, igual que ya rechaza
mientras se recarga. Sin esto la animación es decorativa y se ve el arma subir
mientras ya estás disparando.

- Se guarda `drawEndsAt` en `PlayerRuntime`, se fija en `onSwitch` y en
  `equipBest`.
- Valores: 0,25 s las pistolas y el cuchillo, 0,5 s los subfusiles, 0,7 s el
  StG 44, 0,8 s el Garand.
- **Es un cambio de equilibrio**, no solo visual: cambiar de arma para rematar
  deja de ser gratis.

## 4 · Inspeccionar

Sigue el camino ya abierto por los emotes, pieza por pieza:

| Capa | Qué se añade |
| --- | --- |
| `controls.ts` | `inspect: 'KeyF'` |
| `protocol/messages.ts` | `ClientMessage.Inspect`, `ServerMessage.Inspect`, `InspectBroadcast` |
| `MatchRoom` | Handler con cooldown (como el de emotes), exige jugador vivo |
| `MatchScene` | Tecla → `WeaponAnimator.inspect()` + enviar al servidor |
| `PlayerEntity` | `playInspect()`: el chibi baja la cabeza y gira el arma |

Se corta al disparar, recargar, cambiar de arma o morir. El cuchillo lleva un
giro propio, más lucido.

## 5 · Qué se borra

- `assets/blender/lib/weapons.py` (262 líneas de geometría procedural).
- La rama `shotgun` en `WeaponMesh`, `ViewModel` y `SynthAudio`.

**No se borra** la malla procedural de respaldo de `WeaponMesh.buildWeaponMesh`:
sigue siendo lo que evita una pantalla sin armas si falta el GLB. Se reduce a
las categorías que quedan.

## 6 · Pruebas

Lo que no puede romperse, en tests que corren en CI:

| Test | Comprueba |
| --- | --- |
| `weapons.test.ts` (nuevo, cliente) | El GLB trae una malla por cada id del catálogo; las que declaran `reloadStyle: 'magazine'` traen su `<id>__mag`; **cada arma tiene transformación identidad** (la trampa de arriba); el presupuesto de triángulos |
| `WeaponAnimator.test.ts` (nuevo) | Prioridad entre gestos; que `inspect` se corta al disparar; que ningún gesto deja la pose fuera de rango |
| `config.test.ts` (existente) | Ids = claves, precios ≥ 0 |
| `match.e2e.test.ts` (existente) | Se actualizan los ids; **nuevo caso**: no se puede disparar durante `drawTime` |

Y la comprobación que ningún test da: **renderizar las 9 armas montadas en la
mano del personaje y mirarlas**, más una partida real con captura. Que compile
no dice nada sobre si el arma está agarrada del revés.

## Orden de trabajo

1. Pipeline y tabla de piezas → `weapons.glb` con las 9 armas bien orientadas.
   Verificar con renders antes de seguir.
2. Catálogo nuevo en config + actualizar los ids en los tests.
3. `WeaponAnimator` con los cuatro gestos, consumido por el `ViewModel`.
4. `drawTime` en el servidor.
5. Inspeccionar, de la tecla a la tercera persona.
6. Limpieza de lo procedural y de la categoría `shotgun`.
7. Verificación visual en partida con dos jugadores.
