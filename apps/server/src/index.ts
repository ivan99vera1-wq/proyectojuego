import 'dotenv/config';
import { NETWORK } from '@game/config';
import { createGameServer } from './server.js';

const port = Number(process.env.GAME_SERVER_PORT ?? NETWORK.defaultPort);
const host = process.env.GAME_SERVER_HOST ?? '0.0.0.0';

createGameServer(port, host, process.env.PERSISTENCE_DRIVER ?? 'memory').catch((err) => {
  console.error('Fallo al arrancar el servidor', err);
  process.exit(1);
});
