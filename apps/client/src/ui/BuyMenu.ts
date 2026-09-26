import { EQUIPMENT, WEAPONS } from '@game/config';
import { audio } from '../audio/SynthAudio.js';
import { button, el } from './dom.js';
import { shopDescription } from './Hud.js';

interface ShopItem { id: string; name: string; price: number; }

/** Menú de compra. */
export class BuyMenu {
  readonly root = el('div', { class: 'overlay menu-panel' });
  private readonly grid = el('div', { class: 'buy-grid' });
  private readonly moneyEl = el('div', { class: 'money', text: '$0' });
  /** Tarjeta de cada artículo, por id. Se crean una vez, no en cada fotograma. */
  private readonly cards = new Map<string, HTMLElement>();
  /** Con qué lista se construyó la rejilla, para saber si hay que rehacerla. */
  private builtFor = '';
  private lastMoney = -1;
  visible = false;

  constructor(private readonly onBuy: (id: string) => void, private readonly onClose: () => void) {
    this.moneyEl.style.position = 'static';
    const closeBtn = button('Cerrar (B)', () => this.onClose(), 'secondary');
    const panel = el('div', { class: 'panel center-col' }, [
      el('div', { class: 'row between' }, [el('div', { text: 'Tienda', class: 'title' }), this.moneyEl]),
      this.grid,
      el('div', { class: 'row' }, [closeBtn]),
    ]);
    (panel.querySelector('.title') as HTMLElement).style.fontSize = '28px';
    panel.style.width = '640px';
    this.root.append(panel);
    this.root.style.display = 'none';
  }

  show(money: number, team: string): void {
    this.visible = true;
    this.root.style.display = 'flex';
    this.render(money, team);
  }

  hide(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }

  /** Artículos a la venta para este equipo. */
  private items(team: string): ShopItem[] {
    const out: ShopItem[] = [];
    for (const w of Object.values(WEAPONS)) if (w.price > 0) out.push({ id: w.id, name: w.displayName, price: w.price });
    for (const e of Object.values(EQUIPMENT)) {
      // El kit de desactivación solo lo usa quien defiende.
      if (e.id === 'defuse_kit' && team === 'B') continue;
      out.push({ id: e.id, name: e.displayName, price: e.price });
    }
    return out;
  }

  private buildGrid(items: ShopItem[]): void {
    this.grid.replaceChildren();
    this.cards.clear();
    for (const it of items) {
      const card = el('div', { class: 'buy-item' }, [
        el('div', { class: 'name', text: it.name }),
        el('div', { class: 'price', text: `$${it.price}` }),
        el('div', { class: 'desc', text: shopDescription(it.id) }),
      ]);
      // El listener se pone UNA vez y siempre compra: quien decide si el
      // jugador puede pagarlo es el servidor, que ya responde con un motivo.
      // Una tarjeta sin listener no da ninguna señal al pulsarla.
      card.addEventListener('click', () => { audio.uiClick(); this.onBuy(it.id); });
      card.addEventListener('pointerenter', () => audio.uiHover());
      this.grid.append(card);
      this.cards.set(it.id, card);
    }
  }

  /**
   * Refresca la tienda. La llama la escena en cada fotograma, así que NO puede
   * rehacer el DOM: si las tarjetas se sustituyen entre el `mousedown` y el
   * `mouseup`, el navegador nunca llega a emitir el `click` y la tienda parece
   * rota aunque todo lo demás funcione.
   */
  render(money: number, team: string): void {
    const items = this.items(team);
    const signature = items.map((i) => i.id).join(',');
    if (signature !== this.builtFor) {
      this.buildGrid(items);
      this.builtFor = signature;
      this.lastMoney = -1;
    }
    if (money === this.lastMoney) return;
    this.lastMoney = money;
    this.moneyEl.textContent = `$${money}`;
    for (const it of items) {
      this.cards.get(it.id)?.classList.toggle('cant', it.price > money);
    }
  }
}
