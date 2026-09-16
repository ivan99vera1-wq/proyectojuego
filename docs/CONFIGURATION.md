# Referencia de configuración (`packages/config`)

Toda la configuración es TypeScript con `as const`, lo que da autocompletado y tipos derivados
(`WeaponId`, `CosmeticId`, `MapId`…). Tras cambiar algo ejecuta `npm test` (valida coherencia) y `npm run typecheck`.

| Archivo | Exporta | Úsalo para |
| --- | --- | --- |
| `branding.ts` | `BRANDING`, `TeamId` | nombre, codename, eslogan, versión, appId, urls, colores, equipos |
| `gameplay.ts` | `GAMEPLAY` | tick rate, gravedad, salud/armadura, cápsula, velocidades, salto, daño por caída, multiplicadores de hitbox, tiempos de ronda, formato de partida, límites de texto |
| `weapons.ts` | `WEAPONS`, `EQUIPMENT`, `DEFAULT_LOADOUT`, tipos | catálogo de armas y equipo; loadout inicial |
| `economy.ts` | `ECONOMY` | dinero inicial/máximo, recompensas |
| `characters.ts` | `CHARACTERS`, `DEFAULT_CHARACTER`, `ANIMATION_CLIPS` | arquetipos chibi, nombres de clips que el rig debe tener |
| `customization.ts` | `COSMETICS`, `DEFAULT_AVATAR`, `COLOR_CHANNELS`, `BODY_SLIDERS`, `REQUIRED_SLOTS`, `RARITY_COLORS` | slots, items, colores, sliders |
| `maps.ts` | `MAPS`, `DEFAULT_MAP` | mapas y modos compatibles |
| `modes.ts` | `GAME_MODES`, `DEFAULT_MODE` | reglas por modo (reapariciones, economía, límites) |
| `network.ts` | `NETWORK` | puerto, patch/input rate, interpolación, lag comp, reconexión, nombres de sala, versión de protocolo |
| `controls.ts` | `DEFAULT_CONTROLS`, `DEFAULT_SETTINGS` | teclas y ajustes por defecto |
| `audio.ts` | `AUDIO` | rutas de música/SFX y atenuación 3D |
| `ui.ts` | `UI`, `Language`, `StringKey` | textos por idioma y parámetros de HUD |
| `index.ts` | todo lo anterior + `CONFIG` | importa desde `@game/config` |

## Reglas
1. **Ids = claves.** `WEAPONS.rifle_star.id === 'rifle_star'`. El test lo comprueba.
2. **Rutas relativas** a `apps/client/public/assets/<tipo>/`. Nunca absolutas.
3. **Cambiar `NETWORK.protocolVersion`** cuando cambie el formato de mensajes o el Schema: obliga a los clientes a
   recargar y evita partidas corruptas.
4. **Cambiar `BRANDING.version`** en cada release; se muestra en el menú y en `/health`.
5. Variables de **entorno** (`.env`) son solo para lo que cambia por despliegue (puertos, secretos, URLs). Lo que define
   *el juego* va aquí.

## Ejemplo: renombrar el juego a "Mochi Wars"
```ts
// packages/config/src/branding.ts
name: 'Mochi Wars',
codename: 'mochiwars',
tagline: 'Dulces, pero letales.',
appId: 'com.miestudio.mochiwars',
```
Resultado: pestaña, título de ventana, instalador, logs y handshake pasan a decir "Mochi Wars". El storage local usa
`mochiwars:avatar`, así que los avatares guardados con el codename anterior no se cargan (comportamiento esperado).
