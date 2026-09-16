import { Client, type Room } from 'colyseus.js';
import { BRANDING, NETWORK } from '@game/config';
import { ServerMessage, type WelcomePayload } from '@game/shared';

/**
 * Envoltorio de colyseus.js. Fase 2: reconciliación de inputs, interpolación
 * de entidades y reconexión automática.
 */
export class NetworkClient {
  private readonly client: Client;
  room: Room | null = null;

  constructor(url = import.meta.env.VITE_GAME_SERVER_URL ?? `ws://localhost:${NETWORK.defaultPort}`) {
    this.client = new Client(url);
  }

  async joinMatch(options: Record<string, unknown> = {}): Promise<Room> {
    const room = await this.client.joinOrCreate(NETWORK.rooms.match, {
      ...options,
      protocolVersion: NETWORK.protocolVersion,
      gameVersion: BRANDING.version,
    });
    room.onMessage(ServerMessage.Welcome, (msg: WelcomePayload) => {
      console.info('[net] welcome', msg);
    });
    this.room = room;
    return room;
  }

  leave(): void {
    this.room?.leave();
    this.room = null;
  }
}
