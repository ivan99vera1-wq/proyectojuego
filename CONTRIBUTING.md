# Guía de contribución

## Convenciones

- **Idioma**: comentarios y documentación en español; identificadores de código en inglés.
- **Formato**: Prettier (`npm run format`) y ESLint (`npm run lint`) deben pasar. CI lo comprueba.
- **Tipos**: `strict` activado. Evita `any`; si es inevitable, comenta por qué.
- **Configuración**: cualquier número o texto que un diseñador quiera tocar va a `packages/config`. Si escribes `100`
  o `'Rifle'` en un sistema, es un bug.
- **Reglas de juego**: funciones puras en `packages/shared/src/rules` + test en el mismo directorio.
- **Nombre del juego**: nunca escrito a mano. Usa `BRANDING.name`.

## Ramas y commits

- `main`: siempre desplegable.
- `feat/<tema>`, `fix/<tema>`, `docs/<tema>`.
- Commits en formato *Conventional Commits*: `feat(server): añade BombSystem`, `fix(client): corrige interpolación`.
- PR pequeña, con descripción de qué cambia y cómo probarlo. CI verde obligatoria.

## Añadir contenido

| Contenido | Pasos |
| --- | --- |
| Arma | entrada en `weapons.ts` → GLB en `apps/client/public/assets/models/weapons/` → `npm test` |
| Cosmético | entrada en `customization.ts` → GLB en `models/cosmetics/<slot>/` con sockets correctos (`docs/CUSTOMIZATION.md`) |
| Mapa | GLB con nodos nombrados (`docs/ASSET_PIPELINE.md`) → entrada en `maps.ts` |
| Idioma | bloque en `ui.ts → strings` |

## Tests

- Unitarios con Vitest: `npm test`.
- Reglas (`packages/shared`) y coherencia de config (`packages/config`) tienen cobertura obligatoria.
- Fase 2: tests de sistemas del servidor con salas sintéticas.
