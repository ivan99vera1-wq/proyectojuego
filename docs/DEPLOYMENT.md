# Despliegue

## Cliente web (estático)
```bash
npm run build            # → apps/client/dist
```
Sube `apps/client/dist` a cualquier hosting estático: Cloudflare Pages, Netlify, Vercel, Firebase Hosting, Google Cloud
Storage + CDN. Configura `VITE_GAME_SERVER_URL=wss://tu-servidor` en `.env` **antes** de compilar (Vite lo incrusta).
Requiere HTTPS (el navegador exige `wss://` desde páginas seguras).

## Servidor de juego
### Docker (recomendado)
```bash
docker compose up -d --build     # puerto 2567
```
Variables en `.env`. `GET /health` para el balanceador.

### Plataformas
| Plataforma | Notas |
| --- | --- |
| **Google Cloud Run** | soporta WebSockets; poner *session affinity* y `--timeout=3600`; mínimo 1 instancia para evitar arranques en frío. |
| **Fly.io** | ideal: máquinas cerca de los jugadores, WebSockets nativos, `fly launch` con el Dockerfile. |
| **Railway / Render** | un clic, suficiente para pruebas públicas. |
| **VPS (Hetzner, DO)** | Docker + Caddy/Nginx como proxy TLS (`wss`). Máximo control por euro. |

### Escalar
Varias instancias → añadir `@colyseus/redis-presence` y `@colyseus/redis-driver` en `apps/server/src/index.ts` y un
balanceador con *sticky sessions*. Colyseus reparte salas entre procesos automáticamente.

## Escritorio (Electron)
```bash
npm run build:desktop    # → apps/desktop/release/
```
- macOS: firma y *notarization* con Apple Developer ID (variables `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`).
- Windows: certificado de firma de código (evita el aviso SmartScreen).
- Steam: subir el contenido de `release/` con `steamcmd` + `app_build.vdf`; añadir `steamworks.js` para logros/overlay.
El cliente de escritorio conecta al **mismo** servidor que la web: no hay servidores separados.

## Checklist de release
1. `BRANDING.version` actualizado; `NETWORK.protocolVersion` si cambió el protocolo.
2. `npm run typecheck && npm test && npm run build` en verde (CI).
3. Desplegar **servidor primero** (acepta la versión nueva), luego cliente web, luego escritorio.
4. Verificar `/health` y una partida real.
