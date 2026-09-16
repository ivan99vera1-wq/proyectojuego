# apps/server/src/systems

Sistemas del servidor autoritativo (Fase 2). Cada uno es una clase con `update(dt, state)` y se ejecuta en `MatchRoom.tick` en este orden:

1. `RoundSystem.ts` — máquina de estados `waiting → warmup → freeze → live → postround → ...`, marcador, cambio de lado, fin de partida.
2. `MovementSystem.ts` — aplica los `InputPayload` encolados con Rapier (cápsula por jugador, `GAMEPLAY.player`). Guarda historial de posiciones para lag compensation.
3. `CombatSystem.ts` — valida `Fire`: cadencia, munición, raycast contra el historial rebobinado (`NETWORK.maxLagCompensation`), daño con `computeDamage` de `@game/shared`.
4. `BombSystem.ts` — plantar / desactivar / explotar, según `GAMEPLAY.round`.
5. `EconomySystem.ts` — dinero por ronda y compras (`roundReward`, `WEAPONS`, `EQUIPMENT`).
6. `RespawnSystem.ts` — solo en modos con `respawn: true`.
