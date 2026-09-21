import { Client, type Room } from 'colyseus.js';
import { BRANDING, NETWORK } from '@game/config';
import { ClientMessage, ServerMessage, type InputPayload } from '@game/shared';

export interface JoinParams {
  nickname: string;
  modeId?: string;
  mapId?: string;
}

type Handler<T = unknown> = (msg: T) => void;

/**
 * Envoltorio de colyseus.js. Gestiona unión a salas (pública / privada / por
 * código), responde a pings del servidor y expone handlers tipados.
 */
export class NetworkClient {
  private readonly client: Client;
  readonly httpBase: string;
  room: Room | null = null;
  rtt = 0;
  private readonly handlers = new Map<string, Set<Handler>>();

  readonly url: string;

  constructor(url = import.meta.env.VITE_GAME_SERVER_URL ?? `ws://${location.hostname}:${NETWORK.defaultPort}`) {
    this.url = url;
    this.client = new Client(url);
    this.httpBase = url.replace(/^ws/, 'http');
  }

  /**
   * ¿Hay servidor de juego escuchando? Se usa para distinguir "el servidor no
   * está arrancado" de cualquier otro fallo, porque el error de WebSocket que
   * llega al navegador no dice nada útil.
   */
  async isServerUp(timeoutMs = 2500): Promise<boolean> {
    try {
      const res = await fetch(`${this.httpBase}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private baseOptions(p: JoinParams) {
    return { nickname: p.nickname, protocolVersion: NETWORK.protocolVersion, gameVersion: BRANDING.version };
  }

  async quickMatch(p: JoinParams): Promise<Room> {
    const room = await this.client.joinOrCreate(NETWORK.rooms.match, { ...this.baseOptions(p), modeId: p.modeId, mapId: p.mapId });
    return this.waitForState(this.attach(room));
  }

  async createPrivate(p: JoinParams): Promise<Room> {
    const room = await this.client.create(NETWORK.rooms.match, { ...this.baseOptions(p), modeId: p.modeId, mapId: p.mapId, private: true });
    return this.waitForState(this.attach(room));
  }

  async joinByCode(code: string, p: JoinParams): Promise<Room> {
    const res = await fetch(`${this.httpBase}/rooms/${encodeURIComponent(code.toUpperCase())}`);
    if (!res.ok) throw new Error('room_not_found');
    const { roomId } = (await res.json()) as { roomId: string };
    const room = await this.client.joinById(roomId, this.baseOptions(p));
    return this.waitForState(this.attach(room));
  }

  /** Espera al primer estado completo para que la escena arranque con datos válidos. */
  private waitForState(room: Room): Promise<Room> {
    if (room.state && (room.state as { players?: unknown }).players) return Promise.resolve(room);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(room), 3000);
      room.onStateChange.once(() => { clearTimeout(timer); resolve(room); });
    });
  }

  private attach(room: Room): Room {
    this.room = room;
    // Registrar TODOS los tipos conocidos para no perder mensajes tempranos.
    for (const type of Object.values(ServerMessage)) {
      room.onMessage(type, (msg: unknown) => this.dispatch(type, msg));
    }
    this.on(ServerMessage.Ping, (msg: { t: number }) => {
      room.send(ClientMessage.Pong, { t: msg.t });
    });
    room.onLeave(() => { if (this.room === room) this.room = null; });
    return room;
  }

  private dispatch(type: string, msg: unknown): void {
    const set = this.handlers.get(type);
    if (set) for (const h of set) h(msg);
  }

  on<T>(type: string, handler: Handler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) { set = new Set(); this.handlers.set(type, set); }
    set.add(handler as Handler);
    return () => set!.delete(handler as Handler);
  }

  clearHandlers(): void {
    this.handlers.clear();
  }

  send(type: string, payload?: unknown): void {
    this.room?.send(type, payload);
  }

  sendInput(input: InputPayload): void {
    this.room?.send(ClientMessage.Input, input);
  }

  get sessionId(): string {
    return this.room?.sessionId ?? '';
  }

  leave(): void {
    const r = this.room;
    this.room = null;
    this.clearHandlers();
    r?.leave();
  }
}
