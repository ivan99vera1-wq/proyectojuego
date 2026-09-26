import { BRANDING, GAME_MODES, MAPS } from '@game/config';
import { button, el } from './dom.js';
import { buildSettingsPanel } from './SettingsPanel.js';
import { t } from './i18n.js';
import { settings } from '../app/Settings.js';

export interface MenuActions {
  quickMatch: (modeId: string, mapId: string) => Promise<void>;
  createPrivate: (modeId: string, mapId: string) => Promise<void>;
  joinCode: (code: string) => Promise<void>;
  /** Dirección del servidor de juego, para poder decirle al jugador dónde falla. */
  serverUrl: string;
  /** ¿Responde el servidor? Sirve para distinguir "no está arrancado" del resto. */
  isServerUp: () => Promise<boolean>;
}

/**
 * Parte el nombre del juego en dos para pintar la segunda mitad con el color
 * secundario. El corte va en la segunda mayúscula ("Chibi|Strike"); si el
 * nombre no tiene ninguna, se parte por la mitad. Antes había un `slice(0, 4)`
 * fijo que daba "Chib|iStrike" y se rompería con cualquier otro nombre.
 */
function splitBrandName(name: string): [string, string] {
  const at = name.slice(1).search(/[A-Z]/);
  const cut = at >= 0 ? at + 1 : Math.ceil(name.length / 2);
  return [name.slice(0, cut), name.slice(cut)];
}

/** Menú principal (HTML). */
export class MainMenu {
  readonly root = el('div', { class: 'menu-layout' });
  private readonly status = el('div', { class: 'muted' });
  private readonly main: HTMLElement;
  private settingsPanel: HTMLElement | null = null;

  private readonly actions: MenuActions;

  constructor(actions: MenuActions) {
    this.actions = actions;
    const name = el('input', { type: 'text', placeholder: 'Tu apodo', value: settings.data.nickname });
    name.maxLength = 16;
    name.addEventListener('change', () => settings.set('nickname', name.value.trim()));
    const mode = el('select');
    for (const m of Object.values(GAME_MODES)) { const o = el('option', { text: m.displayName }); o.value = m.id; mode.append(o); }
    // Solo se ofrecen los mapas que admiten el modo elegido: antes se podía
    // pedir una combinación imposible y el servidor caía al mapa por defecto
    // sin decir nada.
    const map = el('select');
    const renderMaps = () => {
      const previous = map.value;
      const usable = Object.values(MAPS).filter((m) => (m.modes as readonly string[]).includes(mode.value));
      const list = usable.length ? usable : Object.values(MAPS);
      map.replaceChildren();
      for (const m of list) { const o = el('option', { text: m.displayName }); o.value = m.id; map.append(o); }
      map.value = list.some((m) => m.id === previous) ? previous : (list[0]?.id ?? '');
    };
    renderMaps();
    mode.addEventListener('change', renderMaps);
    const code = el('input', { type: 'text', placeholder: 'Código de sala' });
    code.maxLength = 8; code.style.textTransform = 'uppercase';

    const busy = async (fn: () => Promise<void>, label: string) => {
      settings.set('nickname', name.value.trim());
      this.setStatus(label);
      for (const b of [play, create, join]) b.disabled = true;
      try {
        await fn();
      } catch (e) {
        this.showError(await describeJoinError(e, this.actions));
      } finally {
        for (const b of [play, create, join]) b.disabled = false;
      }
    };
    const play = button(t('findMatch'), () => void busy(() => actions.quickMatch(mode.value, map.value), t('connecting')), 'primary');
    const create = button(t('createRoom'), () => void busy(() => actions.createPrivate(mode.value, map.value), t('connecting')), 'secondary');
    const join = button(t('joinRoom'), () => void busy(() => actions.joinCode(code.value.trim().toUpperCase()), t('connecting')), 'secondary');
    const settingsBtn = button(t('settings'), () => {
      this.settingsPanel = buildSettingsPanel(() => { this.settingsPanel?.remove(); this.settingsPanel = null; this.main.style.display = ''; });
      this.main.style.display = 'none';
      this.root.append(this.settingsPanel);
    }, 'subtle');

    const [brandHead, brandTail] = splitBrandName(BRANDING.name);
    this.main = el('div', { class: 'panel center-col menu-panel' }, [
      el('h1', { class: 'title' }, [brandHead, el('span', { text: brandTail })]),
      el('div', { class: 'tagline', text: BRANDING.tagline }),
      el('div', { class: 'field' }, [el('label', { text: 'Apodo' }), name]),
      el('div', { class: 'row' }, [
        el('div', { class: 'field' }, [el('label', { text: 'Modo' }), mode]),
        el('div', { class: 'field' }, [el('label', { text: 'Mapa' }), map]),
      ]),
      play,
      // Las tres formas de entrar, de más a menos directa, y los ajustes
      // aparte para que no compitan con el botón principal.
      el('div', { class: 'row' }, [create]),
      el('div', { class: 'row' }, [code, join]),
      el('div', { class: 'row menu-foot' }, [settingsBtn]),
      this.status,
    ]);
    this.main.style.width = '392px';
    this.root.append(this.main, el('div', { class: 'menu-side', text: `${BRANDING.name} v${BRANDING.version} · ${BRANDING.studio}` }));
  }

  setStatus(text: string): void {
    this.status.textContent = text;
    this.status.classList.remove('error');
  }

  showError(text: string): void {
    this.status.textContent = text;
    this.status.classList.add('error');
  }

  /**
   * Avisa nada más abrir el menú si no hay servidor, en vez de esperar a que
   * el jugador pulse "Buscar partida" y se coma un error opaco.
   */
  async checkServer(): Promise<void> {
    this.setStatus(t('serverChecking'));
    if (await this.actions.isServerUp()) this.setStatus('');
    else this.showError(t('serverOffline', { url: this.actions.serverUrl }));
  }
}

/**
 * Traduce el fallo de conexión a algo accionable. El navegador entrega un
 * ProgressEvent sin mensaje cuando el WebSocket no llega a abrirse, así que
 * se comprueba la salud del servidor para saber si es que no está arrancado.
 */
async function describeJoinError(e: unknown, actions: MenuActions): Promise<string> {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (raw.includes('room_not_found')) return t('roomNotFound');
  if (raw.includes('protocol')) return t('versionMismatch');
  if (raw.includes('locked') || raw.includes('full')) return t('roomFull');
  if (!(await actions.isServerUp())) return t('serverOffline', { url: actions.serverUrl });
  return t('joinFailed', { detail: raw || 'error desconocido' });
}
