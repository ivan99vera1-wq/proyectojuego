import { BODY_SLIDERS, CHARACTERS, COLOR_CHANNELS, COSMETICS, RARITY_COLORS, REQUIRED_SLOTS, type BodySlider, type CharacterId, type ColorChannel, type CosmeticId, type CosmeticSlot } from '@game/config';
import type { AvatarConfig } from '@game/shared';
import { el } from './dom.js';
import { audio } from '../audio/SynthAudio.js';

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  hair: 'Cabello', eyes: 'Ojos', face: 'Cara', headwear: 'Gorro', eyewear: 'Gafas', top: 'Torso', bottom: 'Piernas', shoes: 'Calzado',
  back: 'Espalda', hands: 'Manos', accessory: 'Accesorio', weaponSkin: 'Skin de arma', trail: 'Estela', killEffect: 'Efecto',
};

/**
 * Panel del vestidor: arquetipo, pestañas por slot, colores y sliders.
 * Modifica una copia del avatar y avisa en cada cambio (vista previa en vivo).
 */
export class CustomizationPanel {
  readonly root = el('div', { class: 'custom-layout' });
  private slot: CosmeticSlot = 'hair';
  private readonly itemsGrid = el('div', { class: 'grid' });
  private readonly tabs = el('div', { class: 'tabs' });

  constructor(private avatar: AvatarConfig, private readonly onChange: (a: AvatarConfig) => void, onSave: () => void, onBack: () => void, onEmote: (k: number) => void) {
    const save = el('button', { text: 'Guardar' });
    save.addEventListener('click', onSave);
    const back = el('button', { class: 'secondary', text: 'Volver' });
    back.addEventListener('click', onBack);
    const dance = el('button', { class: 'secondary', text: '💃 Bailar' }); dance.addEventListener('click', () => onEmote(0));
    const wave = el('button', { class: 'secondary', text: '👋 Saludar' }); wave.addEventListener('click', () => onEmote(1));

    // Arquetipo
    const chars = el('div', { class: 'tabs' });
    const renderChars = () => {
      chars.replaceChildren();
      for (const c of Object.values(CHARACTERS)) {
        const b = el('button', { class: this.avatar.character === c.id ? 'active' : '', text: c.displayName, title: c.description });
        b.addEventListener('click', () => { this.avatar.character = c.id as CharacterId; renderChars(); this.emit(); });
        chars.append(b);
      }
    };
    renderChars();

    // Pestañas de slots
    for (const s of Object.keys(SLOT_LABELS) as CosmeticSlot[]) {
      const b = el('button', { text: SLOT_LABELS[s], class: s === this.slot ? 'active' : '' });
      b.addEventListener('click', () => { this.slot = s; for (const x of Array.from(this.tabs.children)) x.classList.remove('active'); b.classList.add('active'); this.renderItems(); });
      this.tabs.append(b);
    }
    this.renderItems();

    // Colores
    const colors = el('div', { class: 'center-col' });
    for (const ch of Object.keys(COLOR_CHANNELS) as ColorChannel[]) {
      const def = COLOR_CHANNELS[ch];
      const picker = el('input', { type: 'color', value: this.avatar.colors[ch] });
      picker.addEventListener('input', () => { this.avatar.colors[ch] = picker.value; this.emit(); renderSw(); });
      const sw = el('div', { class: 'swatches' });
      const renderSw = () => {
        sw.replaceChildren();
        for (const p of def.presets) {
          const d = el('div', { class: `swatch${this.avatar.colors[ch] === p ? ' selected' : ''}` });
          d.style.background = p;
          d.addEventListener('click', () => { this.avatar.colors[ch] = p; picker.value = p; this.emit(); renderSw(); });
          sw.append(d);
        }
      };
      renderSw();
      colors.append(el('div', { class: 'field' }, [el('label', { text: def.label }), el('div', { class: 'row' }, [picker, sw])]));
    }

    // Sliders
    const sliders = el('div', { class: 'center-col' });
    for (const key of Object.keys(BODY_SLIDERS) as BodySlider[]) {
      const def = BODY_SLIDERS[key];
      const input = el('input', { type: 'range' });
      input.min = String(def.min); input.max = String(def.max); input.step = '0.01'; input.value = String(this.avatar.sliders[key]);
      input.addEventListener('input', () => { this.avatar.sliders[key] = Number(input.value); this.emit(); });
      sliders.append(el('div', { class: 'field' }, [el('label', { text: def.label }), input]));
    }

    this.root.append(
      el('div', { class: 'panel center-col' }, [el('div', { class: 'row between' }, [el('div', { class: 'title', text: 'Personalizar' }), el('div', { class: 'row' }, [back, save])]), el('div', { class: 'muted', text: 'Arrastra para girar · rueda para acercar' }), el('div', { class: 'row' }, [dance, wave])]),
      el('div', { class: 'panel center-col' }, [el('div', { class: 'muted', text: 'Personaje' }), chars]),
      el('div', { class: 'panel center-col' }, [el('div', { class: 'muted', text: 'Cosméticos' }), this.tabs, this.itemsGrid]),
      el('div', { class: 'panel center-col' }, [el('div', { class: 'muted', text: 'Colores' }), colors]),
      el('div', { class: 'panel center-col' }, [el('div', { class: 'muted', text: 'Forma' }), sliders]),
    );
    (this.root.querySelector('.title') as HTMLElement).style.fontSize = '26px';
  }

  private emit(): void {
    this.onChange(structuredClone(this.avatar));
  }

  private renderItems(): void {
    this.itemsGrid.replaceChildren();
    const items = Object.values(COSMETICS).filter((c) => c.slot === this.slot);
    for (const it of items) {
      const isNone = it.model === '';
      if (isNone && REQUIRED_SLOTS.includes(this.slot)) continue;
      const card = el('div', { class: `item${this.avatar.items[this.slot] === it.id ? ' selected' : ''}` }, [
        el('div', { class: 'rarity', text: it.rarity }), el('div', { class: 'name', text: it.displayName }),
        el('div', { class: 'price', text: it.price ? `${it.price} monedas` : 'Gratis' }),
      ]);
      (card.querySelector('.rarity') as HTMLElement).style.color = RARITY_COLORS[it.rarity];
      card.addEventListener('mouseenter', () => audio.uiHover());
      card.addEventListener('click', () => { this.avatar.items[this.slot] = it.id as CosmeticId; audio.uiClick(); this.renderItems(); this.emit(); });
      this.itemsGrid.append(card);
    }
  }
}
