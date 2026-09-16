# Roadmap

## Fase 1 — Estructura y arquitectura ✅ (completada)

- Monorepo con `packages/config`, `packages/shared`, `apps/client`, `apps/server`, `apps/desktop`.
- Configuración única y tipada con tests de coherencia.
- Cliente que arranca (Three.js), servidor que acepta conexiones (Colyseus) con handshake de versión.
- Documentación: README, ARCHITECTURE y esta carpeta.

## Fase 2 — Construcción del juego

Cada hito produce algo jugable. Criterio de "hecho" entre paréntesis.

### Hito 2.1 — Moverse por un mapa (1 jugador)
- `MatchScene`, carga de `MAPS.playground` (mapa gris de bloques, sin arte final).
- Rapier en cliente: cápsula, salto, agacharse, escaleras/rampas.
- Cámara en primera persona, `InputManager` con pointer lock.
- (Hecho: se recorre el mapa a 60 fps sin atravesar paredes.)

### Hito 2.2 — Moverse en red (N jugadores)
- `MovementSystem` en servidor con Rapier; envío de inputs; predicción + reconciliación; interpolación de remotos.
- Chibi placeholder para remotos.
- (Hecho: 2 pestañas se ven moverse con < 100 ms de latencia percibida y sin "rubber banding" en LAN.)

### Hito 2.3 — Disparar
- `CombatSystem`: raycast con lag compensation, `computeDamage`, salud, muerte, killfeed.
- Arma en primera persona (view model), retroceso, dispersión, recarga.
- Modo `ffa` funcional con reapariciones.
- (Hecho: partida FFA jugable de principio a fin.)

### Hito 2.4 — Rondas, bomba y economía
- `RoundSystem`, `BombSystem`, `EconomySystem`, tienda (menú HTML), equipos, cambio de lado.
- Modo `bomb` completo. Marcador y HUD finales.
- (Hecho: partida MR12 completa con victoria por rondas.)

### Hito 2.5 — Chibis y personalización
- Rig chibi base en Blender con `ANIMATION_CLIPS`; primeros cosméticos por slot (los `starter`).
- `AvatarBuilder`, `CustomizationScene`, guardado local y en servidor.
- `AnimationSystem`: locomoción, disparo, muerte, emotes.
- (Hecho: dos jugadores con avatares distintos se ven correctamente el uno al otro.)

### Hito 2.6 — Menú, salas y pulido
- `MenuScene`, buscar partida, crear sala privada con código, ajustes (sensibilidad, teclas, gráficos, idioma).
- Audio 3D, música, efectos (confeti), post-procesado ligero.
- Persistencia `sqlite`, autenticación de invitado (JWT).
- (Hecho: un desconocido puede entrar al enlace y jugar sin instrucciones.)

### Hito 2.7 — Publicación web
- Despliegue cliente (CDN) + servidor (Docker en Cloud Run / Fly.io). Dominio, HTTPS/WSS.
- Telemetría mínima (errores, latencia).

## Fase 3 — Lanzamiento como producto
- Build Electron firmado; página de Steam; integración Steamworks (logros, invitaciones).
- Segundo mapa (`candy_factory`) con arte final; más cosméticos; pase de temporada.
- Escalado horizontal del servidor (Redis presence) y matchmaking por región.
- Decisión de licencia y monetización (solo cosméticos; nunca ventajas de juego).
