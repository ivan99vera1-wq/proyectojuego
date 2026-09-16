import { BRANDING, GAME_MODES, MAPS } from '@game/config';
import { el } from './dom.js';
import { buildSettingsPanel } from './SettingsPanel.js';
import { t } from './i18n.js';
import { settings } from '../app/Settings.js';

export interface MenuActions {
  quickMatch: (modeId: string, mapId: string) => Promise<void>;
  createPrivate: (modeId: string, mapId: string) => Promise<void>;
  joinCode: (code: string) => Promise<void>;
  customize: () => void;
  /** Dirección del servidor de juego, para poder decirle al jugador dónde falla. */
  serverUrl: string;
  /** ¿Responde el servidor? Sirve para distinguir "no está arrancado" del resto. */
  isServerUp: () => Promise<boolean>;
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
    const map = el('select');
    for (const m of Object.values(MAPS)) { const o = el('option', { text: m.displayName }); o.value = m.id; map.append(o); }
    const code = el('input', { type: 'text', placeholder: 'Código de sala' });
    code.maxLength = 8; code.style.textTransform = 'uppercase';

    const busy = async (fn: () => Promise<void>, label: string) => {
      settings.set('nickname', name.value.trim());
      this.setStatus(label);
      const buttons = [play, create, join];
      for (const b of buttons) b.disabled = true;
      try {
        await fn();
      } catch (e) {
        this.showError(await describeJoinError(e, this.actions));
      } finally {
        for (const b of [play, create, join]) b.disabled = false;
      }
    };
    const play: HTMLButtonElement = el('button', { text: t('findMatch') });
    play.addEventListener('click', () => busy(() => actions.quickMatch(mode.value, map.value), t('connecting')));
    const create: HTMLButtonElement = el('button', { class: 'secondary', text: t('createRoom') });
    create.addEventListener('click', () => busy(() => actions.createPrivate(mode.value, map.value), t('connecting')));
    const join: HTMLButtonElement = el('button', { class: 'secondary', text: t('joinRoom') });
    join.addEventListener('click', () => busy(() => actions.joinCode(code.value.trim().toUpperCase()), t('connecting')));
    const customize = el('button', { class: 'accent', text: t('customize') });
    customize.addEventListener('click', actions.customize);
    const settingsBtn = el('button', { class: 'secondary', text: t('settings') });
    settingsBtn.addEventListener('click', () => {
      this.settingsPanel = buildSettingsPanel(() => { this.settingsPanel?.remove(); this.settingsPanel = null; this.main.style.display = ''; });
      this.main.style.display = 'none';
      this.root.append(this.settingsPanel);
    });

    this.main = el('div', { class: 'panel center-col menu-panel' }, [
      el('h1', { class: 'title', html: `${BRANDING.name.slice(0, 4)}<span>${BRANDING.name.slice(4)}</span>` }),
      el('div', { class: 'tagline', text: BRANDING.tagline }),
      el('div', { class: 'field' }, [el('label', { text: 'Apodo' }), name]),
      el('div', { class: 'row' }, [
        el('div', { class: 'field' }, [el('label', { text: 'Modo' }), mode]),
        el('div', { class: 'field' }, [el('label', { text: 'Mapa' }), map]),
      ]),
      play,
      el('div', { class: 'row' }, [create]),
      el('div', { class: 'row' }, [code, join]),
      el('div', { class: 'row' }, [customize, settingsBtn]),
      this.status,
    ]);
    this.main.style.width = '380px';
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
