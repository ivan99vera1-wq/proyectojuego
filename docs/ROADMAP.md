# Roadmap

## Fase 1 — Estructura y arquitectura ✅ (completada)

- Monorepo con `packages/config`, `packages/shared`, `apps/client`, `apps/server`, `apps/desktop`.
- Configuración única y tipada con tests de coherencia.
- Cliente que arranca (Three.js), servidor que acepta conexiones (Colyseus) con handshake de versión.
- Documentación: README, ARCHITECTURE y esta carpeta.

## Fase 2 — Construcción del juego ✅ (jugable; completada el 2026-09-16)

Cada hito produce algo jugable. Criterio de "hecho" entre paréntesis. Estado real al lado de cada hito.

### Hito 2.1 — Moverse por un mapa (1 jugador) ✅
- `MatchScene`, carga de `MAPS.playground` (mapa gris de bloques, sin arte final).
- Rapier en cliente: cápsula, salto, agacharse, escaleras/rampas.
- Cámara en primera persona, `InputManager` con pointer lock.
- (Hecho: se recorre el mapa a 60 fps sin atravesar paredes.)

### Hito 2.2 — Moverse en red (N jugadores) ✅
- `MovementSystem` en servidor con Rapier; envío de inputs; predicción + reconciliación; interpolación de remotos.
- Chibi placeholder para remotos.
- (Hecho: 2 pestañas se ven moverse con < 100 ms de latencia percibida y sin "rubber banding" en LAN.)

### Hito 2.3 — Disparar ✅
- `CombatSystem`: raycast con lag compensation, `computeDamage`, salud, muerte, killfeed.
- Arma en primera persona (view model), retroceso, dispersión, recarga.
- Modo `ffa` funcional con reapariciones.
- (Hecho: partida FFA jugable de principio a fin.)

### Hito 2.4 — Rondas, bomba y economía ✅
- `RoundSystem`, `BombSystem`, `EconomySystem`, tienda (menú HTML), equipos, cambio de lado.
- Modo `bomb` completo. Marcador y HUD finales.
- (Hecho: partida MR12 completa con victoria por rondas.)

### Hito 2.5 — El personaje ✅
- Personaje base modelado en Blender a partir del modelo de Sketchfab, con esqueleto y pesos
  (`assets/blender/build_character.py` → `character.glb`).
- `character/rig.ts` adopta los huesos del GLB; `PlayerEntity` los anima de forma **procedural**: locomoción, agachado,
  salto, apuntado, disparo, recarga, muerte y emotes. No hay `AnimationMixer` ni clips: `ANIMATION_CLIPS` queda
  reservado para cuando los haya.
- Se descartó la personalización por cosméticos: un solo personaje para todos, de modo que la silueta visible y la
  hitbox sean idénticas para cualquiera.
- (Hecho: dos jugadores se ven moverse, disparar y morir correctamente el uno al otro.)

### Hito 2.6 — Menú, salas y pulido ✅ parcial
- `MenuScene` con escenario 3D, buscar partida, crear sala privada con código, unirse por código, ajustes
  (sensibilidad, teclas, gráficos, idioma), modo entrenamiento para probar armas en solitario.
- Audio 3D sintetizado, música de menú, efectos (trazadores, confeti, humo).
- **Pendiente**: persistencia `sqlite` y autenticación de invitado (JWT). Hoy el servidor acumula estadísticas en
  memoria (`MemoryAdapter`) y los ajustes del jugador viven en `localStorage`.
- (Hecho: un desconocido puede entrar al enlace y jugar sin instrucciones.)

### Hito 2.7 — Publicación web ⏳ (documentado en docs/DEPLOYMENT.md, no ejecutado)
- Despliegue cliente (CDN) + servidor (Docker en Cloud Run / Fly.io). Dominio, HTTPS/WSS.
- Telemetría mínima (errores, latencia).

## Deuda técnica conocida tras la Fase 2
- Los mapas se **juegan** desde layouts de cajas (`packages/shared/src/maps`) y se **ven** desde el GLB que Blender
  genera a partir de esos mismos datos. Si falta el GLB, se dibujan las cajas. La colisión nunca depende del arte.
- Las animaciones del personaje y de las armas son procedurales: no hay clips
  exportados, así que `ANIMATION_CLIPS` no se usa todavía. El camino para
  sustituirlas por clips está documentado en `entities/WeaponAnimator.ts`.
- Las armas son las del pack WWII (`assets/source/weapons/`), preparadas por
  `assets/blender/build_weapons.py`. Quedan sin usar NR-40, German Knife, M1911
  y F1 Grenade, listas para skins o para ampliar el catálogo.
- El audio es sintetizado (WebAudio); las rutas de `AUDIO` están reservadas para los OGG.
- No hay reconexión en el cliente: si se cae la conexión vuelve al menú. El servidor ya lo tolera (marca al jugador
  como desconectado y sigue la ronda), pero `NETWORK.reconnectionGrace` no se aprovecha.
- No hay espectador libre: quien espera ronda mira desde su punto de aparición.
- Sin bots ni matchmaking por habilidad. Sin controles táctiles.
- Persistencia solo en memoria (servidor) y localStorage (cliente).

## Fase 3 — Lanzamiento como producto
- Build Electron firmado; página de Steam; integración Steamworks (logros, invitaciones).
- Arte final y audio real; animaciones exportadas desde Blender sustituyendo a las procedurales.
- Escalado horizontal del servidor (Redis presence) y matchmaking por región.
- Decisión de licencia y monetización (solo cosméticos; nunca ventajas de juego).
