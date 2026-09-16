import { BRANDING } from '@game/config';
import { el } from './dom.js';
import { buildSettingsPanel } from './SettingsPanel.js';

export interface PauseActions {
  resume: () => void;
  joinTeam: (team: 'A' | 'B' | 'spectator') => void;
  leave: () => void;
}

/** Menú de pausa (Escape / pérdida de pointer lock). */
export class PauseMenu {
  readonly root = el('div', { class: 'overlay menu-panel' });
  private readonly main: HTMLElement;
  private settingsPanel: HTMLElement | null = null;
  visible = false;

  constructor(actions: PauseActions, teams: boolean, code: string) {
    const resume = el('button', { text: 'Volver a la partida' });
    resume.addEventListener('click', actions.resume);
    const settingsBtn = el('button', { class: 'secondary', text: 'Ajustes' });
    settingsBtn.addEventListener('click', () => this.showSettings());
    const leave = el('button', { class: 'secondary', text: 'Salir al menú' });
    leave.addEventListener('click', actions.leave);
    const teamRow = el('div', { class: 'row' });
    if (teams) {
      for (const t of ['A', 'B', 'spectator'] as const) {
        const b = el('button', { class: 'secondary', text: t === 'spectator' ? 'Espectador' : BRANDING.teams[t].name });
        b.style.color = t === 'A' ? BRANDING.colors.teamA : t === 'B' ? BRANDING.colors.teamB : '';
        b.addEventListener('click', () => actions.joinTeam(t));
        teamRow.append(b);
      }
    }
    this.main = el('div', { class: 'panel center-col' }, [
      el('div', { class: 'title', text: 'Pausa' }),
      code ? el('div', { class: 'muted' }, ['Código de sala: ', el('span', { class: 'kbd', text: code })]) : el('div'),
      resume, settingsBtn,
      teams ? el('div', { class: 'muted', text: 'Cambiar de equipo' }) : el('div'),
      teamRow, leave,
    ]);
    (this.main.querySelector('.title') as HTMLElement).style.fontSize = '28px';
    this.root.append(this.main);
    this.root.style.display = 'none';
  }

  private showSettings(): void {
    this.settingsPanel = buildSettingsPanel(() => { this.settingsPanel?.remove(); this.settingsPanel = null; this.main.style.display = ''; });
    this.main.style.display = 'none';
    this.root.append(this.settingsPanel);
  }

  show(): void { this.visible = true; this.root.style.display = 'flex'; }
  hide(): void { this.visible = false; this.root.style.display = 'none'; this.settingsPanel?.remove(); this.settingsPanel = null; this.main.style.display = ''; }
}
