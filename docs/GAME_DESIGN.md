# Documento de diseño (GDD)

Los números concretos viven en `packages/config`; aquí se explica la intención.

## Pilares
1. **Táctico pero accesible**: rondas cortas, economía sencilla, 6 armas principales bien diferenciadas.
2. **Adorable y expresivo**: chibis con emotes, muertes con confeti, mapas de juguete.
3. **Tu personaje es tuyo**: personalización profunda, visible en partida y en el menú.

## Modos
- **Desactivación** (`bomb`): 5v5, MR12, `freezeTime` para comprar, bomba de 40 s. Los Saboteadores plantan en A o B; los
  Guardianes desactivan. Sin reapariciones. Modo competitivo principal.
- **Duelo por equipos** (`tdm`): reapariciones, sin economía, 50 bajas.
- **Todos contra todos** (`ffa`): calentamiento y práctica.

## Economía
Inspirada en CS: dinero inicial bajo, recompensa alta por ganar, bonus de derrota creciente para que el equipo perdedor
pueda volver a comprar. Se incentiva la "ronda eco" y la "compra completa" como decisiones de equipo.

## Armas (roles)
| Rol | Arma | Sensación |
| --- | --- | --- |
| Inicial | Pistola P-1 | precisa, económica |
| Pistola fuerte | Revólver Bum | alto daño, lenta |
| Eco | SMG Burbuja | cadencia alta, corto alcance |
| Estándar | Rifle Estrella | polivalente, retroceso controlable |
| Especialista | Cometa (francotirador) | un disparo, lenta |
| Cercana | Escopeta Pop | devastadora a < 8 m |
| Utilidad | Confeti (frag), Algodón (humo) | control de zonas |

## Movimiento
Rápido pero legible: velocidad de carrera alta, salto generoso, poco control aéreo (evita *bunny hopping* excesivo).
Agacharse reduce dispersión y hace la hitbox más pequeña.

## Chibis
Proporción cabeza/cuerpo ≈ 1:2.5. La **hitbox no cambia con los cosméticos ni sliders** (justicia competitiva): la
cápsula es siempre `GAMEPLAY.player.capsule*`; la zona `head` es una esfera fija en el hueso de la cabeza.

## Personalización
Ver `docs/CUSTOMIZATION.md`. Todo cosmético. Desbloqueo por moneda blanda ganada jugando; sin cajas de botín.

## Mapas
- **Patio de Juegos**: mapa de aprendizaje, tres rutas (tobogán, arenero, columpios), dos sitios de bomba.
- **Fábrica de Dulces**: verticalidad (cintas), humo de chocolate como cobertura dinámica.
Convención de nodos en `docs/ASSET_PIPELINE.md`.

## Tono
Nada de sangre. Eliminación = confeti + el chibi cae sentado con ojos en espiral. Emotes al ganar la ronda.
