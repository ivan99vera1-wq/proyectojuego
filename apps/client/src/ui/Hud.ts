import { BRANDING, EQUIPMENT, GAMEPLAY, UI, WEAPONS, type WeaponId } from '@game/config';
import type { MatchPhase } from '@game/shared';
import { el } from './dom.js';

export interface HudPlayerRow {
  id: string;
  nickname: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  ping: number;
  alive: boolean;
  connected: boolean;
}

/** Cuántas líneas de killfeed y de chat se mantienen en pantalla. */
const MAX_KILLFEED = UI.hud.killfeedMax;
const MAX_CHAT_LINES = 8;

/**
 * HUD y overlays de partida (HTML sobre el canvas). Solo presenta datos: no
 * contiene reglas de juego.
 */
export class Hud {
  readonly root = el('div', { class: 'hud' });
  private readonly crosshair = el('div', { class: 'crosshair' });
  private readonly hitmarker = el('div', { class: 'hitmarker' });
  private readonly vignette = el('div', { class: 'vignette' });
  private readonly health = el('div', { class: 'v', text: '100' });
  private readonly armor = el('div', { class: 'v', text: '0' });
  private readonly ammo = el('div', { class: 'ammo', html: '' });
  private readonly weaponName = el('div', { class: 'weapon-name' });
  private readonly money = el('div', { class: 'money' });
  private readonly scoreA = el('div', { class: 'score a', text: '0' });
  private readonly scoreB = el('div', { class: 'score b', text: '0' });
  private readonly timer = el('div', { class: 'timer', text: '0:00' });
  private readonly phase = el('div', { class: 'phase' });
  private readonly killfeed = el('div', { class: 'killfeed' });
  private readonly banner = el('div', { class: 'banner' });
  private readonly progress = el('div', { class: 'progress' }, [el('div')]);
  private readonly hint = el('div', { class: 'hint' });
  private readonly chatbox = el('div', { class: 'chatbox' });
  private readonly chatInput = el('input', { class: 'chat-input', type: 'text', placeholder: '…' });
  private readonly fps = el('div', { class: 'fps' });
  private readonly ping = el('div', { class: 'ping' });
  private readonly scoreboard = el('div', { class: 'scoreboard' });
  private readonly death = el('div', { class: 'death' });
  private readonly deathText = el('div', { class: 'muted' });
  private readonly toast = el('div', { class: 'toast' });
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private hitTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  /** Temporizadores de líneas efímeras (killfeed, chat), para poder cancelarlos. */
  private readonly pending = new Set<ReturnType<typeof setTimeout>>();
  private frames = 0;
  private fpsAccum = 0;
  chatting = false;
  onChatSubmit: ((text: string, team: boolean) => void) | null = null;
  private chatTeam = false;

  constructor() {
    const bottomLeft = el('div', { class: 'hud-bottom-left' }, [
      el('div', { class: 'stat health' }, [this.health, el('div', { class: 'l', text: 'Vida' })]),
      el('div', { class: 'stat armor' }, [this.armor, el('div', { class: 'l', text: 'Armadura' })]),
    ]);
    const bottomRight = el('div', { class: 'hud-bottom-right' }, [this.ammo, this.weaponName]);
    const top = el('div', { class: 'hud-top' }, [this.scoreA, this.timer, this.scoreB]);
    this.chatInput.style.display = 'none';
    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const txt = this.chatInput.value.trim(); if (txt) this.onChatSubmit?.(txt, this.chatTeam); this.closeChat(); }
      if (e.key === 'Escape') this.closeChat();
    });
    this.chatbox.append(this.chatInput);
    this.death.append(el('div', { class: 'panel' }, [el('div', { text: 'Has sido eliminado', class: 'title', }), this.deathText]));
    (this.death.firstChild as HTMLElement).querySelector('.title')!.setAttribute('style', 'font-size:30px');
    this.root.append(
      this.vignette, this.crosshair, this.hitmarker, bottomLeft, bottomRight, this.money, top, this.phase,
      this.killfeed, this.banner, this.progress, this.hint, this.chatbox, this.fps, this.ping, this.scoreboard, this.death, this.toast,
    );
  }

  // ------------------------------------------------------------ actualización por frame
  setVitals(health: number, armor: number): void {
    this.health.textContent = String(Math.max(0, Math.round(health)));
    this.armor.textContent = String(Math.round(armor));
  }

  setWeapon(weaponId: string, mag: number, reserve: number, reloading: boolean, grenadeIds = ''): void {
    const w = WEAPONS[weaponId as WeaponId];
    if (!w) { this.ammo.innerHTML = ''; this.weaponName.textContent = ''; return; }
    this.weaponName.textContent = w.displayName + (reloading ? ' · recargando…' : '');
    if ((w.category as string) === 'grenade') this.ammo.innerHTML = '●'.repeat(Math.max(1, grenadeIds.split(',').filter((g) => g === weaponId).length));
    else if (w.magazineSize === 0) this.ammo.innerHTML = '—';
    else this.ammo.innerHTML = `${mag} <small>/ ${reserve}</small>`;
  }

  setMoney(money: number, show: boolean): void {
    this.money.style.display = show ? 'block' : 'none';
    this.money.textContent = `$${money}`;
  }

  setScore(a: number, b: number, teams: boolean): void {
    this.scoreA.style.display = this.scoreB.style.display = teams ? 'block' : 'none';
    this.scoreA.textContent = String(a);
    this.scoreB.textContent = String(b);
  }

  setTimer(seconds: number, phase: MatchPhase, round: number, bombPlanted: boolean, bombTimer: number): void {
    const s = bombPlanted ? bombTimer : seconds;
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    this.timer.textContent = `${m}:${r.toString().padStart(2, '0')}`;
    this.timer.classList.toggle('bomb', bombPlanted);
    const labels: Record<MatchPhase, string> = {
      waiting: 'Esperando jugadores', warmup: 'Calentamiento', freeze: `Ronda ${round} · Tiempo de compra`,
      live: bombPlanted ? '¡Bomba plantada!' : `Ronda ${round}`, postround: 'Fin de ronda', ended: 'Partida terminada',
    };
    this.phase.textContent = labels[phase] ?? phase;
  }

  setPing(ms: number, fps: number, showFps: boolean): void {
    this.ping.textContent = `${ms} ms`;
    this.fps.style.display = showFps ? 'block' : 'none';
    this.fps.textContent = `${fps} fps`;
  }

  tickFps(dt: number): number | null {
    this.frames++; this.fpsAccum += dt;
    if (this.fpsAccum >= 0.5) { const f = Math.round(this.frames / this.fpsAccum); this.frames = 0; this.fpsAccum = 0; return f; }
    return null;
  }

  setProgress(k: number | null): void {
    this.progress.classList.toggle('show', k !== null);
    if (k !== null) (this.progress.firstChild as HTMLElement).style.width = `${Math.round(k * 100)}%`;
  }

  setHint(text: string | null): void {
    this.hint.classList.toggle('show', !!text);
    if (text) this.hint.textContent = text;
  }

  setCrosshair(visible: boolean): void {
    this.crosshair.style.display = visible ? 'block' : 'none';
  }

  // ------------------------------------------------------------ eventos
  hit(headshot: boolean): void {
    this.hitmarker.classList.add('show');
    this.hitmarker.classList.toggle('head', headshot);
    if (this.hitTimer) clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => this.hitmarker.classList.remove('show'), UI.hud.hitmarkerDuration * 1000);
  }

  hurt(): void {
    this.vignette.classList.add('hurt');
    requestAnimationFrame(() => requestAnimationFrame(() => this.vignette.classList.remove('hurt')));
  }

  addKill(killer: string, killerTeam: string, victim: string, victimTeam: string, weaponId: string, headshot: boolean): void {
    const w = WEAPONS[weaponId as WeaponId];
    const cls = (team: string) => (team === 'A' ? 'a' : team === 'B' ? 'b' : 'f');
    const line = el('div', { class: 'kf' });
    line.innerHTML = `<b class="${cls(killerTeam)}">${esc(killer)}</b> ${headshot ? '🎯' : '⚡'} ${w ? esc(w.displayName) : esc(weaponId)} <b class="${cls(victimTeam)}">${esc(victim)}</b>`;
    this.killfeed.prepend(line);
    while (this.killfeed.children.length > MAX_KILLFEED) this.killfeed.lastChild!.remove();
    this.later(() => line.remove(), UI.hud.killfeedDuration * 1000);
  }

  showBanner(title: string, sub = '', ms = 2500): void {
    this.banner.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    this.banner.classList.add('show');
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.remove('show'), ms);
  }

  showToast(text: string, ms = 2000): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  addChat(nickname: string, team: string, text: string, teamOnly: boolean): void {
    const line = el('div', { class: 'chat-line' });
    line.innerHTML = `${teamOnly ? '<span class="badge">equipo</span> ' : ''}<b class="${team === 'A' ? 'a' : team === 'B' ? 'b' : ''}">${esc(nickname)}</b>: ${esc(text)}`;
    this.chatbox.insertBefore(line, this.chatInput);
    while (this.chatbox.children.length > MAX_CHAT_LINES + 1) this.chatbox.firstChild!.remove();
    this.later(() => line.classList.add('faded'), 9000);
    this.later(() => line.remove(), 10500);
  }

  openChat(team: boolean): void {
    this.chatting = true;
    this.chatTeam = team;
    this.chatInput.placeholder = team ? 'Mensaje al equipo…' : 'Mensaje a todos…';
    this.chatInput.style.display = 'block';
    this.chatInput.value = '';
    this.chatInput.focus();
  }
  closeChat(): void {
    this.chatting = false;
    this.chatInput.style.display = 'none';
    this.chatInput.blur();
  }

  setDeath(show: boolean, text = ''): void {
    this.death.classList.toggle('show', show);
    this.deathText.textContent = text;
  }

  setScoreboard(show: boolean, rows: HudPlayerRow[], meId: string, teams: boolean, mapName: string, modeName: string): void {
    this.scoreboard.classList.toggle('show', show);
    if (!show) return;
    const COLUMNS = 5;
    const table = el('table');
    const header = () => el('tr', {}, [
      el('th', { text: 'Jugador' }), el('th', { title: 'Bajas', text: 'B' }),
      el('th', { title: 'Muertes', text: 'M' }), el('th', { title: 'Asistencias', text: 'A' }),
      el('th', { text: 'Ping' }),
    ]);
    const row = (p: HudPlayerRow) => el('tr', { class: [p.id === meId ? 'me' : '', p.alive ? '' : 'dead'].filter(Boolean).join(' ') }, [
      el('td', { text: p.connected ? p.nickname : `${p.nickname} (desconectado)` }),
      el('td', { text: String(p.kills) }), el('td', { text: String(p.deaths) }),
      el('td', { text: String(p.assists) }), el('td', { text: String(p.ping) }),
    ]);
    const sorted = [...rows].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const groupHead = (text: string, cls = '') => {
      const tr = el('tr', {}, [el('td', { class: `team-head ${cls}`.trim(), text })]);
      (tr.firstChild as HTMLElement).setAttribute('colspan', String(COLUMNS));
      return tr;
    };
    if (teams) {
      for (const team of ['A', 'B'] as const) {
        table.append(groupHead(BRANDING.teams[team].name, team.toLowerCase()), header());
        for (const p of sorted.filter((r) => r.team === team)) table.append(row(p));
      }
      const spec = sorted.filter((r) => r.team === 'spectator');
      if (spec.length) {
        table.append(groupHead('Espectadores'));
        for (const p of spec) table.append(row(p));
      }
    } else {
      table.append(header());
      for (const p of sorted) table.append(row(p));
    }
    this.scoreboard.replaceChildren(el('div', { class: 'panel' }, [el('div', { class: 'muted', text: `${mapName} · ${modeName}` }), table]));
  }

  /** setTimeout que se cancela solo si el HUD desaparece antes de que salte. */
  private later(fn: () => void, ms: number): void {
    const id = setTimeout(() => { this.pending.delete(id); fn(); }, ms);
    this.pending.add(id);
  }

  destroy(): void {
    for (const id of [this.bannerTimer, this.hitTimer, this.toastTimer]) if (id) clearTimeout(id);
    this.bannerTimer = this.hitTimer = this.toastTimer = null;
    for (const id of this.pending) clearTimeout(id);
    this.pending.clear();
    this.closeChat();
    this.root.remove();
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Descripción corta para la tienda. */
export function shopDescription(id: string): string {
  const w = WEAPONS[id as WeaponId];
  if (w) return `${w.damage} daño · ${w.fireRate}/s · ${w.magazineSize || '—'} bal.`;
  const e = EQUIPMENT[id as keyof typeof EQUIPMENT];
  if (e) return id === 'armor' ? `${e.armor} armadura` : id === 'helmet' ? 'Protege la cabeza' : `Desactiva en ${GAMEPLAY.round.defuseTimeWithKit}s`;
  return '';
}
