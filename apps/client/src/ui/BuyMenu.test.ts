import { describe, it, expect, afterEach, vi } from 'vitest';
import { WEAPONS } from '@game/config';
import { BuyMenu } from './BuyMenu.js';

/**
 * La escena llama a `render()` en CADA fotograma mientras la tienda está
 * abierta. Si eso rehace las tarjetas, el navegador nunca emite un `click`
 * (necesita que `mousedown` y `mouseup` caigan en el mismo elemento) y la
 * tienda parece rota sin dar ningún error: exactamente el fallo que hubo.
 *
 * Estos tests imitan un clic de verdad (pulsar, unos fotogramas, soltar) en vez
 * de llamar a `element.click()`, que se salta justo la parte que fallaba.
 */

/** Monta la tienda en el documento: fuera de él no hay `click` que valga. */
const mount = (onBuy: (id: string) => void = () => undefined): BuyMenu => {
  const menu = new BuyMenu(onBuy, () => undefined);
  document.body.append(menu.root);
  return menu;
};

afterEach(() => { document.body.replaceChildren(); });

const card = (menu: BuyMenu, name: string): HTMLElement => {
  const found = Array.from(menu.root.querySelectorAll('.buy-item'))
    .find((c) => c.textContent?.includes(name));
  if (!found) throw new Error(`no hay tarjeta para ${name}`);
  return found as HTMLElement;
};

/** Pulsar, dejar correr unos fotogramas de la escena y soltar. */
const humanClick = (el: HTMLElement, frames: () => void): void => {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  frames();
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  // El navegador solo emite `click` si el elemento sigue siendo el mismo.
  if (el.isConnected) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

describe('BuyMenu', () => {
  it('mantiene las mismas tarjetas aunque se redibuje cada fotograma', () => {
    const menu = mount();
    menu.show(16000, 'A');
    const antes = card(menu, WEAPONS.stg_44.displayName);
    for (let i = 0; i < 120; i++) menu.render(16000, 'A');
    expect(card(menu, WEAPONS.stg_44.displayName)).toBe(antes);
    expect(antes.isConnected).toBe(true);
  });

  it('un clic humano compra, con la escena redibujando entre pulsar y soltar', () => {
    const onBuy = vi.fn();
    const menu = mount(onBuy);
    menu.show(16000, 'A');
    const rifle = card(menu, WEAPONS.stg_44.displayName);
    humanClick(rifle, () => { for (let i = 0; i < 10; i++) menu.render(16000, 'A'); });
    expect(onBuy).toHaveBeenCalledWith(WEAPONS.stg_44.id);
  });

  it('lo que no se puede pagar se marca, pero sigue respondiendo al clic', () => {
    const onBuy = vi.fn();
    const menu = mount(onBuy);
    menu.show(100, 'A');
    const caro = card(menu, WEAPONS.m1_garand.displayName);
    expect(caro.classList.contains('cant')).toBe(true);
    // Una tarjeta muda no le dice al jugador por qué no pasa nada: el clic
    // viaja al servidor, que responde con el motivo y el HUD lo enseña.
    humanClick(caro, () => menu.render(100, 'A'));
    expect(onBuy).toHaveBeenCalledWith(WEAPONS.m1_garand.id);
  });

  it('marca y desmarca según el dinero sin rehacer las tarjetas', () => {
    const menu = mount();
    menu.show(100, 'A');
    const caro = card(menu, WEAPONS.m1_garand.displayName);
    expect(caro.classList.contains('cant')).toBe(true);
    menu.render(16000, 'A');
    expect(caro.classList.contains('cant')).toBe(false);
    expect(card(menu, WEAPONS.m1_garand.displayName)).toBe(caro);
  });

  it('el kit de desactivación no se ofrece al equipo que ataca', () => {
    const menu = mount();
    menu.show(16000, 'B');
    const kits = Array.from(menu.root.querySelectorAll('.buy-item'))
      .filter((c) => c.textContent?.includes('Kit de desactivación'));
    expect(kits).toHaveLength(0);
    // Y al cambiar de bando reaparece.
    menu.render(16000, 'A');
    expect(card(menu, 'Kit de desactivación')).toBeTruthy();
  });
});
