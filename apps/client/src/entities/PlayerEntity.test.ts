import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerEntity, type PlayerPose } from './PlayerEntity.js';

/**
 * Comportamiento del chibi que sí se puede comprobar sin el modelo cargado.
 *
 * OJO con lo que NO está aquí: la inclinación del arma dentro del puño
 * (`GRIP_PITCH`). Sin el GLB, `buildChibi` cae a un esqueleto de respaldo con
 * los huesos en identidad, así que el ángulo correcto en este entorno es otro
 * que el correcto en el juego: un test aquí fijaría un número equivocado.
 *
 * Ese valor se mide con el juego en marcha, comparando la dirección del cañón
 * con el frente del personaje:
 *
 *   const a = window.__game.engine.scene.selfEntity.weapon;
 *   new THREE.Vector3(0, 0, -1).transformDirection(a.matrixWorld)
 *   // tiene que dar ≈ el frente del personaje, con componente Y ≈ 0
 *
 * Medido así vale -1.82 (alineación 0,976).
 */

const POSE: PlayerPose = {
  x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0,
  grounded: true, crouching: false, alive: true, reloading: false,
  weaponId: 'stg_44', hasBomb: false, team: 'A',
};

/** Deja al personaje asentado en su pose: las articulaciones van amortiguadas. */
const asentar = (e: PlayerEntity, pose: Partial<PlayerPose> = {}) => {
  for (let i = 0; i < 240; i++) e.update(1 / 60, { ...POSE, ...pose });
  e.root.updateMatrixWorld(true);
};

/** Dirección del cañón en el mundo: el arma nace con la boca hacia -Z. */
function direccionCanon(e: PlayerEntity): THREE.Vector3 {
  const arma = e.heldWeapon;
  if (!arma) throw new Error('el personaje no tiene arma');
  return new THREE.Vector3(0, 0, -1).transformDirection(arma.matrixWorld).normalize();
}

/** Frente del personaje en el mundo. */
function frente(e: PlayerEntity): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).transformDirection(e.root.matrixWorld).normalize();
}

describe('PlayerEntity', () => {
  it('el arma acompaña al personaje cuando gira', () => {
    // Independiente del esqueleto: gire lo que gire el chibi, el arma tiene
    // que girar con él y mantener SU relación con el frente, no quedarse
    // clavada mirando a un punto del mapa.
    const e = new PlayerEntity('', 'A');
    asentar(e);
    const relacionInicial = direccionCanon(e).dot(frente(e));
    asentar(e, { yaw: Math.PI / 2 });
    expect(direccionCanon(e).dot(frente(e))).toBeCloseTo(relacionInicial, 3);
    e.dispose();
  });

  it('sin arma no deja nada colgando de la mano', () => {
    const e = new PlayerEntity('', 'A');
    asentar(e, { weaponId: '' });
    expect(e.heldWeapon).toBeNull();
    e.dispose();
  });

  it('un muerto suelta la pose de apuntar', () => {
    const e = new PlayerEntity('', 'A');
    asentar(e);
    asentar(e, { alive: false });
    // Al morir se desarma: no tiene sentido seguir apuntando.
    expect(e.heldWeapon).toBeNull();
    e.dispose();
  });

  it('la inspección dura lo que dice y se corta al disparar', () => {
    const e = new PlayerEntity('', 'A');
    asentar(e);
    e.playInspect();
    expect(e.inspecting).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) e.update(1 / 60, POSE);
    expect(e.inspecting).toBeGreaterThan(0);
    e.playFire();
    e.update(1 / 60, POSE);
    expect(e.inspecting, 'disparar corta el gesto').toBe(0);
    e.dispose();
  });
});
