import 'dotenv/config';
import http from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BRANDING, NETWORK } from '@game/config';
import { MatchRoom } from './rooms/MatchRoom.js';
import { createHttpHandler } from './api/http.js';
import { createPersistence } from './persistence/index.js';

const port = Number(process.env.GAME_SERVER_PORT ?? NETWORK.defaultPort);
const host = process.env.GAME_SERVER_HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  const persistence = await createPersistence(process.env.PERSISTENCE_DRIVER ?? 'memory');
  const httpServer = http.createServer(createHttpHandler());
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });

  gameServer.define(NETWORK.rooms.match, MatchRoom, { persistence });

  await gameServer.listen(port, host);
  console.info(`[${BRANDING.name}] servidor v${BRANDING.version} escuchando en ws://${host}:${port}`);
}

main().catch((err) => {
  console.error('Fallo al arrancar el servidor', err);
  process.exit(1);
});
