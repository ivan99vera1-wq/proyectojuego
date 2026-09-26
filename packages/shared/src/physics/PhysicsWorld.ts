import RAPIER from '@dimforge/rapier3d-compat';
import { GAMEPLAY } from '@game/config';
import type { MapLayout } from '../maps/types.js';
import type { Vec3 } from '../math/vec3.js';
import { degToRad } from '../math/scalar.js';

/**
 * Grupos de colisión: (membership << 16) | filter.
 * Son internos: nadie fuera de este módulo crea colisionadores.
 */
const MAP_MEMBERSHIP = 0x0001;
const PLAYER_MEMBERSHIP = 0x0002;
const GROUP_MAP = (MAP_MEMBERSHIP << 16) | 0xffff;
const GROUP_PLAYER = (PLAYER_MEMBERSHIP << 16) | MAP_MEMBERSHIP; // los jugadores solo chocan con el mapa
const GROUP_RAY_MAP = (0xffff << 16) | MAP_MEMBERSHIP;

/** Inclinación máxima que el jugador puede subir andando. */
const MAX_SLOPE_DEGREES = 50;
const IDENTITY_ROTATION: RAPIER.Rotation = { x: 0, y: 0, z: 0, w: 1 };

let ready: Promise<void> | null = null;
/** Inicializa el WASM de Rapier (una vez). Llamar antes de crear un PhysicsWorld. */
export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}

export interface PlayerBody {
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
}

export interface MapRayHit {
  distance: number;
  point: Vec3;
  normal: Vec3;
}

function eulerToQuat(rx: number, ry: number, rz: number): RAPIER.Rotation {
  const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2);
  const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2);
  const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
  // orden XYZ
  return {
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  };
}

/**
 * Mundo físico compartido. Construye colisionadores fijos desde un MapLayout y
 * cápsulas cinemáticas para jugadores. Idéntico en cliente y servidor.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private readonly players = new Map<string, PlayerBody>();

  constructor(readonly layout: MapLayout) {
    this.world = new RAPIER.World({ x: 0, y: GAMEPLAY.gravity, z: 0 });
    for (const b of layout.boxes) {
      if (b.solid === false) continue;
      const desc = RAPIER.ColliderDesc.cuboid(b.sx / 2, b.sy / 2, b.sz / 2)
        .setTranslation(b.x, b.y, b.z)
        .setRotation(eulerToQuat(b.rx ?? 0, b.ry ?? 0, b.rz ?? 0))
        .setCollisionGroups(GROUP_MAP);
      this.world.createCollider(desc);
    }
    this.world.updateSceneQueries();
  }

  addPlayer(id: string, pos: Vec3): PlayerBody {
    this.removePlayer(id);
    const { capsuleHeight, capsuleRadius } = GAMEPLAY.player;
    const halfHeight = Math.max(0.01, capsuleHeight / 2 - capsuleRadius);
    const desc = RAPIER.ColliderDesc.capsule(halfHeight, capsuleRadius)
      .setTranslation(pos.x, pos.y + capsuleHeight / 2, pos.z)
      .setCollisionGroups(GROUP_PLAYER);
    const collider = this.world.createCollider(desc);
    const controller = this.world.createCharacterController(0.02);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.enableAutostep(0.45, 0.2, false);
    controller.enableSnapToGround(0.3);
    controller.setMaxSlopeClimbAngle(degToRad(MAX_SLOPE_DEGREES));
    controller.setSlideEnabled(true);
    const body = { collider, controller };
    this.players.set(id, body);
    return body;
  }

  removePlayer(id: string): void {
    const b = this.players.get(id);
    if (!b) return;
    this.world.removeCharacterController(b.controller);
    this.world.removeCollider(b.collider, false);
    this.players.delete(id);
  }

  /** Teletransporta (respawn). `pos` es la posición de los PIES. */
  setPlayerPosition(id: string, pos: Vec3): void {
    const b = this.players.get(id);
    if (!b) return;
    b.collider.setTranslation({ x: pos.x, y: pos.y + GAMEPLAY.player.capsuleHeight / 2, z: pos.z });
  }

  /**
   * Mueve la cápsula con el character controller. `desired` es el desplazamiento
   * deseado en este paso; devuelve el desplazamiento real y si está en el suelo.
   * `feet` de entrada/salida es la posición de los pies.
   */
  movePlayer(id: string, feet: Vec3, desired: Vec3): { moved: Vec3; grounded: boolean } {
    const b = this.players.get(id);
    if (!b) return { moved: { x: 0, y: 0, z: 0 }, grounded: false };
    const half = GAMEPLAY.player.capsuleHeight / 2;
    b.collider.setTranslation({ x: feet.x, y: feet.y + half, z: feet.z });
    b.controller.computeColliderMovement(b.collider, desired, undefined, GROUP_PLAYER);
    const m = b.controller.computedMovement();
    const grounded = b.controller.computedGrounded();
    b.collider.setTranslation({ x: feet.x + m.x, y: feet.y + half + m.y, z: feet.z + m.z });
    return { moved: { x: m.x, y: m.y, z: m.z }, grounded };
  }

  /**
   * ¿Cabe un jugador de pie en este punto (posición de los PIES) sin quedar
   * metido dentro del mapa?
   *
   * Usa la misma cápsula y los mismos colisionadores que la partida, así que no
   * hay forma de que la comprobación y el juego discrepen. Es la prueba que
   * valida los puntos de aparición: un aproximado hecho a mano se dejaba fuera
   * las cajas rotadas (cajones, contenedores, rampas) y colocaba jugadores
   * dentro de una pila de cajas.
   */
  isFree(feet: Vec3, margin = 0): boolean {
    const { capsuleHeight, capsuleRadius } = GAMEPLAY.player;
    const halfHeight = Math.max(0.01, capsuleHeight / 2 - capsuleRadius);
    const shape = new RAPIER.Capsule(halfHeight, capsuleRadius + margin);
    // La cápsula se levanta lo mismo que se ha ensanchado, de forma que su base
    // sigue apoyada justo en `feet.y`: si no, el margen la metía en el suelo y
    // no había punto libre en todo el mapa.
    const hit = this.world.intersectionWithShape(
      { x: feet.x, y: feet.y + capsuleHeight / 2 + margin, z: feet.z },
      IDENTITY_ROTATION,
      shape,
      undefined,
      GROUP_RAY_MAP,
    );
    return hit === null;
  }

  /** Raycast solo contra el mapa. */
  raycastMap(origin: Vec3, dir: Vec3, maxDistance: number): MapRayHit | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true, undefined, GROUP_RAY_MAP);
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return { distance: hit.timeOfImpact, point: { x: p.x, y: p.y, z: p.z }, normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z } };
  }

  free(): void {
    this.world.free();
    this.players.clear();
  }
}
