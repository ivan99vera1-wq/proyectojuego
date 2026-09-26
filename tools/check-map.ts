/**
 * Informe de un mapa: cuántas cajas tiene, cuánto suelo libre hay en cada sitio
 * de bomba y si alguna aparición está mal puesta.
 *
 *     npm run check:map
 *
 * Las comprobaciones que no pueden romperse viven en
 * `packages/shared/src/maps/maps.test.ts` y corren en CI. Esto es la versión
 * con números a la vista, para cuando se está construyendo un mapa.
 */
import { MAP_LAYOUTS, type MapLayout, type SpawnPoint } from '../packages/shared/src/maps/index.js';
import { initPhysics, PhysicsWorld } from '../packages/shared/src/physics/PhysicsWorld.js';
import { stepMovement, createKinematicState } from '../packages/shared/src/physics/movement.js';

/** Distancia mínima que hay que poder andar en un segundo desde una aparición. */
const MIN_WALK = 3.5;
const SPAWN_MARGIN = 0.1;

/** Anda un segundo hacia delante con las MISMAS condiciones que MatchRoom.spawnPlayer. */
function walkForward(world: PhysicsWorld, s: SpawnPoint): number {
  const state = createKinematicState(s.x, s.y + 0.05, s.z);
  state.grounded = true;
  world.addPlayer('probe', state);
  world.setPlayerPosition('probe', state);
  const input = {
    seq: 0, dt: 1 / 60, forward: 1, right: 0,
    jump: false, crouch: false, sprint: false, yaw: s.yaw, pitch: 0,
  };
  for (let i = 0; i < 60; i++) stepMovement(world, 'probe', state, input);
  world.removePlayer('probe');
  return Math.hypot(state.x - s.x, state.z - s.z);
}

/** Celdas de 1 m² pisables dentro de una zona. */
function freeCells(world: PhysicsWorld, zone: MapLayout['bombsites']['A']): { free: number; total: number } {
  let free = 0, total = 0;
  for (let x = zone.x - zone.sx / 2 + 1; x <= zone.x + zone.sx / 2 - 1; x++) {
    for (let z = zone.z - zone.sz / 2 + 1; z <= zone.z + zone.sz / 2 - 1; z++) {
      total++;
      if (world.isFree({ x, y: 0.05, z })) free++;
    }
  }
  return { free, total };
}

async function main(): Promise<void> {
  await initPhysics();
  let failures = 0;
  for (const [id, layout] of Object.entries(MAP_LAYOUTS)) {
    const world = new PhysicsWorld(layout);
    const solids = layout.boxes.filter((b) => b.solid !== false).length;
    console.log(`\n${id}: ${layout.boxes.length} cajas (${solids} sólidas), ${layout.props?.length ?? 0} adornos`);

    for (const [team, list] of Object.entries(layout.spawns)) {
      list.forEach((s, i) => {
        const where = `${team}[${i}] (${s.x}, ${s.z})`;
        // Prueba exacta con la cápsula del jugador: es la única que ve las cajas
        // rotadas (cajones, contenedores, rampas).
        if (!world.isFree({ x: s.x, y: s.y + 0.05, z: s.z }, SPAWN_MARGIN)) {
          failures++;
          console.log(`  ✗ aparición ${where} dentro de la geometría`);
          return;
        }
        const walked = walkForward(world, s);
        if (walked < MIN_WALK) {
          failures++;
          console.log(`  ✗ aparición ${where} solo avanza ${walked.toFixed(1)} m en 1 s`);
        }
      });
    }

    for (const letter of ['A', 'B'] as const) {
      const { free, total } = freeCells(world, layout.bombsites[letter]);
      const pct = Math.round((free / total) * 100);
      console.log(`  sitio ${letter}: ${free}/${total} m² pisables (${pct} %)`);
      if (free < 40 || pct < 25) { failures++; console.log(`  ✗ sitio ${letter} demasiado obstruido`); }
    }
    world.free();
  }
  console.log(failures === 0 ? '\nOK' : `\n${failures} problemas`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
