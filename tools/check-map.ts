/**
 * Comprobación rápida de un layout: que ningún punto de aparición quede dentro
 * de una caja sólida y que los sitios de bomba tengan suelo libre para plantar.
 *
 *     npx tsx tools/check-map.ts
 */
import { MAP_LAYOUTS, type MapLayout } from '../packages/shared/src/maps/index.js';
import { initPhysics, PhysicsWorld } from '../packages/shared/src/physics/PhysicsWorld.js';
import { stepMovement, createKinematicState } from '../packages/shared/src/physics/movement.js';

const R = 0.35;   // radio de la cápsula del jugador
const H = 1.2;    // altura de la cápsula

function blockers(layout: MapLayout, x: number, z: number) {
  return layout.boxes.filter((b) => b.solid !== false && !b.rx && !b.ry && !b.rz
    && Math.abs(x - b.x) < b.sx / 2 + R && Math.abs(z - b.z) < b.sz / 2 + R
    && b.y + b.sy / 2 > 0.25 && b.y - b.sy / 2 < H);
}

/** Anda un segundo hacia delante desde un punto y devuelve cuánto avanzó. */
function walkForward(layout: MapLayout, x: number, z: number, yaw: number): number {
  const world = new PhysicsWorld(layout);
  const state = createKinematicState(x, 0, z);
  world.addPlayer('probe', state);
  const input = {
    seq: 0, dt: 1 / 60, forward: 0, right: 0,
    jump: false, crouch: false, sprint: false, yaw, pitch: 0,
  };
  for (let i = 0; i < 40; i++) stepMovement(world, 'probe', state, input);   // caída
  for (let i = 0; i < 60; i++) stepMovement(world, 'probe', state, { ...input, forward: 1 });
  return Math.hypot(state.x - x, state.z - z);
}

async function main(): Promise<void> {
  await initPhysics();
  let failures = 0;
  for (const [id, layout] of Object.entries(MAP_LAYOUTS)) {
    const solids = layout.boxes.filter((b) => b.solid !== false).length;
    console.log(`\n${id}: ${layout.boxes.length} cajas (${solids} sólidas), ${layout.props?.length ?? 0} adornos`);
    for (const [team, list] of Object.entries(layout.spawns)) {
      for (const s of list) {
        const hit = blockers(layout, s.x, s.z)[0];
        if (hit) { failures++; console.log(`  ✗ aparición ${team} en (${s.x}, ${s.z}) dentro de una caja`, hit); }
        // El jugador tiene que poder andar hacia delante nada más aparecer.
        // Se simula con la MISMA física del juego, no con una aproximación: es
        // lo único que garantiza que la prueba y la partida coinciden.
        const walked = walkForward(layout, s.x, s.z, s.yaw);
        if (walked < 3.5) {
          failures++;
          console.log(`  ✗ aparición ${team} en (${s.x}, ${s.z}) solo avanza ${walked.toFixed(1)} m en 1 s`);
        }
      }
    }
    for (const [letter, zone] of Object.entries(layout.bombsites)) {
      let free = 0; let total = 0;
      for (let x = zone.x - zone.sx / 2 + 1; x <= zone.x + zone.sx / 2 - 1; x++) {
        for (let z = zone.z - zone.sz / 2 + 1; z <= zone.z + zone.sz / 2 - 1; z++) {
          total++;
          if (blockers(layout, x, z).length === 0) free++;
        }
      }
      const pct = Math.round((free / total) * 100);
      console.log(`  sitio ${letter}: ${free}/${total} celdas libres (${pct} %)`);
      if (pct < 40) { failures++; console.log(`  ✗ sitio ${letter} demasiado obstruido`); }
    }
  }
  console.log(failures === 0 ? '\nOK' : `\n${failures} problemas`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
