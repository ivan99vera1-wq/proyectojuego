# Red: modelo de sincronización

Parámetros en `packages/config/src/network.ts`. Protocolo en `packages/shared/src/protocol/messages.ts`.

## Modelo
Cliente-servidor **autoritativo** con **predicción del cliente**, **reconciliación** e **interpolación de entidades**,
más **compensación de lag** para disparos. Es el mismo modelo que usan Valve (Source) y Overwatch.

## Ticks y tasas
| Parámetro | Valor | Dónde |
| --- | --- | --- |
| Simulación servidor | 30 Hz | `GAMEPLAY.tickRate` |
| Envío de estado | 20 Hz | `NETWORK.patchRate` |
| Envío de inputs | 60 Hz | `NETWORK.inputRate` |
| Retraso de interpolación | 100 ms | `NETWORK.interpolationDelay` |
| Rebobinado máximo | 200 ms | `NETWORK.maxLagCompensation` |

## Predicción y reconciliación (jugador local)
1. El cliente aplica su input localmente al instante (misma función de movimiento que el servidor, con Rapier).
2. Guarda cada input con su `seq` en un buffer.
3. El servidor procesa inputs en orden y escribe `lastSeq` en `PlayerState`.
4. Al recibir un estado, el cliente descarta inputs ≤ `lastSeq`, **coloca al jugador en la posición del servidor y
   re-aplica** los inputs pendientes. Si la diferencia es pequeña se suaviza en 100 ms para evitar tirones.

## Interpolación (jugadores remotos)
El cliente renderiza a los demás **100 ms en el pasado**, interpolando entre los dos últimos snapshots. Con 20 Hz de
patches siempre hay dos muestras disponibles → movimiento suave aunque lleguen con jitter.

## Compensación de lag (disparos)
El servidor guarda un historial de posiciones de cada jugador (últimos 200 ms). Al recibir `Fire{clientTime}` rebobina
a los demás a ese instante, hace el raycast, y restaura. Así "lo que ves es lo que le das" incluso con 100 ms de ping.
Límite: si `clientTime` es más antiguo que `maxLagCompensation`, se recorta (protege contra abuso).

## Validaciones del servidor (anti-cheat básico)
- Movimiento: se aplica el input, no la posición que diga el cliente. Velocidad limitada por config.
- Disparo: cadencia (`fireRate`), munición, arma equipada, jugador vivo, fase `live`.
- Compra: fase `freeze`, dentro de zona de compra, dinero suficiente.
- Avatar: `sanitizeAvatar` (ids existentes, slot correcto, colores hex, sliders en rango).
- Chat: longitud máxima, ritmo (Fase 2).
- Versión: `protocolVersion` obligatorio en el handshake (ya implementado).

## Reconexión
`allowReconnection(NETWORK.reconnectionGrace)`: si el navegador pierde la conexión 20 s, el jugador vuelve a su mismo
`PlayerState` sin perder dinero ni estadísticas.

## Nota sobre `Welcome`
`Welcome` se envía en `onJoin`. En pruebas con Node el mensaje puede llegar antes de registrar `onMessage` tras
`joinOrCreate`. En Fase 2 el cliente registrará los handlers **antes** de resolver la promesa de unión (patrón
`room.onMessage` en el callback de `joinOrCreate`) o el servidor responderá a un `Ready` explícito.

## Escalado
Una instancia Node: ~20-30 salas de 10 jugadores. Más allá: varias instancias con `@colyseus/redis-presence` y
`@colyseus/redis-driver` tras un balanceador que soporte WebSockets *sticky*.
