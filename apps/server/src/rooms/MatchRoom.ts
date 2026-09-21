import { Room, type Client } from 'colyseus';
import {
  BRANDING, DEFAULT_MAP, DEFAULT_MODE, ECONOMY, GAMEPLAY, GAME_MODES, MAPS, NETWORK,
  type GameModeDefinition, type GameModeId, type MapId,
} from '@game/config';
import {
  ClientMessage, ServerMessage, PhysicsWorld, getMapLayout, initPhysics, roomCode,
  type BuyPayload, type ChatBroadcast, type ChatPayload, type EmotePayload, type FirePayload, type InputPayload,
  type InteractPayload, type JoinTeamPayload, type SwitchWeaponPayload, type WelcomePayload,
} from '@game/shared';
import { MatchState, PlayerState } from './schema/MatchState.js';
import { PlayerRuntime } from './PlayerRuntime.js';
import { pickSpawn } from './spawn.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { RoundSystem } from '../systems/RoundSystem.js';
import { BombSystem } from '../systems/BombSystem.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import type { PersistenceAdapter } from '../persistence/PersistenceAdapter.js';

export interface MatchRoomOptions {
  persistence?: PersistenceAdapter;
  mapId?: string;
  modeId?: string;
  /** Sala privada con código de invitación. */
  private?: boolean;
  /** Solo con GAME_DEBUG=1: acorta tiempos para pruebas. */
  timings?: Partial<Timings>;
}

export interface JoinOptions {
  nickname?: string;
  protocolVersion?: number;
  gameVersion?: string;
}

const PING_INTERVAL = 2000;

export interface Timings { warmup: number; freeze: number; roundTime: number; postRound: number; }
const DEFAULT_TIMINGS: Timings = {
  warmup: GAMEPLAY.match.warmupTime, freeze: GAMEPLAY.round.freezeTime,
  roundTime: GAMEPLAY.round.roundTime, postRound: GAMEPLAY.round.postRoundTime,
};

/**
 * Sala de partida. Autoridad absoluta sobre el estado del juego.
 * Orquesta los sistemas en orden fijo cada tick.
 */
export class MatchRoom extends Room<MatchState> {
  override maxClients = GAMEPLAY.match.maxPlayersPerTeam * 2;
  physics!: PhysicsWorld;
  mode!: GameModeDefinition;

  /** Dinero inicial del modo. Entrenamiento arranca con la cartera llena. */
  get startingMoney(): number {
    return this.mode.startingMoney ?? ECONOMY.startingMoney;
  }
  readonly runtime = new Map<string, PlayerRuntime>();
  timings: Timings = { ...DEFAULT_TIMINGS };

  movement = new MovementSystem(this);
  combat = new CombatSystem(this);
  round = new RoundSystem(this);
  bomb = new BombSystem(this);
  economy = new EconomySystem(this);
  projectiles = new ProjectileSystem(this);

  override async onCreate(options: MatchRoomOptions): Promise<void> {
    await initPhysics();
    this.setState(new MatchState());
    const mapId = (options.mapId && options.mapId in MAPS ? options.mapId : DEFAULT_MAP) as MapId;
    const modeId = (options.modeId && options.modeId in GAME_MODES ? options.modeId : DEFAULT_MODE) as GameModeId;
    this.state.mapId = mapId;
    this.state.modeId = modeId;
    this.mode = GAME_MODES[modeId];
    this.physics = new PhysicsWorld(getMapLayout(mapId));
    if (process.env.GAME_DEBUG === '1' && options.timings) this.timings = { ...DEFAULT_TIMINGS, ...options.timings };
    if (options.private) {
      this.state.code = roomCode();
      this.setPrivate(true);
    }
    this.setMetadata({ code: this.state.code, mapId, modeId });
    this.setPatchRate(1000 / NETWORK.patchRate);
    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / GAMEPLAY.tickRate);

    this.onMessage(ClientMessage.Input, (client, input: InputPayload) => this.onInput(client, input));
    this.onMessage(ClientMessage.Fire, (client, msg: FirePayload) => this.combat.onFire(client, msg ?? { yaw: 0, pitch: 0 }, Date.now()));
    this.onMessage(ClientMessage.Reload, (client) => this.combat.startReload(client.sessionId, Date.now()));
    this.onMessage(ClientMessage.SwitchWeapon, (client, msg: SwitchWeaponPayload) => this.combat.onSwitch(client, msg));
    this.onMessage(ClientMessage.Buy, (client, msg: BuyPayload) => this.economy.onBuy(client, msg));
    this.onMessage(ClientMessage.Interact, (client, msg: InteractPayload) => this.bomb.setInteracting(client.sessionId, !!msg?.active));
    this.onMessage(ClientMessage.JoinTeam, (client, msg: JoinTeamPayload) => this.onJoinTeam(client, msg));
    this.onMessage(ClientMessage.Chat, (client, msg: ChatPayload) => {
      const p = this.state.players.get(client.sessionId);
      const text = String(msg?.text ?? '').slice(0, GAMEPLAY.limits.chatMessageMax).trim();
      if (!p || !text) return;
      const payload: ChatBroadcast = { from: client.sessionId, nickname: p.nickname, text, team: !!msg.team };
      if (payload.team) {
        for (const c of this.clients) {
          const o = this.state.players.get(c.sessionId);
          if (o && this.sameTeam(o.team, p.team)) c.send(ServerMessage.Chat, payload);
        }
      } else this.broadcast(ServerMessage.Chat, payload);
    });
    this.onMessage(ClientMessage.Emote, (client, msg: EmotePayload) => {
      this.broadcast(ServerMessage.Emote, { playerId: client.sessionId, emote: Number(msg?.emote ?? 0) | 0 });
    });
    if (process.env.GAME_DEBUG === '1') {
      this.onMessage(ClientMessage.DebugTeleport, (client, msg: { x: number; y: number; z: number }) => {
        const rt = this.runtime.get(client.sessionId);
        const p = this.state.players.get(client.sessionId);
        if (!rt || !p) return;
        rt.kin.x = msg.x; rt.kin.y = msg.y; rt.kin.z = msg.z; rt.kin.vx = rt.kin.vy = rt.kin.vz = 0;
        this.physics.setPlayerPosition(client.sessionId, rt.kin);
        p.x = msg.x; p.y = msg.y; p.z = msg.z;
        rt.history.length = 0;
      });
    }

    this.onMessage(ClientMessage.Pong, (client, msg: { t: number }) => {
      const rt = this.runtime.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!rt || !p || typeof msg?.t !== 'number') return;
      rt.rtt = Math.max(0, Math.min(2000, Date.now() - msg.t));
      p.ping = Math.round(rt.rtt);
    });

    console.info(`[${BRANDING.name}] sala ${this.roomId} creada (${mapId}/${modeId}${this.state.code ? ' código ' + this.state.code : ''})`);
  }

  override onAuth(_client: Client, options: JoinOptions): boolean {
    if (options?.protocolVersion !== NETWORK.protocolVersion) throw new Error('protocol_version_mismatch');
    return true;
  }

  override onJoin(client: Client, options: JoinOptions): void {
    const p = new PlayerState();
    p.id = client.sessionId;
    p.nickname = sanitizeNickname(options?.nickname);
    p.money = this.mode.economy ? this.startingMoney : 0;
    p.team = this.autoTeam();
    this.state.players.set(client.sessionId, p);
    const rt = new PlayerRuntime(client.sessionId);
    this.runtime.set(client.sessionId, rt);
    this.physics.addPlayer(client.sessionId, { x: 0, y: 0, z: 0 });

    const welcome: WelcomePayload = {
      sessionId: client.sessionId,
      serverTime: Date.now(),
      protocolVersion: NETWORK.protocolVersion,
      gameVersion: BRANDING.version,
      tickRate: GAMEPLAY.tickRate,
    };
    client.send(ServerMessage.Welcome, welcome);

    // Si la partida ya está en marcha, entra como muerto y reaparece según el modo.
    if (this.state.phase === 'warmup' || (this.state.phase === 'live' && this.mode.respawn)) {
      this.spawnPlayer(client.sessionId, true);
    }
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.players.get(client.sessionId);
    if (!consented && p) {
      try {
        await this.allowReconnection(client, NETWORK.reconnectionGrace);
        return;
      } catch { /* no volvió */ }
    }
    if (p?.hasBomb) this.bomb.dropBomb(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.runtime.delete(client.sessionId);
    this.physics.removePlayer(client.sessionId);
    this.round.onPlayerDied();
  }

  override onDispose(): void {
    this.physics.free();
  }

  // ---------------------------------------------------------------- helpers

  sameTeam(a: string, b: string): boolean {
    if (!this.mode.teams) return false;
    return a === b;
  }

  playingCount(): number {
    let n = 0;
    for (const p of this.state.players.values()) if (p.team !== 'spectator') n++;
    return n;
  }

  private autoTeam(): string {
    if (!this.mode.teams) return 'FFA';
    let a = 0, b = 0;
    for (const p of this.state.players.values()) { if (p.team === 'A') a++; else if (p.team === 'B') b++; }
    if (a >= GAMEPLAY.match.maxPlayersPerTeam && b >= GAMEPLAY.match.maxPlayersPerTeam) return 'spectator';
    return a <= b ? 'A' : 'B';
  }

  private onJoinTeam(client: Client, msg: JoinTeamPayload): void {
    const p = this.state.players.get(client.sessionId);
    if (!p || !this.mode.teams) return;
    const team = msg?.team;
    if (team !== 'A' && team !== 'B' && team !== 'spectator') return;
    if (team !== 'spectator') {
      let n = 0;
      for (const o of this.state.players.values()) if (o.team === team) n++;
      if (n >= GAMEPLAY.match.maxPlayersPerTeam) { client.send(ServerMessage.Error, { code: 'team_full' }); return; }
    }
    if (p.alive) this.combat.kill(client.sessionId, client.sessionId, 'switch', false);
    p.team = team;
    if (team === 'spectator') p.alive = false;
    else if (this.state.phase === 'warmup' || (this.state.phase === 'live' && this.mode.respawn)) this.spawnPlayer(client.sessionId, true);
  }

  /** Reaparece a un jugador con vida completa. `resetLoadout` fuerza equipo inicial. */
  spawnPlayer(id: string, resetLoadout: boolean): void {
    const p = this.state.players.get(id);
    const rt = this.runtime.get(id);
    if (!p || !rt || p.team === 'spectator') return;
    const layout = this.physics.layout;
    const occupied = [...this.state.players.values()].filter((o) => o.id !== id && o.alive).map((o) => ({ x: o.x, z: o.z }));
    const team = this.mode.teams ? (p.team === 'A' ? 'A' : 'B') : 'FFA';
    const s = pickSpawn(layout, team, occupied);
    rt.kin.x = s.x; rt.kin.y = s.y + 0.05; rt.kin.z = s.z;
    rt.kin.vx = rt.kin.vy = rt.kin.vz = 0;
    rt.kin.grounded = true;
    rt.kin.crouching = false;
    rt.inputs.length = 0;
    rt.history.length = 0;
    rt.interacting = false;
    this.physics.setPlayerPosition(id, rt.kin);
    p.x = s.x; p.y = rt.kin.y; p.z = s.z; p.yaw = s.yaw; p.pitch = 0;
    p.health = GAMEPLAY.player.maxHealth;
    p.alive = true;
    p.crouching = false;
    p.reloading = false;
    p.interactProgress = 0;
    p.hasBomb = false;
    // Si murió en la ronda anterior (o es warmup/respawn), vuelve al equipo inicial; si sobrevivió, conserva lo comprado.
    const died = p.deaths > 0 && !p.alive;
    if (resetLoadout || died || !this.mode.economy || rt.inventory.primary === null && rt.inventory.secondary === 'pistol_basic') {
      if (resetLoadout || rt.lastDamageFrom !== null || !this.mode.economy) {
        rt.resetLoadout();
        p.armor = 0; p.helmet = false; p.kit = false;
      }
    }
    rt.lastDamageFrom = null;
    // Recargar cargadores al empezar la ronda
    for (const [wid] of rt.ammo) rt.fillAmmo(wid);
    this.combat.equipBest(id);
  }

  swapTeams(): void {
    const s = this.state;
    for (const p of s.players.values()) {
      if (p.team === 'A') p.team = 'B';
      else if (p.team === 'B') p.team = 'A';
      p.kit = false;
    }
    const a = s.scoreA; s.scoreA = s.scoreB; s.scoreB = a;
    const la = this.economy.consecutiveLosses.A;
    this.economy.consecutiveLosses.A = this.economy.consecutiveLosses.B;
    this.economy.consecutiveLosses.B = la;
    for (const p of s.players.values()) p.money = this.startingMoney;
    for (const rt of this.runtime.values()) rt.resetLoadout();
  }

  private onInput(client: Client, input: InputPayload): void {
    const rt = this.runtime.get(client.sessionId);
    if (!rt || !input || typeof input.seq !== 'number') return;
    if (rt.inputs.length > 30) rt.inputs.splice(0, rt.inputs.length - 30);
    rt.inputs.push({
      seq: input.seq | 0,
      dt: Number.isFinite(input.dt) ? input.dt : 0,
      forward: Number.isFinite(input.forward) ? input.forward : 0,
      right: Number.isFinite(input.right) ? input.right : 0,
      jump: !!input.jump, crouch: !!input.crouch, sprint: !!input.sprint,
      yaw: Number.isFinite(input.yaw) ? input.yaw : 0,
      pitch: Number.isFinite(input.pitch) ? Math.max(-1.55, Math.min(1.55, input.pitch)) : 0,
    });
  }

  private tick(dt: number): void {
    const now = Date.now();
    this.round.update(dt, now);
    this.movement.update(dt, now);
    this.combat.update(now);
    this.projectiles.update(dt, now);
    this.bomb.update(dt, now);
    this.pingClients(now);
  }

  private pingClients(now: number): void {
    for (const c of this.clients) {
      const rt = this.runtime.get(c.sessionId);
      if (!rt || now - rt.lastPingSentAt < PING_INTERVAL) continue;
      rt.lastPingSentAt = now;
      c.send(ServerMessage.Ping, { t: now });
    }
  }
}

function sanitizeNickname(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^\p{L}\p{N}_\- ]/gu, '').trim();
  const { nicknameMin, nicknameMax } = GAMEPLAY.limits;
  if (s.length < nicknameMin) return `Chibi${Math.floor(Math.random() * 9000 + 1000)}`;
  return s.slice(0, nicknameMax);
}
