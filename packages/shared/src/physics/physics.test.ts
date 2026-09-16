import { describe, it, expect, beforeAll } from 'vitest';
import { initPhysics, PhysicsWorld } from './PhysicsWorld.js';
import { stepMovement, createKinematicState } from './movement.js';
import { hitscan } from './hitscan.js';
import { PLAYGROUND } from '../maps/playground.js';
import type { InputPayload } from '../protocol/messages.js';

const input = (over: Partial<InputPayload> = {}): InputPayload =>
  ({ seq: 0, dt: 1 / 60, forward: 0, right: 0, jump: false, crouch: false, sprint: false, yaw: 0, pitch: 0, ...over });

describe('physics', () => {
  let world: PhysicsWorld;
  beforeAll(async () => {
    await initPhysics();
    world = new PhysicsWorld(PLAYGROUND);
  });

  it('player falls onto the floor and stays grounded', () => {
    world.addPlayer('p', { x: 0, y: 3, z: 10 });
    const s = createKinematicState(0, 3, 10);
    for (let i = 0; i < 120; i++) stepMovement(world, 'p', s, input());
    expect(s.grounded).toBe(true);
    expect(s.y).toBeGreaterThan(-0.05);
    expect(s.y).toBeLessThan(0.1);
  });

  it('walking forward moves along -Z at walk speed', () => {
    const s = createKinematicState(-10, 0, 10);
    world.addPlayer('w', s);
    for (let i = 0; i < 30; i++) stepMovement(world, 'w', s, input());
    for (let i = 0; i < 60; i++) stepMovement(world, 'w', s, input({ forward: 1 }));
    // 1 segundo a walkSpeed (5 m/s) → ~5 m (arranque desde caída inicial)
    expect(10 - s.z).toBeGreaterThan(4);
    expect(10 - s.z).toBeLessThan(5.5);
  });

  it('walls block movement', () => {
    const s = createKinematicState(0, 0, 28);
    world.addPlayer('b', s);
    for (let i = 0; i < 120; i++) stepMovement(world, 'b', s, input({ forward: -1 })); // hacia +Z (muro en z=30)
    expect(s.z).toBeLessThan(30);
  });

  it('jump leaves the ground and comes back', () => {
    const s = createKinematicState(5, 0, 10);
    world.addPlayer('j', s);
    for (let i = 0; i < 30; i++) stepMovement(world, 'j', s, input());
    stepMovement(world, 'j', s, input({ jump: true }));
    let maxY = 0;
    for (let i = 0; i < 120; i++) { stepMovement(world, 'j', s, input()); maxY = Math.max(maxY, s.y); }
    expect(maxY).toBeGreaterThan(0.8);
    expect(s.grounded).toBe(true);
  });

  it('map raycast hits a wall', () => {
    const hit = world.raycastMap({ x: 0, y: 1, z: 25 }, { x: 0, y: 0, z: 1 }, 50);
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(5, 0);
  });

  it('hitscan distinguishes head and body', () => {
    const targets = [{ id: 't', x: 0, y: 0, z: -5, crouching: false }];
    const body = hitscan({ x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: -1 }, targets, 50);
    const head = hitscan({ x: 0, y: 1.0, z: 0 }, { x: 0, y: 0, z: -1 }, targets, 50);
    const miss = hitscan({ x: 2, y: 1.0, z: 0 }, { x: 0, y: 0, z: -1 }, targets, 50);
    expect(body?.zone).toBe('body');
    expect(head?.zone).toBe('head');
    expect(miss).toBeNull();
  });
});
