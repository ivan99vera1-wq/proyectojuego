import { audio } from '../audio/SynthAudio.js';

/** Mini helper de DOM para construir la UI sin framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: { class?: string; text?: string; html?: string; id?: string; title?: string; type?: string; value?: string; placeholder?: string } = {},
  children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs.class) e.className = attrs.class;
  if (attrs.id) e.id = attrs.id;
  if (attrs.title) e.title = attrs.title;
  if (attrs.text !== undefined) e.textContent = attrs.text;
  if (attrs.html !== undefined) e.innerHTML = attrs.html;
  if (attrs.type && e instanceof HTMLInputElement) e.type = attrs.type;
  if (attrs.value !== undefined && (e instanceof HTMLInputElement || e instanceof HTMLSelectElement)) e.value = attrs.value;
  if (attrs.placeholder && e instanceof HTMLInputElement) e.placeholder = attrs.placeholder;
  for (const c of children) e.append(c);
  return e;
}

/**
 * Botón de la interfaz. Todos los botones del juego se crean aquí para que el
 * sonido de pulsación y de paso por encima sea el mismo en todas las pantallas:
 * un menú mudo delata que la interfaz es un prototipo.
 */
export function button(
  label: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' | 'subtle' | '' = '',
): HTMLButtonElement {
  const b = el('button', variant ? { class: variant, text: label } : { text: label });
  b.addEventListener('click', () => { audio.uiClick(); onClick(); });
  b.addEventListener('pointerenter', () => audio.uiHover());
  return b;
}

export const uiRoot = (): HTMLElement => document.getElementById('ui-root')!;

export function clearChildren(e: HTMLElement): void {
  while (e.firstChild) e.removeChild(e.firstChild);
}
