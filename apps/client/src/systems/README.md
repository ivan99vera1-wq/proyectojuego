# apps/client/src/systems

Lógica del cliente por responsabilidad (Fase 2):

- `PredictionSystem.ts` — predicción local del movimiento + reconciliación con `InputAck`.
- `InterpolationSystem.ts` — interpola jugadores remotos con `NETWORK.interpolationDelay`.
- `AnimationSystem.ts` — mapea estado (velocidad, agachado, arma) a `ANIMATION_CLIPS`.
- `HudSystem.ts` — salud, munición, dinero, killfeed, mira.
- `AudioSystem.ts` — sonidos 3D según `AUDIO`.
