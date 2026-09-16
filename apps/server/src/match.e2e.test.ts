import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Room } from 'colyseus.js';
import { NETWORK, GAMEPLAY } from '@game/config';
import { ClientMessage, ServerMessage, type InputPayload } from '@game/shared';
import { createGameServer, type GameServer } from './server.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let server: GameServer;
let url: string;

const join = (opts: Record<string, unknown> = {}, create = false) => {
  const c = new Client(url);
  const options = { nickname: 'Tester', protocolVersion: NETWORK.protocolVersion, ...opts };
  return create ? c.create(NETWORK.rooms.match, options) : c.joinOrCreate(NETWORK.rooms.match, options);
};

const input = (seq: number, over: Partial<InputPayload> = {}): InputPayload =>
  ({ seq, dt: 1 / 60, forward: 0, right: 0, jump: false, crouch: false, sprint: false, yaw: 0, pitch: 0, ...over });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const b = await new Client(url).joinById(a.roomId, { nickname: 'Bravo', protocolVersion: NETWORK.protocolVersion });
    await sleep(200);
    expect(players(a).size).toBe(2);
    // con 2 jugadores arranca warmup y ambos aparecen
    await sleep(300);
    const pa = players(a).get(a.sessionId);
    expect((a.state as any).phase).toBe('warmup');
    expect(pa.alive).toBe(true);

    // movimiento: 60 inputs hacia adelante
    const startZ = pa.z;
    const yaw = pa.yaw;
    for (let i = 1; i <= 60; i++) { a.send(ClientMessage.Input, input(i, { forward: 1, yaw })); await sleep(16); }
    await sleep(200);
    const moved = Math.hypot(players(a).get(a.sessionId).x - pa.x, players(a).get(a.sessionId).z - startZ);
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
    const b = await new Client(url).joinById(a.roomId, { nickname: 'Bravo', protocolVersion: NETWORK.protocolVersion });
    await sleep(300);
    expect((a.state as any).phase).toBe('warmup');
    const teams = new Set([players(a).get(a.sessionId).team, players(a).get(b.sessionId).team]);
    expect(teams).toEqual(new Set(['A', 'B']));
    await a.leave(); await b.leave();
  }, 10000);
});
