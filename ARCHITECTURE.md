<!-- El nombre del juego se define en packages/config/src/branding.ts -->
# Arquitectura técnica

Este documento describe **cómo está construido** el juego: capas, responsabilidades, flujo de datos y las decisiones que
lo sostienen. Es la referencia que hay que leer antes de tocar cualquier sistema.

## 1. Principios

1. **Una sola fuente de verdad para la configuración.** `packages/config` es el único sitio con nombres, números y rutas.
   Cliente, servidor y escritorio la importan; nada la duplica.
2. **El servidor es la autoridad.** Posición, salud, dinero, rondas y disparos los decide el servidor. El cliente propone
   (inputs), predice (para sentirse fluido) y se corrige cuando el servidor dice otra cosa.
3. **Lógica de reglas pura y compartida.** Cálculo de daño, economía y validación de avatar son funciones puras en
   `packages/shared/src/rules`, sin DOM ni Node, con tests. Cliente y servidor ejecutan exactamente el mismo código.
4. **Render aislado.** Three.js solo existe en `apps/client`. Nada fuera de ahí sabe qué es un `Mesh`.
5. **Plataforma-agnóstico.** El cliente es HTML/JS estándar. Navegador y Electron cargan el mismo `dist/`.

## 2. Vista de capas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          apps/desktop (Electron)                        │
│         ventana nativa · instaladores · (futuro) Steamworks             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ carga apps/client/dist  (o localhost:5173 en dev)
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         apps/client (navegador)                         │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐ ┌─────────┐   │
│  │  scenes  │ │ entities │ │  systems  │ │ customization│ │   ui    │   │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └──────┬───────┘ └────┬────┘   │
│       └────────────┴─────┬───────┴──────────────┴──────────────┘        │
│                    ┌─────▼──────┐   ┌───────────┐   ┌────────────┐      │
│                    │ core/Engine│   │   input   │   │    net     │      │
│                    │ Three.js   │   │           │   │ colyseus.js│      │
│                    └────────────┘   └───────────┘   └─────┬──────┘      │
└───────────────────────────────────────────────────────────┼─────────────┘
                                          WebSocket (Schema deltas + mensajes)
┌───────────────────────────────────────────────────────────▼─────────────┐
│                       apps/server (Node + Colyseus)                     │
│   MatchRoom ──► systems: Round → Movement(Rapier) → Combat → Bomb →     │
│                          Economy → Respawn                              │
│   api/http (health, auth, perfil)      persistence (memory|sqlite|pg)   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ importan
┌───────────────────────────────▼─────────────────────────────────────────┐
│   packages/shared   protocolo · tipos · math · rules (puras, testeadas) │
├─────────────────────────────────────────────────────────────────────────┤
│   packages/config   ★ branding · gameplay · weapons · customization ·   │
│                       maps · modes · network · controls · audio · ui    │
└─────────────────────────────────────────────────────────────────────────┘
```

Dependencias permitidas (flecha = "puede importar"):
`desktop → (nada de código, solo dist)`, `client → shared, config`, `server → shared, config`, `shared → config`, `config → nada`.

## 3. Cliente

### 3.1 Bucle de juego (`core/Engine.ts`)

- `renderer.setAnimationLoop` → cada frame: `scene.update(dt)` + `scene.render()`.
- `dt` se limita a 100 ms para evitar saltos tras pestañas en segundo plano.
- Fase 2: `update` correrá la **simulación local a paso fijo** (`1 / GAMEPLAY.tickRate`) acumulando `dt`, y el render
  interpolará entre el último estado y el anterior. Así la predicción del cliente es determinista y comparable con el
  servidor.

### 3.2 Escenas (`scenes/`)

| Escena | Responsabilidad | Transiciones |
| --- | --- | --- |
| `BootScene` | Carga assets críticos, muestra logo/progreso | → Menu |
| `MenuScene` | Jugar / Personalizar / Ajustes; fondo 3D con el avatar del jugador | → Customization, → Match |
| `CustomizationScene` | Vestidor: cámara orbital, pestañas por slot, colores, sliders. Guarda `AvatarConfig` | → Menu |
| `MatchScene` | Partida: mundo, jugadores, HUD, tienda, marcador | → Menu |

Una escena implementa `GameScene` (`init / update / render / resize / dispose`). `Engine.setScene` garantiza que la anterior
se libera (geometrías, texturas, listeners).

### 3.3 Entidades y sistemas

- **Entidades** son "cosas con Object3D": `PlayerEntity`, `WeaponViewModel`, `BombEntity`, `GrenadeEntity`.
- **Sistemas** son lógica sin estado propio que recorre entidades cada tick: `PredictionSystem`, `InterpolationSystem`,
  `AnimationSystem`, `HudSystem`, `AudioSystem`.
- No es un ECS formal (sería sobreingeniería para 10 jugadores). Es *"entidades + sistemas"* con clases sencillas.

### 3.4 Red en el cliente (`net/NetworkClient.ts`)

- Conecta con `colyseus.js` a la sala `NETWORK.rooms.match`.
- Envía `InputPayload` a `NETWORK.inputRate` Hz con número de secuencia creciente.
- Recibe el `MatchState` como *deltas* (Colyseus Schema) y eventos (`ServerMessage.*`).
- El handshake incluye `protocolVersion` y `gameVersion`; el servidor rechaza versiones incompatibles y el cliente muestra
  `UI.strings.<lang>.versionMismatch`.

### 3.5 Personalización (`customization/AvatarBuilder.ts`)

Ver `docs/CUSTOMIZATION.md`. Resumen: un `AvatarConfig` se convierte en un `THREE.Group` cargando el rig base del
arquetipo y enganchando cada cosmético a su socket. Recolor = clonar material y cambiar `color` solo en materiales
marcados como `Recolor_*`. Sliders = morph targets.

### 3.6 Input (`input/InputManager.ts`)

Traduce teclas/ratón a **acciones** (`ControlAction`). Los sistemas preguntan `isDown('jump')`, nunca `isDown('Space')`.
Esto hace trivial el remapeo y, en el futuro, gamepad o táctil.

### 3.7 UI

HTML + CSS sobre el canvas (`#ui-root`). Motivo: accesibilidad, texto nítido, i18n gratis, y separación total del render.
Los colores de marca se inyectan como variables CSS (`ui/theme.ts`). El HUD 3D (mira, hitmarker) sí se dibuja en canvas.

## 4. Servidor

### 4.1 Sala de partida (`rooms/MatchRoom.ts`)

Una sala = una partida. Ciclo de vida de Colyseus:

- `onCreate` → crea `MatchState`, fija `patchRate` (`NETWORK.patchRate`) y `simulationInterval` (`GAMEPLAY.tickRate`),
  registra handlers de mensajes.
- `onAuth` → valida `protocolVersion` (y en Fase 2, el token JWT).
- `onJoin` → crea `PlayerState`, sanea nickname y avatar, envía `Welcome`.
- `onLeave` → `allowReconnection(NETWORK.reconnectionGrace)`; si no vuelve, elimina al jugador.
- `tick(dt)` → ejecuta los sistemas en orden fijo.

### 4.2 Sistemas (Fase 2)

| Sistema | Entrada | Salida | Config |
| --- | --- | --- | --- |
| `RoundSystem` | tiempo, muertes, bomba | `phase`, `timer`, `round`, `scoreA/B`, `RoundStart/End`, `MatchEnd` | `GAMEPLAY.round`, `GAMEPLAY.match`, `GAME_MODES` |
| `MovementSystem` | cola de `InputPayload` por jugador | posición/velocidad en Rapier, `lastSeq`, historial de posiciones | `GAMEPLAY.player` |
| `CombatSystem` | `Fire`, `Reload`, `SwitchWeapon` | `Hit`, `Kill`, `ShotFired`, salud/armadura | `WEAPONS`, `computeDamage` |
| `BombSystem` | `Interact` | `bombState`, `BombPlanted/Defused/Exploded` | `GAMEPLAY.round.*` |
| `EconomySystem` | fin de ronda, `Buy` | `money`, inventario | `ECONOMY`, `WEAPONS`, `EQUIPMENT` |
| `RespawnSystem` | muertes | reaparición tras `respawnDelay` | `GAME_MODES` |

Cada sistema es una clase con `update(dt: number, room: MatchRoom)` y ningún estado global. Se testean con una sala
falsa y jugadores sintéticos.

### 4.3 Física en el servidor

Rapier (`@dimforge/rapier3d-compat`) carga el mismo GLB del mapa que el cliente (solo la geometría de colisión,
nodos `COLLISION_*`) y crea un `KinematicCharacterController` por jugador. Al ser la misma librería y los mismos
parámetros, la predicción del cliente coincide casi siempre con el servidor → pocas correcciones visibles.

### 4.4 Persistencia

`PersistenceAdapter` abstrae perfil, avatar, desbloqueos y estadísticas. Implementaciones:

- `MemoryAdapter` (Fase 1): desarrollo/tests.
- `SqliteAdapter` (Fase 2): un archivo, cero infraestructura, suficiente para un lanzamiento pequeño.
- `PostgresAdapter` (Fase 2+): producción con varios servidores.

Se elige con `PERSISTENCE_DRIVER` en `.env`.

### 4.5 API HTTP

Convive con el WebSocket en el mismo puerto. `GET /health` ya existe. Fase 2: `POST /auth/guest`, `GET/PUT /profile`,
`GET /leaderboard`.

## 5. Flujo de datos de un disparo (ejemplo end-to-end)

```
Cliente                                      Servidor
──────                                       ────────
click → InputManager.isDown('fire')
  → PredictionSystem: muestra fogonazo,
    retroceso, hitmarker *tentativo*
  → NetworkClient.send(Fire{seq, clientTime, yaw, pitch})
                                     ──────►  CombatSystem:
                                              1. ¿arma lista? (cadencia, munición)
                                              2. rebobina posiciones de los demás a
                                                 clientTime (≤ NETWORK.maxLagCompensation)
                                              3. raycast Rapier con la dispersión del arma
                                              4. computeDamage(weapon, zone, dist, armor)
                                              5. aplica salud/armadura; si muere → Kill
                                     ◄──────  broadcast ShotFired, Hit, (Kill)
HudSystem: confirma hitmarker / killfeed
AudioSystem: sonido 3D en la posición del tirador
```

## 6. Sincronización de estado

- **Schema (Colyseus)**: `MatchState` y `PlayerState` se serializan por *delta binario*: solo viajan los campos que
  cambian. Con 10 jugadores a `patchRate = 20`, ~2-4 KB/s por cliente.
- **Mensajes**: eventos puntuales (`ClientMessage`, `ServerMessage`) con payloads tipados en `packages/shared`.
- **Avatar**: se sincroniza como string JSON (`encodeAvatar`) una vez por jugador; los clientes lo decodifican y
  construyen el chibi. No cambia durante una ronda.

Detalles de predicción, reconciliación e interpolación en `docs/NETWORKING.md`.

## 7. Escritorio (Electron)

- `apps/desktop/src/main.cts` abre una `BrowserWindow` y carga `apps/client/dist/index.html` (o Vite en dev).
- `tools/export-branding.ts` vuelca `BRANDING` a `dist/branding.json`; `electron-builder.config.cjs` lo lee para
  `appId`/`productName`. Cambiar el nombre en config → cambia el ejecutable.
- Steam (futuro): añadir `steamworks.js` en el proceso principal para logros, overlay e invitaciones; el cliente web no
  cambia.

## 8. Build y despliegue

| Artefacto | Comando | Resultado |
| --- | --- | --- |
| Cliente web | `npm run build` | `apps/client/dist` (estático: Netlify, Vercel, Cloudflare Pages, GCS, S3…) |
| Servidor | `docker compose up` / `npm start -w @game/server` | proceso Node en el puerto 2567 |
| Escritorio | `npm run build:desktop` | `apps/desktop/release/*.dmg / *.exe / *.AppImage` |

Detalles en `docs/DEPLOYMENT.md`.

## 9. Decisiones registradas (ADR resumidos)

| # | Decisión | Alternativa descartada | Motivo |
| --- | --- | --- | --- |
| 1 | Three.js | Babylon, Unity WebGL | tamaño de build, control, ecosistema |
| 2 | Colyseus | Socket.io a mano | salas, deltas, reconexión y escalado ya resueltos |
| 3 | Rapier compartido | física solo en cliente | anti-cheat: el servidor valida colisiones |
| 4 | Config en TS (`as const`) en vez de JSON | JSON/YAML | autocompletado, tipos derivados (`WeaponId`), tests |
| 5 | Helper `schema()` de @colyseus/schema en vez de decoradores/campos de clase | `@type()`, `defineTypes` | con target ES2022 los campos de clase pisan los accesores del Schema; `schema()` funciona igual en tsx, vitest y esbuild |
| 6 | Servidor ejecuta TS con `tsx` | `tsc` a JS | resuelve paquetes de workspace sin bundler; coste de arranque despreciable |
| 7 | Electron | Tauri | soporte Steam maduro; migrable porque el cliente es HTML puro |
| 8 | Paquetes `@game/*` sin nombre del juego | `@tinystrike/*` | renombrar el juego no toca `package.json` |
| 9 | UI en HTML sobre canvas | UI 3D en Three | texto nítido, i18n, accesibilidad, iteración rápida |

| 10 | Mapas como datos (`MapLayout` de cajas) | GLB como fuente de colisión | cliente y servidor construyen el mismo mundo Rapier sin cargar modelos; el arte GLB se superpone después |
| 11 | Cosméticos, armas y audio procedurales | esperar al arte | el juego es jugable y testeable de extremo a extremo desde el día 1; el arte se sustituye pieza a pieza |
| 12 | Callbacks de estado con `getStateCallbacks(room)` | `state.players.onAdd` directo | es la API de colyseus.js 0.16 / schema 3; la forma antigua no existe y rompía la inicialización |

## 10. Verificación automática

- `packages/config`: coherencia de la configuración.
- `packages/shared`: reglas puras y **física** (caída, muros, salto, raycast, hitscan).
- `apps/server`: **end-to-end** con clientes colyseus.js reales contra un servidor en puerto aleatorio: protocolo, salas por código, movimiento, disparo, ronda completa de bomba (compra, plantar, desactivar, economía) y granadas. Con `GAME_DEBUG=1` el servidor acepta `c:debug_teleport` y tiempos acortados (`timings`) solo para pruebas.
- Cliente: verificación manual/asistida con Chrome headless (protocolo DevTools) capturando pantallas del menú, vestidor, partida, tienda, plantado y fin de ronda. En desarrollo `window.__game` expone la app para automatizar.

## 11. Qué NO está en el alcance (por ahora)

- Anti-cheat a nivel de sistema operativo (solo validación servidor).
- Voz en partida.
- Móvil / táctil.
- Emparejamiento por habilidad (MMR); Fase 2 usa "primera sala con hueco".
