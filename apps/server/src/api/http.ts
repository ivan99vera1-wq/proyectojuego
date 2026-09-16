import type { IncomingMessage, ServerResponse } from 'node:http';
import { matchMaker } from 'colyseus';
import { BRANDING, NETWORK, MAPS, GAME_MODES } from '@game/config';

/**
 * API HTTP mínima que convive con el WebSocket de Colyseus.
 *  GET /health            → estado
 *  GET /rooms/:code       → roomId de una sala privada por código
 *  GET /catalog           → mapas y modos (para el menú)
 */
export function createHttpHandler() {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const json = (status: number, body: unknown) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return json(204, {});
    if (url.pathname === '/health') {
      return json(200, { ok: true, game: BRANDING.name, version: BRANDING.version, protocol: NETWORK.protocolVersion });
    }
    if (url.pathname === '/catalog') {
      return json(200, { maps: Object.values(MAPS).map((m) => ({ id: m.id, name: m.displayName, modes: m.modes })), modes: Object.values(GAME_MODES).map((m) => ({ id: m.id, name: m.displayName })) });
    }
    const m = url.pathname.match(/^\/rooms\/([A-Z0-9]{4,8})$/i);
    if (m) {
      const code = m[1]!.toUpperCase();
      // El LocalDriver solo filtra campos de primer nivel; filtramos metadata en JS.
      const rooms = await matchMaker.query({ name: NETWORK.rooms.match });
      const room = rooms.find((r) => (r.metadata as { code?: string } | undefined)?.code === code);
      if (!room) return json(404, { error: 'room_not_found' });
      return json(200, { roomId: room.roomId, clients: room.clients, maxClients: room.maxClients });
    }
    json(404, { error: 'not_found' });
  };
}
