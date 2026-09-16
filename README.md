<!-- El nombre del juego se define en packages/config/src/branding.ts. Este README usa el nombre provisional. -->

# TinyStrike

> **Tácticas grandes. Héroes pequeños.**
> Shooter táctico 5v5 en 3D, estilo Counter-Strike, con personajes chibi animados y personalización profunda.
> Se juega **en el navegador** (Chrome, Edge, Firefox, Safari) sin instalar nada, y el mismo código se empaqueta como
> juego de escritorio (Windows / macOS / Linux, preparado para Steam) cuando llegue el momento.

| | |
| --- | --- |
| **Estado** | Fase 2 construida: partida jugable de principio a fin (movimiento en red, disparos, rondas, bomba, economía, granadas, chibis personalizables, menú, salas privadas). Arte final y publicación pendientes (ver `docs/ROADMAP.md`). |
| **Plataformas** | Web (WebGL2) hoy · Escritorio vía Electron mañana |
| **Multijugador** | Servidor autoritativo en Node.js (Colyseus), hasta 10 jugadores por sala |
| **Licencia** | Por decidir por el dueño del proyecto (ver `docs/ROADMAP.md`) |

---

## Índice

1. [Visión del juego](#1-visión-del-juego)
2. [Stack tecnológico y por qué](#2-stack-tecnológico-y-por-qué)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Cómo cambiar el nombre y cualquier otra cosa](#4-cómo-cambiar-el-nombre-y-cualquier-otra-cosa)
5. [Puesta en marcha](#5-puesta-en-marcha)
6. [Comandos disponibles](#6-comandos-disponibles)
7. [Flujo de desarrollo](#7-flujo-de-desarrollo)
8. [Documentación adicional](#8-documentación-adicional)
9. [Preguntas frecuentes](#9-preguntas-frecuentes)

---

## 1. Visión del juego

- **Género**: shooter táctico por rondas, en primera persona, dos equipos de 5.
- **Modo estrella**: *Desactivación* (planta / desactiva la bomba, sin reapariciones, economía por ronda). Modos secundarios: *Duelo por equipos* y *Todos contra todos*.
- **Estética**: personajes **chibi** (cabezones, proporción 1:2.5, ojos grandes), colores saturados, mapas de juguete (patio de juegos, fábrica de dulces). Violencia caricaturesca: confeti en vez de sangre.
- **Personalización**: cada jugador arma su avatar con **14 slots** de cosméticos (cabello, ojos, cara, gorro, gafas, torso, piernas, calzado, espalda, manos, accesorio, skin de arma, estela, efecto de eliminación), **5 canales de color** libres y **4 sliders** de forma. Todo es puramente estético: ninguna ventaja de juego.
- **Multijugador**: partidas públicas por emparejamiento simple y salas privadas con código de invitación.

El documento de diseño completo está en [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

## 2. Stack tecnológico y por qué

| Capa | Tecnología | Alternativas evaluadas | Motivo de la elección |
| --- | --- | --- | --- |
| Lenguaje | **TypeScript** (estricto) en todo el monorepo | — | Un solo lenguaje para cliente, servidor y escritorio; tipos compartidos = menos bugs de red. |
| Render 3D | **Three.js** | Babylon.js, PlayCanvas, Unity WebGL, Godot Web | Ecosistema enorme, control total, builds ligeras (~600 KB), sin editor propietario ni royalties. Unity/Godot web generan builds de 30-100 MB y arrancan lento en navegador. |
| Física | **Rapier** (WASM, `rapier3d-compat`) | cannon-es, ammo.js | Determinista, muy rápido, **corre igual en navegador y en Node**, lo que permite que el servidor sea la autoridad de las colisiones. |
| Empaquetado cliente | **Vite** | webpack, Parcel | Arranque instantáneo en dev, HMR, build optimizado. |
| Red / salas | **Colyseus** | Socket.io a mano, geckos.io (WebRTC), Nakama, Photon | Salas, sincronización de estado por *delta* (Schema), reconexión, escalado horizontal con Redis. Es el estándar de facto para juegos web multijugador en Node. |
| Servidor | **Node.js 20+** | Go, Rust, C# | Compartir código de reglas y física con el cliente sin reescribir nada. |
| Persistencia | Adaptador propio: `memory` → `sqlite` → `postgres` | Firebase, Supabase | Empezar sin infraestructura; cambiar de base de datos sin tocar la lógica del juego. |
| Escritorio | **Electron** + electron-builder | Tauri, NW.js | Integración con Steamworks documentada y madura, mismo motor Chromium que el navegador (cero sorpresas gráficas). Tauri es más ligero pero su soporte de WebGL y Steam es menos maduro; se puede migrar más adelante porque el cliente es HTML puro. |
| Calidad | ESLint, Prettier, Vitest, GitHub Actions | — | Estándar de la industria. |

> **¿"Multiplayer en Google"?** Interpretamos que el juego debe jugarse en **Google Chrome / navegador** y poder publicarse en la web. El servidor puede desplegarse en Google Cloud Run, Fly.io, Railway o cualquier VPS (ver `docs/DEPLOYMENT.md`).

## 3. Estructura del repositorio

Monorepo con *npm workspaces*. Los paquetes con `@game/` no llevan el nombre del juego a propósito: cambiar el nombre no obliga a renombrar paquetes.

```
proyectojuego/
├── README.md                  ← este archivo
├── ARCHITECTURE.md            ← arquitectura técnica detallada
├── CONTRIBUTING.md            ← convenciones de código y ramas
├── package.json               ← scripts raíz y workspaces
├── tsconfig.base.json         ← config TS compartida
├── eslint.config.js / .prettierrc / .editorconfig
├── .env.example               ← variables de entorno
├── docker-compose.yml         ← servidor en contenedor
├── .github/workflows/ci.yml   ← CI: typecheck + lint + test + build
│
├── packages/
│   ├── config/                ★ ÚNICO LUGAR DE CONFIGURACIÓN (nombre, armas, mapas, reglas, red…)
│   │   └── src/
│   │       ├── index.ts           agrega y reexporta todo (objeto CONFIG)
│   │       ├── branding.ts        nombre, eslogan, versión, colores, equipos, appId
│   │       ├── gameplay.ts        salud, velocidades, tiempos de ronda, hitboxes
│   │       ├── weapons.ts         armas + equipamiento
│   │       ├── economy.ts         dinero por ronda
│   │       ├── characters.ts      arquetipos chibi + nombres de clips de animación
│   │       ├── customization.ts   slots, cosméticos, colores, sliders, avatar por defecto
│   │       ├── maps.ts            mapas
│   │       ├── modes.ts           modos de juego
│   │       ├── network.ts         tick rate, puertos, versión de protocolo
│   │       ├── controls.ts        teclas y ajustes por defecto
│   │       ├── audio.ts           rutas de audio
│   │       └── ui.ts              textos (es/en) y parámetros de HUD
│   │
│   └── shared/                código compartido cliente ⇄ servidor (sin dependencias de DOM ni Node)
│       └── src/
│           ├── protocol/          nombres y payloads de los mensajes de red
│           ├── types/             PlayerSnapshot, AvatarConfig, MatchPhase…
│           ├── math/              vectores, clamp, lerp
│           ├── rules/             funciones puras: daño, economía, validación de avatar
│           └── utils/             códigos de sala…
│
├── apps/
│   ├── client/                cliente web (Three.js + Vite)
│   │   ├── index.html             plantilla con %GAME_NAME% (sustituido desde config)
│   │   ├── vite.config.ts
│   │   ├── public/assets/         modelos, mapas, audio ya optimizados
│   │   └── src/
│   │       ├── main.ts            punto de entrada
│   │       ├── core/              Engine (bucle, renderer), GameScene, AssetLoader
│   │       ├── scenes/            Boot → Menu → Customization → Match
│   │       ├── entities/          representación visual de jugadores, armas, bomba
│   │       ├── systems/           predicción, interpolación, animación, HUD, audio
│   │       ├── customization/     AvatarBuilder (monta el chibi desde AvatarConfig)
│   │       ├── net/               NetworkClient (colyseus.js)
│   │       ├── input/             InputManager (acciones, no teclas)
│   │       ├── ui/                menús HTML/CSS, tema de marca
│   │       └── audio/
│   │
│   ├── server/                servidor autoritativo (Colyseus)
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts           arranque
│   │       ├── rooms/             MatchRoom + schema de estado sincronizado
│   │       ├── systems/           Round, Movement, Combat, Bomb, Economy, Respawn
│   │       ├── persistence/       PersistenceAdapter + Memory (+ Sqlite/Postgres en fase 2)
│   │       └── api/               endpoints HTTP (health, auth, perfil)
│   │
│   └── desktop/               cáscara Electron (carga apps/client/dist)
│       ├── src/main.cts
│       └── electron-builder.config.cjs
│
├── assets/                    arte fuente (Blender, WAV…), no se carga en runtime
├── tools/                     scripts: exportar marca, optimizar assets
└── docs/                      diseño, red, personalización, pipeline de assets, despliegue, roadmap
```

## 4. Cómo cambiar el nombre y cualquier otra cosa

**Todo lo configurable vive en `packages/config/src/`.** Es una regla del proyecto: ningún archivo fuera de esa carpeta contiene el nombre del juego, un precio, una velocidad o una tecla escrita a mano.

### Cambiar el nombre del juego

1. Abre `packages/config/src/branding.ts`.
2. Cambia `name`, `codename`, `tagline`, `studio`, `appId`.
3. Listo. Se propaga a: título de la pestaña, `document.title`, consola, handshake de red, ventana de Electron, nombre del ejecutable y del instalador.

El único sitio adicional que menciona el nombre es la cabecera de este README (documentación, no código).

### Otros ejemplos

| Quiero… | Archivo |
| --- | --- |
| Añadir un arma | `weapons.ts` (nueva entrada) + GLB en `apps/client/public/assets/models/weapons/` |
| Añadir un sombrero | `customization.ts` (entrada con `slot: 'headwear'`) + GLB en `models/cosmetics/headwear/` |
| Hacer las rondas más largas | `gameplay.ts` → `round.roundTime` |
| Cambiar colores de marca / equipos | `branding.ts` → `colors`, `teams` |
| Añadir un idioma | `ui.ts` → `strings.<idioma>` |
| Cambiar teclas por defecto | `controls.ts` |
| Subir el tick rate del servidor | `network.ts` → `tickRate` y `gameplay.ts` → `tickRate` |
| Añadir un mapa | `maps.ts` + GLB en `apps/client/public/assets/maps/` |

Existe un test (`packages/config/src/config.test.ts`) que valida la coherencia de la configuración (ids, slots, mapas que referencian modos existentes). Ejecuta `npm test` tras cada cambio.

## 5. Puesta en marcha

Requisitos: **Node.js ≥ 20** y npm ≥ 10. (Se recomienda `nvm use` para leer `.nvmrc`.)

```bash
# 1. Instalar todas las dependencias del monorepo
npm install

# 2. Variables de entorno (opcional en local; los valores por defecto funcionan)
cp .env.example .env

# 3. Arrancar el servidor de juego  (ws://localhost:2567)
npm run dev:server

# 4. En otra terminal, arrancar el cliente web  (http://localhost:5173)
npm run dev:client
```

Abre `http://localhost:5173` en Chrome. Verás el menú con tu chibi. Para jugar en red local abre una segunda pestaña (o otro PC de la misma red con `http://<tu-ip>:5173`) y usa **Crear sala** + **Unirse con código**. `http://localhost:2567/health` devuelve el estado del servidor.

### Controles por defecto (reasignables en Ajustes)

| Acción | Tecla |
| --- | --- |
| Moverse / correr / saltar / agacharse | `W A S D` / `Shift` / `Espacio` / `Ctrl` |
| Disparar / recargar | Clic izquierdo / `R` |
| Cambiar de arma | `1` `2` `3` `4` o rueda del ratón |
| Plantar / desactivar la bomba | mantener `E` |
| Tienda (solo en tiempo de compra) | `B` |
| Marcador / chat / chat de equipo / emote | `Tab` / `T` / `Y` / `G` |
| Pausa, ajustes, cambiar de equipo | `Esc` |

### Cómo va una partida de *Desactivación*

1. Con 2 jugadores empieza el calentamiento (reapariciones libres).
2. Cada ronda: 10 s de compra en tu base → 1:55 de juego. Los **Saboteadores** (naranja) llevan la bomba y la plantan en los aros de los sitios A o B; los **Guardianes** (azul) la desactivan (8 s, o 4 s con kit).
3. Gana la ronda quien elimina al rival, explota/desactiva la bomba o agota el tiempo (defensores). A 13 rondas se gana la partida; a las 12 se cambian los lados.

Escritorio (opcional): `npm run dev:desktop` abre la misma app en una ventana Electron apuntando al servidor de desarrollo de Vite.

## 6. Comandos disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev:client` | Cliente web con recarga en caliente |
| `npm run dev:server` | Servidor con reinicio automático (`tsx watch`) |
| `npm run dev:desktop` | Ventana Electron en modo desarrollo |
| `npm run build` | Compila config, shared, cliente (a `apps/client/dist`) y servidor (a `apps/server/dist`) |
| `npm run build:desktop` | Lo anterior + instaladores en `apps/desktop/release/` |
| `npm run typecheck` | Comprobación de tipos en todos los paquetes |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` | Tests unitarios (Vitest) |
| `docker compose up` | Servidor en contenedor |

## 7. Flujo de desarrollo

1. **Toda regla de juego nueva** empieza como una constante en `packages/config` y, si necesita lógica, como función pura en `packages/shared/src/rules` con su test.
2. **El servidor manda.** El cliente predice para que se sienta fluido, pero el servidor valida inputs, disparos y compras. Nunca confíes en datos del cliente (ver `sanitizeAvatar` como ejemplo del patrón).
3. **Assets**: se trabaja en `assets/source`, se optimiza con `node tools/optimize-assets.mjs` y el resultado se commitea en `apps/client/public/assets`.
4. **Ramas**: `main` siempre desplegable; features en `feat/<nombre>`; CI obligatoria en PR. Detalles en `CONTRIBUTING.md`.

## 8. Documentación adicional

| Documento | Contenido |
| --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Diagramas de capas, flujo de datos cliente ⇄ servidor, bucle de simulación, decisiones y trade-offs |
| [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) | Documento de diseño: modos, economía, armas, mapas, progresión |
| [`docs/NETWORKING.md`](docs/NETWORKING.md) | Predicción, reconciliación, interpolación, lag compensation, anti-cheat |
| [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) | Sistema de avatares: rig, slots, sockets, recolor, morphs |
| [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md) | Convenciones de Blender → GLB, nombres de nodos de mapas, compresión |
| [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) | Referencia campo a campo de `packages/config` |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Publicar el cliente web, el servidor (Docker / Cloud Run / Fly) y el build de escritorio / Steam |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fase 2 desglosada en hitos con criterios de "hecho" |

## 9. Preguntas frecuentes

**¿Puedo cambiar Electron por Tauri más adelante?** Sí. El cliente es HTML + JS estándar; `apps/desktop` solo lo envuelve. Reemplazar la carpeta no afecta al resto.

**¿Puedo usar otro motor de render?** Es la decisión más cara de cambiar. Three.js está aislado en `apps/client` (core, entities, scenes); `packages/shared` y el servidor no dependen de él.

**¿Cuántos jugadores soporta un servidor?** Una instancia Node maneja cómodamente 20-30 salas de 10 jugadores a 30 ticks. Para más, Colyseus escala horizontalmente con Redis (ver `docs/DEPLOYMENT.md`).

**¿Funciona en móvil?** El render sí (WebGL2). Los controles táctiles no están implementados; el diseño de `InputManager` (acciones, no teclas) permite añadirlos después.

**¿Por qué los personajes y armas son de primitivas?** Todo el arte actual es procedural (`apps/client/src/customization/procedural.ts`, `entities/WeaponMesh.ts`) y el audio está sintetizado (`audio/SynthAudio.ts`). Así el juego es 100 % jugable sin assets. Cuando exista arte GLB/OGG, se sustituye pieza a pieza siguiendo `docs/ASSET_PIPELINE.md` sin tocar reglas ni red.

**¿Cómo pruebo sin dos ordenadores?** Dos pestañas del navegador bastan. Nota: Chrome pausa el bucle de render de la pestaña que no está en primer plano; usa dos ventanas separadas para ver ambos jugadores moverse a la vez.
