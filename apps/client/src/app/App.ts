import type { AvatarConfig } from '@game/shared';
import { Engine } from '../core/Engine.js';
import { InputManager } from '../input/InputManager.js';
import { NetworkClient } from '../net/NetworkClient.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { CustomizationScene } from '../scenes/CustomizationScene.js';
import { MatchScene } from '../scenes/MatchScene.js';
import { MainMenu } from '../ui/MainMenu.js';
import { CustomizationPanel } from '../ui/CustomizationPanel.js';
import { uiRoot, clearChildren, el } from '../ui/dom.js';
import { setLanguage } from '../ui/i18n.js';
import { settings } from './Settings.js';
import { avatarStore } from './AvatarStore.js';
import { audio } from '../audio/SynthAudio.js';

/** Orquesta escenas y UI: Menú → Vestidor / Partida. */
export class App {
  readonly engine: Engine;
  readonly input: InputManager;
  readonly net = new NetworkClient();

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
    this.input = new InputManager(canvas);
    settings.load();
    avatarStore.load();
    setLanguage(settings.data.language);
    settings.onChange((s) => setLanguage(s.language));
  }

  start(): void {
    this.engine.start();
    this.showMenu();
    window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
  }

  private nickname(): string {
    return settings.data.nickname || `Chibi${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  showMenu(): void {
    clearChildren(uiRoot());
    const scene = new MenuScene(this.engine, avatarStore.current, this.nickname());
    this.engine.setScene(scene);
    const menu = new MainMenu({
      quickMatch: async (modeId, mapId) => { await this.net.quickMatch({ nickname: this.nickname(), avatar: avatarStore.current, modeId, mapId }); this.showMatch(); },
      createPrivate: async (modeId, mapId) => { await this.net.createPrivate({ nickname: this.nickname(), avatar: avatarStore.current, modeId, mapId }); this.showMatch(); },
      joinCode: async (code) => { await this.net.joinByCode(code, { nickname: this.nickname(), avatar: avatarStore.current }); this.showMatch(); },
      customize: () => this.showCustomization(),
    });
    uiRoot().append(menu.root);
    audio.setVolumes(settings.data.masterVolume, settings.data.sfxVolume, settings.data.musicVolume);
    audio.startMenuMusic();
  }

  showCustomization(): void {
    clearChildren(uiRoot());
    const scene = new CustomizationScene(this.engine, avatarStore.current);
    this.engine.setScene(scene);
    let draft: AvatarConfig = structuredClone(avatarStore.current);
    const panel = new CustomizationPanel(
      draft,
      (a) => { draft = a; scene.setAvatar(a); },
      () => { avatarStore.save(draft); audio.buy(); this.showMenu(); },
      () => this.showMenu(),
      (k) => scene.playEmote(k),
    );
    uiRoot().append(panel.root);
  }

  showMatch(): void {
    if (!this.net.room) { this.showMenu(); return; }
    clearChildren(uiRoot());
    const scene = new MatchScene(this.engine, this.net, this.input, avatarStore.current, () => this.leaveMatch());
    this.engine.setScene(scene);
    const hint = el('div', { class: 'toast show', text: 'Haz clic para capturar el ratón · Esc para pausar' });
    uiRoot().append(hint);
    setTimeout(() => hint.remove(), 4000);
  }

  private leaveMatch(): void {
    this.net.leave();
    this.showMenu();
  }
}
