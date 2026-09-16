# Sistema de personalización de chibis

Config en `packages/config/src/customization.ts` y `characters.ts`. Validación en `packages/shared/src/rules/avatar.ts`.

## Modelo de datos (`AvatarConfig`)
```ts
{
  character: 'spark',                              // arquetipo (rig base + voz)
  items: { hair: 'hair_bob', headwear: 'headwear_cat_ears', ... },  // un id por slot
  colors: { skin, hair, eyes, primary, secondary },  // hex
  sliders: { headSize, eyeSize, bodyWidth, height }, // 0..1 normalizado
}
```
Se guarda en `localStorage` (`<codename>:avatar`), en el perfil del servidor y se sincroniza a la sala como JSON.

## Slots
`hair · eyes · face · headwear · eyewear · top · bottom · shoes · back · hands · accessory · weaponSkin · trail · killEffect`

`REQUIRED_SLOTS` no admiten "nada"; el resto tienen un item `*_none` con `model: ''`.

## Rig base (Blender → GLB)
Un único esqueleto humanoide chibi (`chibi_base.glb`) para todos los arquetipos. Huesos obligatorios (nombres exactos):
`Root, Hips, Spine, Chest, Neck, Head, Shoulder.L/R, UpperArm.L/R, LowerArm.L/R, Hand.L/R, UpperLeg.L/R, LowerLeg.L/R, Foot.L/R`.

### Sockets (Empties hijos de huesos)
| Socket | Padre | Recibe |
| --- | --- | --- |
| `SOCKET_Hair` | Head | hair |
| `SOCKET_Headwear` | Head | headwear |
| `SOCKET_Eyewear` | Head | eyewear |
| `SOCKET_Back` | Chest | back |
| `SOCKET_Accessory` | Neck | accessory |
| `SOCKET_WeaponR` | Hand.R | arma / weaponSkin |
| `SOCKET_Trail` | Hips | trail |

`top`, `bottom`, `shoes`, `hands`, `eyes` y `face` son mallas **skinned** al mismo esqueleto (se exportan con la armadura
y se sustituyen por completo).

### Morph targets (sliders)
Shape keys en la malla base: `HeadSize, EyeSize, BodyWidth, Height`. Los sliders (0..1) se mapean a `influence`.
Los cosméticos skinned deben incluir las mismas shape keys para deformarse a la vez.

### Recolor
Cualquier material cuyo nombre empiece por `Recolor_<canal>` (p. ej. `Recolor_hair`, `Recolor_primary`) recibe el color
del canal correspondiente. Materiales sin ese prefijo no se tocan. Así un mismo gorro sirve para todas las paletas.

## AvatarBuilder (cliente, Fase 2)
```
build(config):
  base   = load(CHARACTERS[config.character].baseModel)
  scale  = CHARACTERS[...].scale ; headScale a hueso Head
  for slot, id in config.items:
     item = COSMETICS[id]; if item.model == '' continue
     glb  = load('cosmetics/' + item.model)
     if skinned(glb): rebind to base skeleton; replace default mesh of that slot
     else: attach to SOCKET_<slot>
     applyRecolor(glb, config.colors)
  applyMorphs(base, config.sliders)
  return group
```
Las cargas se cachean (`AssetLoader`) y se clonan con `SkeletonUtils.clone` para 10 jugadores.

## Reglas de justicia
- La hitbox es idéntica para todos (`GAMEPLAY.player`), sin importar altura o cabeza.
- Ningún cosmético reduce visibilidad del rival ni emite luz que delate posición… salvo que el jugador quiera (trails).
