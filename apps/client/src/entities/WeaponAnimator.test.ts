// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { WEAPONS } from '@game/config';
import { WeaponAnimator } from './WeaponAnimator.js';

/**
 * Los gestos del arma son lo que separa un shooter que se siente vivo de uno
 * que mueve una foto. Lo que se comprueba aquí es la máquina de estados, no
 * cómo de bonita es la curva: que un gesto corte al otro en el orden correcto y
 * que nadie deje el arma fuera de sitio.
 */

/** Avanza el animador `segundos` en pasos de 1/60, como el bucle del juego. */
const correr = (a: WeaponAnimator, segundos: number) => {
  for (let i = 0; i < Math.round(segundos * 60); i++) a.update(1 / 60);
};

const conArma = (id: string): WeaponAnimator => {
  const a = new WeaponAnimator();
  a.setWeapon(id);
  return a;
};

describe('WeaponAnimator', () => {
  it('cambiar de arma la saca, y hasta que no termina sigue ocupada', () => {
    const a = conArma('stg_44');
    a.draw();
    expect(a.drawing).toBe(true);
    correr(a, WEAPONS.stg_44.drawTime - 0.05);
    expect(a.drawing).toBe(true);
    correr(a, 0.2);
    expect(a.drawing).toBe(false);
    expect(a.busy).toBe(false);
  });

  it('disparar corta cualquier gesto', () => {
    const a = conArma('stg_44');
    a.inspect();
    expect(a.busy).toBe(true);
    a.fire();
    expect(a.busy).toBe(false);
  });

  it('inspeccionar no interrumpe una recarga', () => {
    const a = conArma('stg_44');
    a.reload();
    a.inspect();
    // La recarga manda: es acción de juego, la inspección es un adorno.
    correr(a, WEAPONS.stg_44.reloadTime * 0.3);
    expect(a.busy).toBe(true);
    expect(a.pose.magY, 'sigue siendo el gesto de recarga, no el de inspección').toBeLessThan(0);
  });

  it('la recarga con cargador lo suelta y lo devuelve', () => {
    const a = conArma('stg_44');
    a.reload();
    const total = WEAPONS.stg_44.reloadTime;
    correr(a, total * 0.3);
    expect(a.pose.magY, 'a un tercio el cargador ya va saliendo').toBeLessThan(-0.05);
    correr(a, total * 0.2);
    expect(a.pose.magVisible, 'a mitad de gesto no hay cargador puesto').toBe(false);
    correr(a, total);
    expect(a.pose.magY).toBeCloseTo(0, 5);
    expect(a.pose.magVisible).toBe(true);
  });

  it('las armas de peine no mueven ningún cargador', () => {
    const a = conArma('m1_garand');
    a.reload();
    let maximo = 0;
    for (let i = 0; i < 60 * 3; i++) {
      const p = a.update(1 / 60);
      maximo = Math.max(maximo, Math.abs(p.magY));
      expect(p.magVisible).toBe(true);
    }
    expect(maximo).toBe(0);
  });

  it('las armas que no se recargan ignoran el gesto', () => {
    for (const id of ['ka_bar', 'grenade_mk2'] as const) {
      const a = conArma(id);
      a.reload();
      expect(a.busy, id).toBe(false);
    }
  });

  it('el cuchillo tiene su propia inspección, con vuelta entera', () => {
    const cuchillo = conArma('ka_bar');
    cuchillo.inspect();
    let giroMax = 0;
    for (let i = 0; i < 60 * 2; i++) giroMax = Math.max(giroMax, Math.abs(cuchillo.update(1 / 60).roll));
    expect(giroMax, 'da al menos una vuelta').toBeGreaterThan(Math.PI * 1.8);
  });

  it('ningún gesto deja el arma lejos de su sitio', () => {
    for (const id of Object.keys(WEAPONS)) {
      const a = conArma(id);
      for (const gesto of ['draw', 'reload', 'inspect'] as const) {
        a.cancel();
        a[gesto]();
        for (let i = 0; i < 60 * 4; i++) {
          const p = a.update(1 / 60);
          const lejos = Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
          expect(lejos, `${id}/${gesto} desplaza ${lejos.toFixed(2)} m`).toBeLessThan(0.5);
        }
      }
    }
  });

  it('al terminar todo vuelve exactamente a la pose de reposo', () => {
    const a = conArma('ppsh_41');
    a.reload();
    correr(a, WEAPONS.ppsh_41.reloadTime + 1);
    const p = a.pose;
    for (const v of [p.x, p.y, p.z, p.pitch, p.yaw, p.roll, p.magY]) expect(v).toBeCloseTo(0, 6);
    expect(p.magVisible).toBe(true);
  });
});
