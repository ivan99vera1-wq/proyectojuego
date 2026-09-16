import type { IncomingMessage, ServerResponse } from 'node:http';
import { BRANDING, NETWORK } from '@game/config';

/**
 * API HTTP mínima que convive con el WebSocket de Colyseus.
 * Fase 2: autenticación (JWT), perfil/avatar, estadísticas.
 */
export function createHttpHandler() {
  return (req: IncomingMessage, res: ServerResponse): void => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, game: BRANDING.name, version: BRANDING.version, protocol: NETWORK.protocolVersion }));
      return;
    }
    res.writeHead(404);
    res.end();
  };
}
