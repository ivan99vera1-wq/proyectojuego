import http from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BRANDING, NETWORK } from '@game/config';
import { MatchRoom } from './rooms/MatchRoom.js';
import { createHttpHandler } from './api/http.js';
import { createPersistence } from './persistence/index.js';

export interface GameServer {
  port: number;
  shutdown(): Promise<void>;
}

/** Crea y arranca el servidor de juego. Reutilizable en tests. */
export async function createGameServer(port: number, host = '0.0.0.0', persistenceDriver = 'memory'): Promise<GameServer> {
  const persistence = await createPersistence(persistenceDriver);
  const httpServer = http.createServer(createHttpHandler());
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  gameServer.define(NETWORK.rooms.match, MatchRoom, { persistence });
  await gameServer.listen(port, host);
  const address = httpServer.address();
  const realPort = typeof address === 'object' && address ? address.port : port;
  console.info(`[${BRANDING.name}] servidor v${BRANDING.version} escuchando en ws://${host}:${realPort}`);
  return {
    port: realPort,
    shutdown: async () => {
      await gameServer.gracefullyShutdown(false);
      await persistence.close();
    },
  };
}
