import {
  BODY_SLIDERS, COLOR_CHANNELS, COSMETICS, RARITY_COLORS, REQUIRED_SLOTS,
  type BodySlider, type ColorChannel, type CosmeticId, type CosmeticSlot,
} from '@game/config';
import type { AvatarConfig } from '@game/shared';
import { el } from './dom.js';
import { audio } from '../audio/SynthAudio.js';

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  eyes: 'Ojos', brows: 'Cejas', mouth: 'Boca',
  hair: 'Pelo', headwear: 'Gorros', eyewear: 'Gafas', headAccessory: 'Auriculares',
  top: 'Camiseta', outer: 'Chaleco', bottom: 'Pantalón', shoes: 'Zapatos', hands: 'Guantes',
  back: 'Mochila', weaponSkin: 'Skin de arma',
};

/** Pestañas agrupadas por zona, como una ficha de personaje. */
const GROUPS: { name: string; slots: CosmeticSlot[] }[] = [
  { name: 'Cara', slots: ['eyes', 'brows', 'mouth'] },
  { name: 'Cabeza', slots: ['hair', 'headwear', 'eyewear', 'headAccessory'] },
  { name: 'Ropa', slots: ['top', 'outer', 'bottom', 'shoes', 'hands'] },
  { name: 'Extras', slots: ['back', 'weaponSkin'] },
];

/**
 * Panel del vestidor: un solo personaje base, pestañas por zona y slot,
 * colores y proporciones. Modifica una copia del avatar y avisa en cada
 * cambio para que la vista previa se actualice en vivo.
 */
export class CustomizationPanel {
  readonly root = el('div', { class: 'custom-layout' });
  private slot: CosmeticSlot = 'hair';
  private group = 1;
  private readonly itemsGrid = el('div', { class: 'grid' });
  private readonly groupTabs = el('div', { class: 'tabs' });
  private readonly slotTabs = el('div', { class: 'tabs' });

  constructor(
    private avatar: AvatarConfig,
    private readonly onChange: (a: AvatarConfig) => void,
    onSave: () => void,
    onBack: () => void,
    onEmote: (k: number) => void,
  ) {
    const save = el('button', { text: 'Guardar' });
    save.addEventListener('click', onSave);
    const back = el('button', { class: 'secondary', text: 'Volver' });
    back.addEventListener('click', onBack);
    const dance = el('button', { class: 'secondary', text: '💃 Bailar' });
    dance.addEventListener('click', () => onEmote(0));
    const wave = el('button', { class: 'secondary', text: '👋 Saludar' });
    wave.addEventListener('click', () => onEmote(1));
    const randomize = el('button', { class: 'accent', text: '🎲 Aleatorio' });
    randomize.addEventListener('click', () => this.randomize());

    this.renderGroups();
    this.renderSlots();

    // Colores
    const colors = el('div', { class: 'center-col' });
    for (const ch of Object.keys(COLOR_CHANNELS) as ColorChannel[]) {
      const def = COLOR_CHANNELS[ch];
      const picker = el('input', { type: 'color', value: this.avatar.colors[ch] });
      const sw = el('div', { class: 'swatches' });
      const renderSw = () => {
        sw.replaceChildren();
        for (const preset of def.presets) {
          const d = el('div', { class: `swatch${this.avatar.colors[ch] === preset ? ' selected' : ''}` });
          d.style.background = preset;
          d.addEventListener('click', () => { this.avatar.colors[ch] = preset; picker.value = preset; this.emit(); renderSw(); });
          sw.append(d);
        }
      };
      picker.addEventListener('input', () => { this.avatar.colors[ch] = picker.value; this.emit(); renderSw(); });
      renderSw();
      colors.append(el('div', { class: 'field' }, [el('label', { text: def.label }), el('div', { class: 'row' }, [picker, sw])]));
    }

    // Proporciones (no cambian la altura total: la silueta siempre cabe en la hitbox)
    const sliders = el('div', { class: 'center-col' });
    for (const key of Object.keys(BODY_SLIDERS) as BodySlider[]) {
      const def = BODY_SLIDERS[key];
      const input = el('input', { type: 'range' });
      input.min = String(def.min); input.max = String(def.max); input.step = '0.01';
      input.value = String(this.avatar.sliders[key]);
      input.addEventListener('input', () => { this.avatar.sliders[key] = Number(input.value); this.emit(); });
      sliders.append(el('div', { class: 'field' }, [el('label', { text: def.label }), input]));
    }

    this.root.append(
      el('div', { class: 'panel center-col' }, [
        el('div', { class: 'row between' }, [el('div', { class: 'title', text: 'Personalizar' }), el('div', { class: 'row' }, [back, save])]),
        el('div', { class: 'muted', text: 'Arrastra para girar · rueda para acercar' }),
        el('div', { class: 'row' }, [dance, wave, randomize]),
      ]),
      el('div', { class: 'panel center-col' }, [this.groupTabs, this.slotTabs, this.itemsGrid]),
      el('div', { class: 'panel center-col' }, [el('div', { class: 'muted', text: 'Colores' }), colors]),
      el('div', { class: 'panel center-col' }, [el('div', { class: 'muted', text: 'Proporciones' }), sliders]),
    );
    (this.root.querySelector('.title') as HTMLElement).style.fontSize = '26px';
  }

  private emit(): void {
    this.onChange(structuredClone(this.avatar));
  }

  private renderGroups(): void {
    this.groupTabs.replaceChildren();
    GROUPS.forEach((g, i) => {
      const b = el('button', { text: g.name, class: i === this.group ? 'active' : '' });
      b.addEventListener('click', () => {
        this.group = i;
        this.slot = g.slots[0]!;
        this.renderGroups();
        this.renderSlots();
      });
      this.groupTabs.append(b);
    });
  }

  private renderSlots(): void {
    this.slotTabs.replaceChildren();
    for (const s of GROUPS[this.group]!.slots) {
      const b = el('button', { text: SLOT_LABELS[s], class: s === this.slot ? 'active' : '' });
      b.addEventListener('click', () => { this.slot = s; this.renderSlots(); });
      this.slotTabs.append(b);
    }
    this.renderItems();
  }

  private renderItems(): void {
    this.itemsGrid.replaceChildren();
    for (const it of Object.values(COSMETICS)) {
      if (it.slot !== this.slot) continue;
      if (it.model === '' && REQUIRED_SLOTS.includes(this.slot)) continue;
      const card = el('div', { class: `item${this.avatar.items[this.slot] === it.id ? ' selected' : ''}` }, [
        el('div', { class: 'rarity', text: it.rarity }),
        el('div', { class: 'name', text: it.displayName }),
        el('div', { class: 'price', text: it.price ? `${it.price} monedas` : 'Gratis' }),
      ]);
      (card.querySelector('.rarity') as HTMLElement).style.color = RARITY_COLORS[it.rarity];
      card.addEventListener('mouseenter', () => audio.uiHover());
      card.addEventListener('click', () => {
        this.avatar.items[this.slot] = it.id as CosmeticId;
        audio.uiClick();
        this.renderItems();
        this.emit();
      });
      this.itemsGrid.append(card);
    }
  }

  /** Combinación al azar: sirve de prueba rápida de que todo encaja. */
  private randomize(): void {
    const bySlot = new Map<CosmeticSlot, CosmeticId[]>();
    for (const it of Object.values(COSMETICS)) {
      if (it.model === '' && REQUIRED_SLOTS.includes(it.slot)) continue;
      const list = bySlot.get(it.slot) ?? [];
      list.push(it.id as CosmeticId);
      bySlot.set(it.slot, list);
    }
    for (const [slot, list] of bySlot) {
      this.avatar.items[slot] = list[Math.floor(Math.random() * list.length)]!;
    }
    for (const ch of Object.keys(COLOR_CHANNELS) as ColorChannel[]) {
      const presets = COLOR_CHANNELS[ch].presets;
      if (presets.length) this.avatar.colors[ch] = presets[Math.floor(Math.random() * presets.length)]!;
    }
    audio.uiClick();
    this.renderItems();
    this.emit();
  }
}
