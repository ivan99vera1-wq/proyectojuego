import { Room, type Client } from 'colyseus';
import {
  BRANDING, DEFAULT_MAP, DEFAULT_MODE, ECONOMY, GAMEPLAY, GAME_MODES, MAPS, NETWORK,
  type GameModeDefinition, type GameModeId, type MapId,
} from '@game/config';
import {
  ClientMessage, ServerMessage, PhysicsWorld, clamp, getMapLayout, initPhysics, roomCode,
  type BuyPayload, type ChatBroadcast, type ChatPayload, type DebugTeleportPayload, type EmoteBroadcast,
  type EmotePayload, type FirePayload, type InputPayload, type InspectBroadcast,
  type InteractPayload, type JoinTeamPayload,
  type MatchPhase, type PingPayload, type PongPayload, type SwitchWeaponPayload, type WelcomePayload,
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
/** Máximo de inputs encolados por jugador: más allá es lag o abuso. */
const MAX_QUEUED_INPUTS = 30;
/** Antiflood de emotes, inspección y chat (ms). */
const EMOTE_COOLDOWN = 1500;
const INSPECT_COOLDOWN = 1200;
const CHAT_COOLDOWN = 700;
/** Tope de cabeceo, un pelo por debajo de la vertical. */
const PITCH_LIMIT = 1.55;

export interface Timings { warmup: number; freeze: number; roundTime: number; postRound: number; }
const DEFAULT_TIMINGS: Timings = {
  warmup: GAMEPLAY.match.warmupTime, freeze: GAMEPLAY.round.freezeTime,
  roundTime: GAMEPLAY.round.roundTime, postRound: GAMEPLAY.round.postRoundTime,
};

/** Número finito o el respaldo indicado. Los mensajes de red no son de fiar. */
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Sala de partida. Autoridad absoluta sobre el estado del juego.
 * Orquesta los sistemas en orden fijo cada tick.
 */
export class MatchRoom extends Room<MatchState> {
  override maxClients = GAMEPLAY.match.maxPlayersPerTeam * 2;
  physics!: PhysicsWorld;
  mode!: GameModeDefinition;
  private persistence: PersistenceAdapter | null = null;

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

  get phase(): MatchPhase { return this.state.phase as MatchPhase; }

  override async onCreate(options: MatchRoomOptions): Promise<void> {
    await initPhysics();
    this.setState(new MatchState());
    this.persistence = options.persistence ?? null;
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
    this.onMessage(ClientMessage.Fire, (client, msg: FirePayload) => this.onFire(client, msg));
    this.onMessage(ClientMessage.Reload, (client) => this.combat.startReload(client.sessionId, Date.now()));
    this.onMessage(ClientMessage.SwitchWeapon, (client, msg: SwitchWeaponPayload) => this.combat.onSwitch(client, msg));
    this.onMessage(ClientMessage.Buy, (client, msg: BuyPayload) => this.economy.onBuy(client, msg));
    this.onMessage(ClientMessage.Interact, (client, msg: InteractPayload) => this.bomb.setInteracting(client.sessionId, !!msg?.active));
    this.onMessage(ClientMessage.JoinTeam, (client, msg: JoinTeamPayload) => this.onJoinTeam(client, msg));
    this.onMessage(ClientMessage.Chat, (client, msg: ChatPayload) => this.onChat(client, msg));
    this.onMessage(ClientMessage.Emote, (client, msg: EmotePayload) => this.onEmote(client, msg));
    this.onMessage(ClientMessage.Inspect, (client) => this.onInspect(client));
    if (process.env.GAME_DEBUG === '1') {
      this.onMessage(ClientMessage.DebugTeleport, (client, msg: DebugTeleportPayload) => this.debugTeleport(client, msg));
    }
    this.onMessage(ClientMessage.Pong, (client, msg: PongPayload) => {
      const rt = this.runtime.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!rt || !p || typeof msg?.t !== 'number') return;
      rt.rtt = clamp(Date.now() - msg.t, 0, 2000);
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
    p.connected = true;
    this.state.players.set(client.sessionId, p);
    const rt = new PlayerRuntime(client.sessionId);
    this.runtime.set(client.sessionId, rt);
    this.physics.addPlayer(client.sessionId, { x: 0, y: 0, z: 0 });
    // Aunque todavía no juegue, ocupa un sitio real del mapa: su cámara mira
    // desde la salida de su equipo, no desde dentro del suelo.
    this.moveToSpawn(client.sessionId);

    const welcome: WelcomePayload = {
      sessionId: client.sessionId,
      serverTime: Date.now(),
      protocolVersion: NETWORK.protocolVersion,
      gameVersion: BRANDING.version,
      tickRate: GAMEPLAY.tickRate,
    };
    client.send(ServerMessage.Welcome, welcome);

    // Si la partida ya está en marcha y el modo reaparece, entra jugando; en el
    // modo bomba espera a la siguiente ronda (y el cliente no lo dibuja hasta
    // que aparece, porque `spawned` sigue en falso).
    if (this.phase === 'warmup' || (this.phase === 'live' && this.mode.respawn)) {
      this.spawnPlayer(client.sessionId, true);
    }
  }

  /**
   * Salida de un jugador. Si se cayó sin querer se le da un margen para volver,
   * pero deja de contar como jugador vivo de inmediato: si no, un jugador que
   * cierra la pestaña congela la ronda hasta que expire el margen.
   */
  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const id = client.sessionId;
    const p = this.state.players.get(id);
    if (!consented && p) {
      p.connected = false;
      // Caerse no cuenta como muerte ni sale en el killfeed, pero sí saca al
      // jugador del recuento de vivos para que la ronda pueda resolverse.
      this.combat.retire(id);
      try {
        await this.allowReconnection(client, NETWORK.reconnectionGrace);
        const back = this.state.players.get(id);
        if (back) back.connected = true;
        return;
      } catch { /* no volvió: se le retira abajo */ }
    }
    await this.removePlayer(id);
  }

  override async onDispose(): Promise<void> {
    for (const id of [...this.state.players.keys()]) await this.saveProfile(id);
    this.physics.free();
  }

  private async removePlayer(id: string): Promise<void> {
    const p = this.state.players.get(id);
    if (!p) return;
    await this.saveProfile(id);
    if (p.hasBomb) this.bomb.dropBomb(id);
    this.state.players.delete(id);
    this.runtime.delete(id);
    this.physics.removePlayer(id);
    this.round.onPlayerDied();
  }

  /**
   * Guarda las estadísticas acumuladas del jugador. Es lo único que sobrevive a
   * la sala; con el adaptador de memoria se pierde al reiniciar el servidor.
   */
  private async saveProfile(id: string): Promise<void> {
    const p = this.state.players.get(id);
    if (!this.persistence || !p || (p.kills === 0 && p.deaths === 0)) return;
    const previous = await this.persistence.getProfile(p.nickname);
    const won = this.mode.teams
      ? (p.team === 'A' ? this.state.scoreA > this.state.scoreB : this.state.scoreB > this.state.scoreA)
      : this.state.lastWinner === id;
    await this.persistence.saveProfile({
      id: p.nickname,
      nickname: p.nickname,
      softCurrency: previous?.softCurrency ?? 0,
      stats: {
        kills: (previous?.stats.kills ?? 0) + p.kills,
        deaths: (previous?.stats.deaths ?? 0) + p.deaths,
        wins: (previous?.stats.wins ?? 0) + (this.phase === 'ended' && won ? 1 : 0),
        losses: (previous?.stats.losses ?? 0) + (this.phase === 'ended' && !won ? 1 : 0),
      },
    });
  }

  // ---------------------------------------------------------------- helpers

  sameTeam(a: string, b: string): boolean {
    if (!this.mode.teams) return false;
    return a === b;
  }

  /** Jugadores que cuentan para arrancar y para decidir la ronda. */
  playingCount(): number {
    let n = 0;
    for (const p of this.state.players.values()) if (p.connected && p.team !== 'spectator') n++;
    return n;
  }

  private autoTeam(): string {
    if (!this.mode.teams) return 'FFA';
    let a = 0, b = 0;
    for (const p of this.state.players.values()) {
      if (!p.connected) continue;
      if (p.team === 'A') a++;
      else if (p.team === 'B') b++;
    }
    if (a >= GAMEPLAY.match.maxPlayersPerTeam && b >= GAMEPLAY.match.maxPlayersPerTeam) return 'spectator';
    return a <= b ? 'A' : 'B';
  }

  private onJoinTeam(client: Client, msg: JoinTeamPayload): void {
    const p = this.state.players.get(client.sessionId);
    if (!p || !this.mode.teams) return;
    const team = msg?.team;
    if (team !== 'A' && team !== 'B' && team !== 'spectator') return;
    if (team === p.team) return;
    if (team !== 'spectator') {
      let n = 0;
      for (const o of this.state.players.values()) if (o.connected && o.team === team) n++;
      if (n >= GAMEPLAY.match.maxPlayersPerTeam) { client.send(ServerMessage.Error, { code: 'team_full' }); return; }
    }
    // Cambiar de bando en caliente cuesta la vida, pero no cuenta como muerte
    // ni sale en el killfeed: no lo ha matado nadie.
    if (p.alive) this.combat.retire(client.sessionId);
    p.team = team;
    if (team === 'spectator') p.alive = false;
    else if (this.phase === 'warmup' || (this.phase === 'live' && this.mode.respawn)) this.spawnPlayer(client.sessionId, true);
  }

  private onChat(client: Client, msg: ChatPayload): void {
    const p = this.state.players.get(client.sessionId);
    const rt = this.runtime.get(client.sessionId);
    if (!p || !rt) return;
    const now = Date.now();
    if (now - rt.lastChatAt < CHAT_COOLDOWN) return;
    const text = String(msg?.text ?? '').slice(0, GAMEPLAY.limits.chatMessageMax).trim();
    if (!text) return;
    rt.lastChatAt = now;
    const payload: ChatBroadcast = { from: client.sessionId, nickname: p.nickname, text, team: !!msg.team };
    if (payload.team) {
      for (const c of this.clients) {
        const o = this.state.players.get(c.sessionId);
        if (o && this.sameTeam(o.team, p.team)) c.send(ServerMessage.Chat, payload);
      }
    } else this.broadcast(ServerMessage.Chat, payload);
  }

  private onEmote(client: Client, msg: EmotePayload): void {
    const rt = this.runtime.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    if (!rt || !p || !p.alive) return;
    const now = Date.now();
    if (now - rt.lastEmoteAt < EMOTE_COOLDOWN) return;
    rt.lastEmoteAt = now;
    const payload: EmoteBroadcast = { playerId: client.sessionId, emote: clamp(num(msg?.emote) | 0, 0, 1) };
    this.broadcast(ServerMessage.Emote, payload);
  }

  /**
   * El jugador se mira el arma. No cambia nada del juego: es puro gesto, pero
   * lo ven los demás, así que lleva antiflood como los emotes.
   */
  private onInspect(client: Client): void {
    const rt = this.runtime.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    if (!rt || !p || !p.alive) return;
    const now = Date.now();
    if (now - rt.lastInspectAt < INSPECT_COOLDOWN) return;
    rt.lastInspectAt = now;
    const payload: InspectBroadcast = { playerId: client.sessionId };
    this.broadcast(ServerMessage.Inspect, payload);
  }

  private onFire(client: Client, msg: FirePayload): void {
    this.combat.onFire(client, { yaw: num(msg?.yaw), pitch: clamp(num(msg?.pitch), -PITCH_LIMIT, PITCH_LIMIT) }, Date.now());
  }

  private debugTeleport(client: Client, msg: DebugTeleportPayload): void {
    const rt = this.runtime.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    if (!rt || !p) return;
    rt.kin.x = num(msg?.x); rt.kin.y = num(msg?.y); rt.kin.z = num(msg?.z);
    rt.kin.vx = rt.kin.vy = rt.kin.vz = 0;
    this.physics.setPlayerPosition(client.sessionId, rt.kin);
    p.x = rt.kin.x; p.y = rt.kin.y; p.z = rt.kin.z;
    rt.history.length = 0;
  }

  /**
   * Coloca al jugador en un punto de aparición SIN devolverle la vida.
   *
   * Se usa también al entrar: mientras espera a la siguiente ronda su posición
   * tiene que ser un sitio real del mapa. Si se queda en el origen, la cámara
   * del que espera aparece dentro de la plaza central, a oscuras.
   */
  private moveToSpawn(id: string): void {
    const p = this.state.players.get(id);
    const rt = this.runtime.get(id);
    if (!p || !rt || p.team === 'spectator') return;
    const occupied = [...this.state.players.values()].filter((o) => o.id !== id && o.alive).map((o) => ({ x: o.x, z: o.z }));
    const team = this.mode.teams ? (p.team === 'A' ? 'A' : 'B') : 'FFA';
    const s = pickSpawn(this.physics, team, occupied);
    rt.kin.x = s.x; rt.kin.y = s.y + 0.05; rt.kin.z = s.z;
    rt.kin.vx = rt.kin.vy = rt.kin.vz = 0;
    rt.kin.grounded = true;
    rt.kin.crouching = false;
    rt.inputs.length = 0;
    rt.history.length = 0;
    rt.damagers.length = 0;
    rt.interacting = false;
    rt.interactStart = null;
    this.physics.setPlayerPosition(id, rt.kin);
    p.x = s.x; p.y = rt.kin.y; p.z = s.z; p.yaw = s.yaw; p.pitch = 0;
  }

  /** Reaparece a un jugador con vida completa. `resetLoadout` fuerza equipo inicial. */
  spawnPlayer(id: string, resetLoadout: boolean): void {
    const p = this.state.players.get(id);
    const rt = this.runtime.get(id);
    if (!p || !rt || p.team === 'spectator' || !p.connected) return;
    this.moveToSpawn(id);
    p.health = GAMEPLAY.player.maxHealth;
    p.alive = true;
    p.spawned = true;
    p.crouching = false;
    p.reloading = false;
    p.interactProgress = 0;
    p.hasBomb = false;
    // Quien sobrevive a una ronda conserva lo que compró; quien muere (o entra
    // nuevo, o juega un modo sin economía) vuelve al equipo inicial.
    if (resetLoadout || rt.diedLastRound || !this.mode.economy) {
      rt.resetLoadout();
      p.armor = 0; p.helmet = false; p.kit = false;
    }
    rt.diedLastRound = false;
    // Cargadores llenos al empezar la ronda.
    for (const [wid] of rt.ammo) rt.fillAmmo(wid);
    this.combat.equipBest(id);
  }

  swapTeams(): void {
    const s = this.state;
    for (const p of s.players.values()) {
      if (p.team === 'A') p.team = 'B';
      else if (p.team === 'B') p.team = 'A';
      p.kit = false;
      p.money = this.startingMoney;
    }
    const a = s.scoreA; s.scoreA = s.scoreB; s.scoreB = a;
    const la = this.economy.consecutiveLosses.A;
    this.economy.consecutiveLosses.A = this.economy.consecutiveLosses.B;
    this.economy.consecutiveLosses.B = la;
    for (const rt of this.runtime.values()) { rt.resetLoadout(); rt.diedLastRound = true; }
  }

  private onInput(client: Client, input: InputPayload): void {
    const rt = this.runtime.get(client.sessionId);
    if (!rt || !input || typeof input.seq !== 'number') return;
    if (rt.inputs.length >= MAX_QUEUED_INPUTS) rt.inputs.splice(0, rt.inputs.length - MAX_QUEUED_INPUTS + 1);
    rt.inputs.push({
      seq: input.seq | 0,
      dt: num(input.dt),
      forward: clamp(num(input.forward), -1, 1),
      right: clamp(num(input.right), -1, 1),
      jump: !!input.jump, crouch: !!input.crouch, sprint: !!input.sprint,
      yaw: num(input.yaw),
      pitch: clamp(num(input.pitch), -PITCH_LIMIT, PITCH_LIMIT),
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
      const payload: PingPayload = { t: now };
      c.send(ServerMessage.Ping, payload);
    }
  }
}

function sanitizeNickname(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^\p{L}\p{N}_\- ]/gu, '').trim();
  const { nicknameMin, nicknameMax } = GAMEPLAY.limits;
  if (s.length < nicknameMin) return `Chibi${Math.floor(Math.random() * 9000 + 1000)}`;
  return s.slice(0, nicknameMax);
}
