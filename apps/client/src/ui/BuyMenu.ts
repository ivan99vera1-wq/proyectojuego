import { EQUIPMENT, WEAPONS } from '@game/config';
import { el } from './dom.js';
import { shopDescription } from './Hud.js';

/** Menú de compra (fase de congelación). */
export class BuyMenu {
  readonly root = el('div', { class: 'overlay menu-panel' });
  private readonly grid = el('div', { class: 'buy-grid' });
  private readonly moneyEl = el('div', { class: 'money', text: '$0' });
  visible = false;

  constructor(private readonly onBuy: (id: string) => void, private readonly onClose: () => void) {
    this.moneyEl.style.position = 'static';
    const closeBtn = el('button', { class: 'secondary', text: 'Cerrar (B)' });
    closeBtn.addEventListener('click', () => this.onClose());
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
  hide(): void { this.visible = false; this.root.style.display = 'none'; }

  render(money: number, team: string): void {
    this.moneyEl.textContent = `$${money}`;
    this.grid.replaceChildren();
    const items: { id: string; name: string; price: number }[] = [];
    for (const w of Object.values(WEAPONS)) if (w.price > 0) items.push({ id: w.id, name: w.displayName, price: w.price });
    for (const e of Object.values(EQUIPMENT)) if (e.id !== 'defuse_kit' || team === 'A') items.push({ id: e.id, name: e.displayName, price: e.price });
    for (const it of items) {
      const can = it.price <= money;
      const card = el('div', { class: `buy-item${can ? '' : ' cant'}` }, [
        el('div', { class: 'name', text: it.name }), el('div', { class: 'price', text: `$${it.price}` }), el('div', { class: 'desc', text: shopDescription(it.id) }),
      ]);
      if (can) card.addEventListener('click', () => this.onBuy(it.id));
      this.grid.append(card);
    }
  }
}
