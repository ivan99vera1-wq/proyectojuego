import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Room } from 'colyseus.js';
import { NETWORK, GAMEPLAY, GAME_MODES, WEAPONS } from '@game/config';
import { ClientMessage, ServerMessage, type InputPayload } from '@game/shared';
import { createGameServer, type GameServer } from './server.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let server: GameServer;
let url: string;

/**
 * colyseus.js avisa por stderr de cada mensaje que llega sin handler, y el
 * servidor emite muchos. Registrando todos los tipos, un fallo de verdad no se
 * pierde entre cientos de líneas de aviso.
 */
const silence = (room: Room): Room => {
  for (const type of Object.values(ServerMessage)) room.onMessage(type, () => undefined);
  return room;
};

const join = async (opts: Record<string, unknown> = {}, create = false) => {
  const c = new Client(url);
  const options = { nickname: 'Tester', protocolVersion: NETWORK.protocolVersion, ...opts };
  return silence(await (create ? c.create(NETWORK.rooms.match, options) : c.joinOrCreate(NETWORK.rooms.match, options)));
};

/** Se une a una sala existente, también sin ruido en stderr. */
const joinExisting = async (roomId: string, nickname: string) =>
  silence(await new Client(url).joinById(roomId, { nickname, protocolVersion: NETWORK.protocolVersion }));

const input = (seq: number, over: Partial<InputPayload> = {}): InputPayload =>
  ({ seq, dt: 1 / 60, forward: 0, right: 0, jump: false, crouch: false, sprint: false, yaw: 0, pitch: 0, ...over });

const players = (room: Room) => (room.state as any).players as Map<string, any>;

beforeAll(async () => {
  process.env.GAME_DEBUG = '1';
  server = await createGameServer(0, '127.0.0.1');
  url = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => { await server.shutdown(); });

describe('MatchRoom e2e', () => {
  it('rejects wrong protocol version', async () => {
    await expect(new Client(url).joinOrCreate(NETWORK.rooms.match, { protocolVersion: 99 })).rejects.toThrow();
  });

  it('private room gets a code and can be found via HTTP', async () => {
    const room = await join({ modeId: 'ffa', private: true }, true);
    await sleep(150);
    const code = (room.state as any).code as string;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    const res = await fetch(`http://127.0.0.1:${server.port}/rooms/${code}`);
    const body = await res.json();
    expect(body.roomId).toBe(room.roomId);
    await room.leave();
  });

  it('two players spawn in ffa, move and shoot each other', async () => {
    const a = await join({ modeId: 'ffa', nickname: 'Alpha', private: true }, true);
    await sleep(100);
    const b = await joinExisting(a.roomId, 'Bravo');
    await sleep(200);
    expect(players(a).size).toBe(2);
    // con 2 jugadores arranca warmup y ambos aparecen
    await sleep(300);
    const pa = players(a).get(a.sessionId);
    expect((a.state as any).phase).toBe('warmup');
    expect(pa.alive).toBe(true);

    // movimiento: 60 inputs hacia adelante.
    // OJO: `pa` es el objeto vivo del estado, así que hay que copiar la
    // posición de partida a números sueltos. Leyendo `pa.x` después del
    // movimiento se comparaba el jugador consigo mismo y un desplazamiento
    // puramente lateral daba cero.
    const startX = pa.x;
    const startZ = pa.z;
    const yaw = pa.yaw;
    for (let i = 1; i <= 60; i++) { a.send(ClientMessage.Input, input(i, { forward: 1, yaw })); await sleep(16); }
    await sleep(200);
    const moved = Math.hypot(players(a).get(a.sessionId).x - startX, players(a).get(a.sessionId).z - startZ);
    expect(moved).toBeGreaterThan(2);
    expect(players(a).get(a.sessionId).lastSeq).toBe(60);

    // disparo: teletransportamos a A a 3 m delante de B (GAME_DEBUG=1) y apuntamos
    const pb0 = players(a).get(b.sessionId);
    a.send(ClientMessage.DebugTeleport, { x: pb0.x, y: pb0.y, z: pb0.z + 3 });
    await sleep(250);
    const pb = players(a).get(b.sessionId);
    const me = players(a).get(a.sessionId);
    const dx = pb.x - me.x, dz = pb.z - me.z;
    const aimYaw = Math.atan2(-dx, -dz);
    const dist = Math.hypot(dx, dz);
    const aimPitch = Math.atan2((pb.y + 0.6) - (me.y + GAMEPLAY.player.eyeHeight), dist);
    let hits = 0;
    a.onMessage(ServerMessage.Hit, () => hits++);
    const hpBefore = pb.health;
    for (let i = 0; i < 12; i++) { a.send(ClientMessage.Fire, { yaw: aimYaw, pitch: aimPitch }); await sleep(180); }
    await sleep(200);
    expect(hits).toBeGreaterThan(0);
    expect(players(a).get(b.sessionId).health).toBeLessThanOrEqual(hpBefore);
    expect(players(a).get(a.sessionId).ammoMag).toBeLessThan(13);
    await a.leave(); await b.leave();
  });

  it('bomb mode: buy during freeze and phases advance', async () => {
    const a = await join({ modeId: 'bomb', nickname: 'Alpha', private: true }, true);
    await sleep(100);
    const b = await joinExisting(a.roomId, 'Bravo');
    await sleep(300);
    expect((a.state as any).phase).toBe('warmup');
    const teams = new Set([players(a).get(a.sessionId).team, players(a).get(b.sessionId).team]);
    expect(teams).toEqual(new Set(['A', 'B']));
    await a.leave(); await b.leave();
  }, 10000);
});

describe('bomb mode full round', () => {
  it('buy in freeze, plant, defuse → team A wins the round', async () => {
    const timings = { warmup: 0.5, freeze: 1.5, roundTime: 60, postRound: 0.5 };
    const a = await join({ modeId: 'bomb', nickname: 'Alpha', private: true, timings }, true);
    await sleep(100);
    const b = await joinExisting(a.roomId, 'Bravo');
    const rooms = { A: a, B: b } as Record<string, Room>;
    await sleep(300);
    // Identificar quién es A y quién es B
    const teamOf = (room: Room) => players(a).get(room.sessionId).team as 'A' | 'B';
    const byTeam = { [teamOf(a)]: a, [teamOf(b)]: b } as Record<'A' | 'B', Room>;
    void rooms;

    // esperar a freeze (warmup 0.5s)
    for (let i = 0; i < 40 && (a.state as any).phase !== 'freeze'; i++) await sleep(50);
    expect((a.state as any).phase).toBe('freeze');
    expect((a.state as any).round).toBe(1);

    // comprar chaleco (650 de 800) con el equipo A
    byTeam.A.send(ClientMessage.Buy, { itemId: 'armor' });
    await sleep(150);
    expect(players(a).get(byTeam.A.sessionId).armor).toBe(100);
    expect(players(a).get(byTeam.A.sessionId).money).toBe(150);
    // demasiado caro
    let errors = 0;
    byTeam.B.onMessage(ServerMessage.Error, () => errors++);
    byTeam.B.send(ClientMessage.Buy, { itemId: 'sniper_comet' });
    await sleep(150);
    expect(errors).toBe(1);

    // portador de bomba = el jugador B
    expect(players(a).get(byTeam.B.sessionId).hasBomb).toBe(true);

    // esperar a live
    for (let i = 0; i < 60 && (a.state as any).phase !== 'live'; i++) await sleep(50);
    expect((a.state as any).phase).toBe('live');

    // B se teletransporta al sitio A y planta
    byTeam.B.send(ClientMessage.DebugTeleport, { x: -20, y: 0.05, z: -22 });
    await sleep(150);
    byTeam.B.send(ClientMessage.Interact, { active: true });
    let planted = false;
    a.onMessage(ServerMessage.BombPlanted, () => (planted = true));
    for (let i = 0; i < 100 && !planted; i++) await sleep(50);
    expect(planted).toBe(true);
    await sleep(200); // el patch de estado llega tras el mensaje
    expect((a.state as any).bombState).toBe('planted');

    // A se acerca y desactiva (8 s sin kit)
    byTeam.A.send(ClientMessage.DebugTeleport, { x: -20.5, y: 0.05, z: -22 });
    await sleep(150);
    byTeam.A.send(ClientMessage.Interact, { active: true });
    let roundEnd: { winner: string; reason: string } | null = null;
    a.onMessage(ServerMessage.RoundEnd, (m: { winner: string; reason: string }) => (roundEnd = m));
    for (let i = 0; i < 220 && !roundEnd; i++) await sleep(50);
    await sleep(200);
    expect(roundEnd).toEqual({ winner: 'A', reason: 'bomb_defused' });
    expect((a.state as any).scoreA).toBe(1);
    // economía: A ganó 3250, B perdió 1400
    expect(players(a).get(byTeam.A.sessionId).money).toBe(150 + 3250 + 300);
    expect(players(a).get(byTeam.B.sessionId).money).toBe(800 + 1400 + 300);

    // siguiente ronda arranca
    for (let i = 0; i < 60 && (a.state as any).round !== 2; i++) await sleep(50);
    expect((a.state as any).round).toBe(2);
    expect((a.state as any).phase).toBe('freeze');
    await a.leave(); await b.leave();
  }, 30000);
});

describe('grenades', () => {
  it('buy a frag in freeze, throw it live, it explodes', async () => {
    const timings = { warmup: 0.5, freeze: 1.5, roundTime: 60, postRound: 0.5 };
    const a = await join({ modeId: 'bomb', nickname: 'Alpha', private: true, timings }, true);
    await sleep(100);
    const b = await joinExisting(a.roomId, 'Bravo');
    for (let i = 0; i < 60 && (a.state as any).phase !== 'freeze'; i++) await sleep(50);
    a.send(ClientMessage.Buy, { itemId: 'grenade_frag' });
    await sleep(150);
    expect(players(a).get(a.sessionId).grenadeIds).toBe('grenade_frag');
    for (let i = 0; i < 60 && (a.state as any).phase !== 'live'; i++) await sleep(50);
    a.send(ClientMessage.SwitchWeapon, { slot: 'grenade' });
    await sleep(150);
    expect(players(a).get(a.sessionId).weaponId).toBe('grenade_frag');
    let exploded = false;
    a.onMessage(ServerMessage.Explosion, () => (exploded = true));
    a.send(ClientMessage.Fire, { yaw: 0, pitch: 0.4 });
    await sleep(300);
    expect((a.state as any).projectiles.size).toBe(1);
    expect(players(a).get(a.sessionId).weaponId).toBe('pistol_basic');
    expect(players(a).get(a.sessionId).grenadeIds).toBe('');
    for (let i = 0; i < 80 && !exploded; i++) await sleep(50);
    expect(exploded).toBe(true);
    await sleep(200);
    expect((a.state as any).projectiles.size).toBe(0);
    await a.leave(); await b.leave();
  }, 20000);
});

describe('modo entrenamiento', () => {
  /**
   * El entrenamiento existe para probar armas. La tienda del modo bomba exige
   * fase de congelación y estar en la zona de compra, y el entrenamiento no
   * tiene ninguna de las dos: sin `shopAlwaysOpen` no se podía comprar nada.
   */
  it('arranca con un solo jugador y deja comprar en cualquier momento', async () => {
    const a = await join({ modeId: 'practice', nickname: 'Solo', private: true }, true);
    for (let i = 0; i < 40 && (a.state as any).phase === 'waiting'; i++) await sleep(50);
    expect((a.state as any).phase).not.toBe('waiting');
    await sleep(150);
    const me = () => players(a).get(a.sessionId);
    expect(me().alive).toBe(true);
    expect(me().money).toBe(GAME_MODES.practice.startingMoney);

    let errors = 0;
    a.onMessage(ServerMessage.Error, () => errors++);
    a.send(ClientMessage.Buy, { itemId: 'rifle_star' });
    await sleep(200);
    expect(errors).toBe(0);
    expect(me().primaryId).toBe('rifle_star');
    expect(me().weaponId).toBe('rifle_star');
    expect(me().ammoMag).toBe(WEAPONS.rifle_star.magazineSize);
    await a.leave();
  }, 20000);
});

describe('varios jugadores', () => {
  /**
   * Quien cierra la pestaña deja de contar de inmediato. Antes se le guardaba
   * un hueco durante el margen de reconexión y la ronda se quedaba colgada
   * esperando a un jugador que ya no estaba.
   */
  it('una desconexión no deja la ronda colgada', async () => {
    const timings = { warmup: 0.5, freeze: 0.5, roundTime: 60, postRound: 0.5 };
    const a = await join({ modeId: 'bomb', nickname: 'Alpha', private: true, timings }, true);
    await sleep(100);
    const b = await joinExisting(a.roomId, 'Bravo');
    for (let i = 0; i < 80 && (a.state as any).phase !== 'live'; i++) await sleep(50);
    expect((a.state as any).phase).toBe('live');

    const teamB = players(a).get(a.sessionId).team === 'B' ? a : b;
    const survivor = teamB === a ? b : a;
    let end: { winner: string; reason: string } | null = null;
    survivor.onMessage(ServerMessage.RoundEnd, (m: { winner: string; reason: string }) => (end = m));
    // Sin `consented`: es una caída, no un "salir de la partida".
    await teamB.connection.transport.close();
    for (let i = 0; i < 60 && !end; i++) await sleep(50);
    expect(end).not.toBeNull();
    expect(end!.winner).toBe('A');
    await survivor.leave();
  }, 20000);

  /** El jugador que entra a mitad de ronda no debe aparecer aún en el mundo. */
  it('quien entra a mitad de ronda no está "aparecido" hasta la siguiente', async () => {
    const timings = { warmup: 0.5, freeze: 0.5, roundTime: 60, postRound: 0.5 };
    const a = await join({ modeId: 'bomb', nickname: 'Alpha', private: true, timings }, true);
    await sleep(100);
    const b = await joinExisting(a.roomId, 'Bravo');
    for (let i = 0; i < 80 && (a.state as any).phase !== 'live'; i++) await sleep(50);
    expect((a.state as any).phase).toBe('live');

    const c = await joinExisting(a.roomId, 'Charlie');
    await sleep(250);
    const late = players(a).get(c.sessionId);
    expect(late.alive).toBe(false);
    expect(late.spawned).toBe(false);
    await a.leave(); await b.leave(); await c.leave();
  }, 20000);
});

describe('asistencias', () => {
  /** El campo `assists` existía en el estado y nunca se incrementaba. */
  it('quien hiere y no remata se lleva la asistencia', async () => {
    const a = await join({ modeId: 'ffa', nickname: 'Alpha', private: true }, true);
    await sleep(100);
    const b = await joinExisting(a.roomId, 'Bravo');
    const c = await joinExisting(a.roomId, 'Charlie');
    for (let i = 0; i < 60 && (a.state as any).phase !== 'warmup'; i++) await sleep(50);
    await sleep(300);

    // Charlie es la víctima; A la hiere y B remata, todos a bocajarro.
    const aim = (from: Room, to: Room) => {
      const p = players(a).get(to.sessionId), me = players(a).get(from.sessionId);
      const dx = p.x - me.x, dz = p.z - me.z;
      return {
        yaw: Math.atan2(-dx, -dz),
        pitch: Math.atan2((p.y + 0.6) - (me.y + GAMEPLAY.player.eyeHeight), Math.hypot(dx, dz)),
      };
    };
    const target = players(a).get(c.sessionId);
    a.send(ClientMessage.DebugTeleport, { x: target.x, y: target.y, z: target.z + 2.5 });
    b.send(ClientMessage.DebugTeleport, { x: target.x + 2.5, y: target.y, z: target.z });
    await sleep(300);

    // A dispara hasta dejar a Charlie tocado, pero sin matarlo.
    for (let i = 0; i < 20 && players(a).get(c.sessionId).health > 40; i++) {
      a.send(ClientMessage.Fire, aim(a, c));
      await sleep(180);
    }
    expect(players(a).get(c.sessionId).health).toBeLessThan(100);
    // B remata.
    for (let i = 0; i < 20 && players(a).get(c.sessionId).alive; i++) {
      b.send(ClientMessage.Fire, aim(b, c));
      await sleep(180);
    }
    await sleep(250);
    expect(players(a).get(b.sessionId).kills).toBeGreaterThan(0);
    expect(players(a).get(a.sessionId).assists).toBeGreaterThan(0);
    await a.leave(); await b.leave(); await c.leave();
  }, 30000);
});
