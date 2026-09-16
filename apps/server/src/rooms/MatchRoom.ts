import { Room, type Client } from 'colyseus';
import { BRANDING, DEFAULT_MAP, DEFAULT_MODE, GAMEPLAY, NETWORK } from '@game/config';
import { ClientMessage, ServerMessage, sanitizeAvatar, encodeAvatar, type InputPayload, type WelcomePayload } from '@game/shared';
import { MatchState, PlayerState } from './schema/MatchState.js';
import type { PersistenceAdapter } from '../persistence/PersistenceAdapter.js';

interface JoinOptions {
  nickname?: string;
  avatar?: unknown;
  protocolVersion?: number;
  gameVersion?: string;
}

/**
 * Sala de partida. Autoridad absoluta sobre el estado del juego.
 * Fase 1: entra/sale de jugadores, handshake de versión, bucle de tick vacío.
 * Fase 2: systems/ (movimiento con Rapier, combate con lag compensation,
 * rondas, economía, bomba).
 */
export class MatchRoom extends Room<MatchState> {
  override maxClients = GAMEPLAY.match.maxPlayersPerTeam * 2;
  private persistence!: PersistenceAdapter;

  override onCreate(options: { persistence: PersistenceAdapter; mapId?: string; modeId?: string }): void {
    this.persistence = options.persistence;
    this.setState(new MatchState());
    this.state.mapId = options.mapId ?? DEFAULT_MAP;
    this.state.modeId = options.modeId ?? DEFAULT_MODE;
    this.setPatchRate(1000 / NETWORK.patchRate);
    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / GAMEPLAY.tickRate);

    this.onMessage(ClientMessage.Input, (client, input: InputPayload) => this.onInput(client, input));
    this.onMessage(ClientMessage.SetAvatar, (client, avatar: unknown) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.avatar = encodeAvatar(sanitizeAvatar(avatar));
    });
    this.onMessage(ClientMessage.Chat, (client, msg: { text: string; team: boolean }) => {
      const text = String(msg?.text ?? '').slice(0, GAMEPLAY.limits.chatMessageMax);
      if (!text) return;
      this.broadcast(ServerMessage.Chat, { from: client.sessionId, text, team: !!msg.team });
    });

    console.info(`[${BRANDING.name}] sala ${this.roomId} creada (${this.state.mapId}/${this.state.modeId})`);
  }

  override onAuth(_client: Client, options: JoinOptions): boolean {
    if (options.protocolVersion !== NETWORK.protocolVersion) {
      throw new Error('protocol_version_mismatch');
    }
    return true;
  }

  override onJoin(client: Client, options: JoinOptions): void {
    const p = new PlayerState();
    p.id = client.sessionId;
    p.nickname = sanitizeNickname(options.nickname);
    p.avatar = encodeAvatar(sanitizeAvatar(options.avatar));
    this.state.players.set(client.sessionId, p);

    const welcome: WelcomePayload = {
      sessionId: client.sessionId,
      serverTime: Date.now(),
      protocolVersion: NETWORK.protocolVersion,
      gameVersion: BRANDING.version,
      tickRate: GAMEPLAY.tickRate,
    };
    client.send(ServerMessage.Welcome, welcome);
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    if (!consented) {
      try {
        await this.allowReconnection(client, NETWORK.reconnectionGrace);
        return;
      } catch {
        /* no volvió */
      }
    }
    this.state.players.delete(client.sessionId);
  }

  private onInput(client: Client, input: InputPayload): void {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    // Fase 2: encolar en MovementSystem. De momento solo aceptamos la orientación.
    p.yaw = input.yaw;
    p.pitch = input.pitch;
    p.lastSeq = input.seq;
  }

  private tick(_dt: number): void {
    // Fase 2: RoundSystem.update → MovementSystem.update → CombatSystem.update → BombSystem.update
  }
}

function sanitizeNickname(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^\p{L}\p{N}_\- ]/gu, '').trim();
  const { nicknameMin, nicknameMax } = GAMEPLAY.limits;
  if (s.length < nicknameMin) return `Chibi${Math.floor(Math.random() * 9000 + 1000)}`;
  return s.slice(0, nicknameMax);
}
