import * as THREE from 'three';
import { getStateCallbacks } from 'colyseus.js';
import { BRANDING, GAMEPLAY, GAME_MODES, MAPS, WEAPONS, type GameModeId, type MapId, type WeaponId } from '@game/config';
import {
  ClientMessage, ServerMessage, PhysicsWorld, getMapLayout, directionFromAngles,
  type AvatarConfig, type ChatBroadcast, type EmoteBroadcast, type ExplosionPayload, type HitPayload, type KillPayload,
  type MatchEndPayload, type RoundEndPayload, type RoundStartPayload, type ShotFiredPayload, type SmokePayload,
} from '@game/shared';
import type { Engine } from '../core/Engine.js';
import type { GameScene } from '../core/GameScene.js';
import type { NetworkClient } from '../net/NetworkClient.js';
import type { MatchStateView, PlayerStateView, ProjectileStateView } from '../net/StateView.js';
import type { InputManager } from '../input/InputManager.js';
import { settings } from '../app/Settings.js';
import { buildMapMeshes } from '../world/MapRenderer.js';
import { PlayerEntity, weaponSkinColor } from '../entities/PlayerEntity.js';
import { ViewModel } from '../entities/ViewModel.js';
import { Prediction } from '../systems/Prediction.js';
import { InterpolationBuffer } from '../systems/Interpolation.js';
import { Effects } from '../fx/Effects.js';
import { audio } from '../audio/SynthAudio.js';
import { Hud } from '../ui/Hud.js';
import { BuyMenu } from '../ui/BuyMenu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { uiRoot } from '../ui/dom.js';
import { t } from '../ui/i18n.js';

const STEP = 1 / 60;
const MAX_STEPS = 5;

interface Remote { entity: PlayerEntity; buffer: InterpolationBuffer; lastAlive: boolean; }

/**
 * Escena de partida: mundo, predicción local, jugadores remotos interpolados,
 * disparos, HUD, tienda, marcador, pausa y efectos.
 */
export class MatchScene implements GameScene {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private physics!: PhysicsWorld;
  prediction!: Prediction;
  readonly remotes = new Map<string, Remote>();
  private readonly projectiles = new Map<string, THREE.Mesh>();
  private readonly effects = new Effects();
  private readonly viewModel: ViewModel;
  readonly hud = new Hud();
  private buyMenu!: BuyMenu;
  pause!: PauseMenu;
  private bombMesh: THREE.Mesh;
  private acc = 0;
  private lastFire = 0;
  private predictedMag = -1;
  private lastServerMag = -1;
  private interactHeld = false;
  private wasAlive = false;
  private lastBeep = 0;
  private lastFootstep = 0;
  private lastMouse = { yaw: 0, pitch: 0 };
  private fps = 0;
  private disposed = false;
  private readonly unsubs: (() => void)[] = [];
  private readonly sun: THREE.DirectionalLight;

  constructor(
    private readonly engine: Engine,
    private readonly net: NetworkClient,
    private readonly input: InputManager,
    private readonly avatar: AvatarConfig,
    private readonly onLeave: () => void,
  ) {
    this.camera = new THREE.PerspectiveCamera(settings.data.fov, 1, 0.05, 500);
    this.viewModel = new ViewModel(weaponSkinColor(avatar));
    this.viewModel.setColors(avatar.colors.skin, weaponSkinColor(avatar));
    this.camera.add(this.viewModel.root);
    this.scene.add(this.camera);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: '#c0392b', emissive: '#ff2020', emissiveIntensity: 0.5 }));
    this.bombMesh.visible = false;
  }

  /** Estado autoritativo (el objeto raíz puede sustituirse al recibir el estado completo). */
  get state(): MatchStateView { return this.net.room!.state as unknown as MatchStateView; }
  get mode() { return GAME_MODES[this.state.modeId as GameModeId] ?? GAME_MODES.bomb; }
  get me(): PlayerStateView | undefined { return this.state.players.get(this.net.sessionId); }

  init(): void {
    const mapId = this.state.mapId as MapId;
    const mapDef = MAPS[mapId] ?? MAPS.playground;
    const layout = getMapLayout(mapId);
    this.physics = new PhysicsWorld(layout);
    this.prediction = new Prediction(this.physics, 'local');

    this.scene.background = new THREE.Color(mapDef.skyColor);
    this.scene.fog = new THREE.Fog(mapDef.skyColor, mapDef.fogDistance * 0.5, mapDef.fogDistance);
    this.sun.position.set(30, 50, 20);
    this.sun.castShadow = settings.data.graphicsQuality !== 'low';
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 150;
    this.scene.add(this.sun, new THREE.HemisphereLight(mapDef.skyColor, '#3a3a4a', 1.1), new THREE.AmbientLight('#ffffff', 0.25));
    this.scene.add(buildMapMeshes(layout, mapDef.skyColor));
    this.scene.add(this.effects.group, this.bombMesh);
    this.engine.renderer.shadowMap.enabled = settings.data.graphicsQuality !== 'low';
    this.engine.renderer.setPixelRatio(settings.data.graphicsQuality === 'high' ? Math.min(devicePixelRatio, 2) : 1);

    // UI
    const ui = uiRoot();
    ui.append(this.hud.root);
    this.buyMenu = new BuyMenu((id) => this.net.send(ClientMessage.Buy, { itemId: id }), () => this.closeBuyMenu());
    this.pause = new PauseMenu({
      resume: () => this.resume(),
      joinTeam: (team) => { this.net.send(ClientMessage.JoinTeam, { team }); this.resume(); },
      leave: () => this.leave(),
    }, this.mode.teams, this.state.code);
    ui.append(this.buyMenu.root, this.pause.root);
    this.hud.onChatSubmit = (text, team) => this.net.send(ClientMessage.Chat, { text, team });
    this.hud.setCrosshair(true);

    // Entrada
    this.input.setBindings(settings.data.bindings);
    this.input.setSensitivity(settings.data.mouseSensitivity);
    this.input.setInvertY(settings.data.invertY);
    this.input.onKeyDown = (code, e) => this.onKey(code, e);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.engine.canvas.addEventListener('click', this.onCanvasClick);
    this.unsubs.push(settings.onChange((s) => {
      this.input.setSensitivity(s.mouseSensitivity); this.input.setInvertY(s.invertY); this.input.setBindings(s.bindings);
      this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
      audio.setVolumes(s.masterVolume, s.sfxVolume, s.musicVolume);
    }));

    // Red
    const $ = getStateCallbacks(this.net.room!);
    const st = $(this.net.room!.state as unknown as { players: Map<string, PlayerStateView>; projectiles: Map<string, ProjectileStateView> });
    this.unsubs.push(st.players!.onAdd((p: PlayerStateView, key: string) => this.onPlayerAdd(p, key), true));
    this.unsubs.push(st.players!.onRemove((_p: PlayerStateView, key: string) => this.onPlayerRemove(key)));
    this.unsubs.push(st.projectiles!.onAdd((p: ProjectileStateView, key: string) => this.onProjectileAdd(p, key), true));
    this.unsubs.push(st.projectiles!.onRemove((_p: ProjectileStateView, key: string) => { const m = this.projectiles.get(key); if (m) { this.scene.remove(m); this.projectiles.delete(key); } }));
    this.net.room!.onStateChange(() => this.onStateChange());
    this.net.room!.onLeave((code) => { if (!this.disposed && code !== 1000) { this.hud.showToast(t('disconnected'), 4000); setTimeout(() => this.leave(), 1500); } });
    this.bindMessages();

    audio.ensure();
    audio.setVolumes(settings.data.masterVolume, settings.data.sfxVolume, settings.data.musicVolume);
    audio.stopMusic();
    this.resize(window.innerWidth, window.innerHeight);
    this.net.send(ClientMessage.SetAvatar, this.avatar);
    this.resume();
  }

  private bindMessages(): void {
    const on = <T,>(type: string, fn: (m: T) => void) => this.unsubs.push(this.net.on<T>(type, fn));
    on<ShotFiredPayload>(ServerMessage.ShotFired, (m) => this.onShotFired(m));
    on<HitPayload>(ServerMessage.Hit, (m) => {
      if (m.attackerId === this.net.sessionId && m.victimId !== this.net.sessionId) { this.hud.hit(m.headshot); if (m.headshot) audio.headshot(); else audio.hit(); }
      if (m.victimId === this.net.sessionId) { this.hud.hurt(); audio.damage(); }
    });
    on<KillPayload>(ServerMessage.Kill, (m) => {
      const k = this.state.players.get(m.killerId), v = this.state.players.get(m.victimId);
      this.hud.addKill(k?.nickname ?? '?', k?.team ?? '', v?.nickname ?? '?', v?.team ?? '', m.weaponId, m.headshot);
      if (m.killerId === this.net.sessionId && m.victimId !== this.net.sessionId) audio.kill();
      const pos = m.victimId === this.net.sessionId ? this.prediction.renderPos : this.remotes.get(m.victimId)?.entity.root.position;
      if (pos) this.effects.confetti(new THREE.Vector3(pos.x, pos.y + 0.8, pos.z));
    });
    on<RoundStartPayload>(ServerMessage.RoundStart, (m) => { this.hud.showBanner(`Ronda ${m.round}`, this.mode.economy ? 'Compra tu equipo (B)' : ''); this.closeBuyMenu(); });
    on<RoundEndPayload>(ServerMessage.RoundEnd, (m) => {
      const me = this.me;
      const won = me && m.winner === me.team;
      const reasons: Record<string, string> = { elimination: 'Equipo eliminado', bomb_exploded: 'La bomba explotó', bomb_defused: 'Bomba desactivada', time: 'Se acabó el tiempo', score: '' };
      const winnerName = m.winner === 'draw' ? 'Empate' : `Ganan ${BRANDING.teams[m.winner].name}`;
      this.hud.showBanner(me && me.team !== 'spectator' ? (won ? t('roundWon') : t('roundLost')) : winnerName, reasons[m.reason] ?? '', 4000);
      if (won) audio.roundWin(); else audio.roundLose();
    });
    on<MatchEndPayload>(ServerMessage.MatchEnd, (m) => {
      const name = m.winner === 'A' || m.winner === 'B' ? BRANDING.teams[m.winner].name : m.winner === 'draw' ? 'Empate' : (this.state.players.get(m.winner)?.nickname ?? '');
      this.hud.showBanner('Fin de la partida', m.winner === 'draw' ? 'Empate' : `Victoria: ${name}`, 8000);
    });
    on<{ x: number; y: number; z: number }>(ServerMessage.BombPlanted, () => { this.hud.showBanner(t('bombPlanted'), '', 2500); audio.bombPlanted(); });
    on(ServerMessage.BombDefused, () => { this.hud.showBanner(t('bombDefused'), '', 2500); audio.bombDefused(); });
    on<{ x: number; y: number; z: number }>(ServerMessage.BombExploded, (m) => { this.effects.explosion(new THREE.Vector3(m.x, m.y + 0.5, m.z)); audio.explosion(m); });
    on<ExplosionPayload>(ServerMessage.Explosion, (m) => { this.effects.explosion(new THREE.Vector3(m.x, m.y, m.z)); audio.explosion(m); });
    on<SmokePayload>(ServerMessage.Smoke, (m) => this.effects.smoke(new THREE.Vector3(m.x, m.y, m.z), m.duration));
    on<ChatBroadcast>(ServerMessage.Chat, (m) => { const p = this.state.players.get(m.from); this.hud.addChat(m.nickname, p?.team ?? '', m.text, m.team); });
    on<EmoteBroadcast>(ServerMessage.Emote, (m) => this.remotes.get(m.playerId)?.entity.playEmote(m.emote));
    on<{ code: string }>(ServerMessage.Error, (m) => {
      const msgs: Record<string, string> = { no_money: 'No tienes suficiente dinero', buy_closed: 'La tienda está cerrada', not_in_buyzone: 'Debes estar en tu zona de compra', team_full: 'Ese equipo está lleno', slot_full: 'No puedes llevar más granadas', already_owned: 'Ya lo tienes', wrong_team: 'Solo para el otro equipo' };
      this.hud.showToast(msgs[m.code] ?? m.code);
      audio.empty();
    });
  }

  // ------------------------------------------------------------------ jugadores
  private onPlayerAdd(p: PlayerStateView, key: string): void {
    if (key === this.net.sessionId) return;
    const entity = new PlayerEntity(p.avatar, p.nickname, p.team);
    this.scene.add(entity.root);
    this.remotes.set(key, { entity, buffer: new InterpolationBuffer(), lastAlive: p.alive });
  }

  private onPlayerRemove(key: string): void {
    const r = this.remotes.get(key);
    if (!r) return;
    this.scene.remove(r.entity.root);
    r.entity.dispose();
    this.remotes.delete(key);
  }

  private onProjectileAdd(p: ProjectileStateView, key: string): void {
    const isSmoke = WEAPONS[p.weaponId as WeaponId]?.damage === 0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: isSmoke ? '#cfd8dc' : '#ff5c7a' }));
    m.position.set(p.x, p.y, p.z);
    this.scene.add(m);
    this.projectiles.set(key, m);
  }

  private onStateChange(): void {
    const now = performance.now();
    const me = this.me;
    if (me) {
      this.prediction.reconcile(me, me.weaponId);
      if (me.ammoMag !== this.lastServerMag) { this.lastServerMag = me.ammoMag; this.predictedMag = me.ammoMag; }
    }
    for (const [id, r] of this.remotes) {
      const p = this.state.players.get(id);
      if (!p) continue;
      r.buffer.push({ t: now, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch });
      r.entity.setAvatar(p.avatar);
      if (r.entity.nickname !== p.nickname) { r.entity.nickname = p.nickname; r.entity.setNameTag(p.nickname, p.team); }
    }
    for (const [id, m] of this.projectiles) {
      const p = this.state.projectiles.get(id);
      if (p) m.position.set(p.x, p.y, p.z);
    }
  }

  private onShotFired(m: ShotFiredPayload): void {
    const to = new THREE.Vector3(m.x, m.y, m.z);
    if (m.shooterId === this.net.sessionId) {
      // Nuestro disparo ya se dibujó localmente; solo el impacto real.
      if (!m.hitPlayer) this.effects.impact(to, new THREE.Vector3(0, 1, 0));
      return;
    }
    const r = this.remotes.get(m.shooterId);
    const p = this.state.players.get(m.shooterId);
    if (!r || !p) return;
    r.entity.playFire();
    const from = r.entity.root.position.clone().add(new THREE.Vector3(0, GAMEPLAY.player.eyeHeight * 0.85, 0));
    this.effects.tracer(from, to);
    this.effects.muzzleFlash(from);
    if (!m.hitPlayer) this.effects.impact(to, new THREE.Vector3(0, 1, 0));
    audio.gunshot(m.weaponId, { x: p.x, y: p.y, z: p.z });
  }

  // ------------------------------------------------------------------ entrada
  private onKey(code: string, e: KeyboardEvent): boolean | void {
    if (this.hud.chatting) return true;
    const b = settings.data.bindings;
    if (code === 'Escape') return;
    if (code === b.chat || code === b.teamChat) { this.hud.openChat(code === b.teamChat); return true; }
    if (code === b.buyMenu) { if (this.buyMenu.visible) this.closeBuyMenu(); else this.openBuyMenu(); return true; }
    if (code === b.emote) { this.net.send(ClientMessage.Emote, { emote: e.shiftKey ? 1 : 0 }); return true; }
    return;
  }

  private onPointerLockChange = (): void => {
    if (!this.input.pointerLocked && !this.buyMenu.visible && !this.hud.chatting) this.pause.show();
  };
  private onCanvasClick = (): void => { if (!this.pause.visible && !this.buyMenu.visible) this.input.requestPointerLock(); };

  private resume(): void {
    this.pause.hide();
    this.input.enabled = true;
    this.input.requestPointerLock();
    audio.ensure();
  }

  private openBuyMenu(): void {
    const me = this.me;
    if (!me || !this.mode.economy || this.state.phase !== 'freeze') { this.hud.showToast('La tienda solo abre al inicio de la ronda'); return; }
    this.buyMenu.show(me.money, me.team);
    this.input.enabled = false;
    this.input.exitPointerLock();
  }
  private closeBuyMenu(): void {
    if (!this.buyMenu.visible) return;
    this.buyMenu.hide();
    this.resume();
  }

  private leave(): void {
    this.onLeave();
  }

  // ------------------------------------------------------------------ bucle
  update(dt: number): void {
    const me = this.me;
    const now = performance.now();
    const showScoreboard = this.input.isDown('scoreboard') || this.state.phase === 'ended';
    if (me && me.alive && !this.wasAlive) {
      this.prediction.teleport(me.x, me.y, me.z);
      this.input.yaw = me.yaw; this.input.pitch = 0;
      this.hud.setDeath(false);
    }
    if (me && !me.alive && this.wasAlive) {
      this.hud.setDeath(true, this.mode.respawn ? `Reapareces en ${this.mode.respawnDelay} s` : 'Espera a la siguiente ronda');
    }
    this.wasAlive = !!me?.alive;
    if (me && this.state.phase === 'waiting') this.hud.setDeath(false);

    // Simulación local a paso fijo
    this.acc = Math.min(this.acc + dt, STEP * MAX_STEPS);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.fixedStep(me);
    }
    this.prediction.update(dt);

    // Cámara
    const pos = this.prediction.renderPos;
    const crouchK = this.prediction.kin.crouching ? GAMEPLAY.player.crouchHeightFactor : 1;
    const targetEye = GAMEPLAY.player.eyeHeight * crouchK;
    this.camera.position.set(pos.x, pos.y + targetEye, pos.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.input.yaw;
    this.camera.rotation.x = this.input.pitch;
    audio.listener = { x: pos.x, y: pos.y, z: pos.z, yaw: this.input.yaw };
    this.sun.target.position.set(pos.x, 0, pos.z);
    this.sun.position.set(pos.x + 30, 50, pos.z + 20);
    this.sun.target.updateMatrixWorld();

    // Disparo / recarga / cambio de arma (por frame)
    if (me && me.alive && this.input.enabled) this.handleCombat(me, now);
    const speed = Math.hypot(this.prediction.kin.vx, this.prediction.kin.vz);
    const mdx = this.input.yaw - this.lastMouse.yaw, mdy = this.input.pitch - this.lastMouse.pitch;
    this.lastMouse = { yaw: this.input.yaw, pitch: this.input.pitch };
    this.viewModel.update(dt, speed, this.prediction.kin.grounded, mdx, mdy);
    this.viewModel.root.visible = !!me?.alive;
    this.viewModel.setWeapon(me?.weaponId ?? '');
    if (me?.alive && this.prediction.kin.grounded && speed > 1 && now - this.lastFootstep > 380 / Math.max(1, speed / 5)) { this.lastFootstep = now; audio.footstep(); }

    // Remotos
    for (const [id, r] of this.remotes) {
      const p = this.state.players.get(id);
      if (!p) continue;
      const s = r.buffer.sample(now);
      const pose = s ?? { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, speed: 0 };
      r.entity.root.visible = p.team !== 'spectator';
      r.entity.update(dt, { ...pose, grounded: p.grounded, crouching: p.crouching, alive: p.alive, reloading: p.reloading, weaponId: p.weaponId, hasBomb: p.hasBomb, team: p.team });
      if (pose.speed > 1 && p.alive && p.grounded && Math.random() < dt * 2.5) audio.footstep(pose);
    }

    // Bomba en el mundo
    const bs = this.state.bombState;
    this.bombMesh.visible = bs === 'dropped' || bs === 'planted';
    if (this.bombMesh.visible) {
      this.bombMesh.position.set(this.state.bombX, this.state.bombY + 0.1, this.state.bombZ);
      if (bs === 'planted') {
        const interval = Math.max(120, Math.min(1000, this.state.bombTimer * 30));
        if (now - this.lastBeep > interval) { this.lastBeep = now; audio.bombBeep({ x: this.state.bombX, y: this.state.bombY, z: this.state.bombZ }); }
        (this.bombMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.abs(Math.sin(now / 120)) * 0.7;
      }
    }

    this.effects.update(dt);
    this.updateHud(me, dt, showScoreboard);
    this.input.endFrame();
  }

  private fixedStep(me: PlayerStateView | undefined): void {
    if (!me || !me.alive || !this.net.room) return;
    const canMove = this.input.enabled && this.state.phase !== 'freeze' && this.state.phase !== 'postround' && this.state.phase !== 'ended';
    const fwd = canMove ? (this.input.isDown('moveForward') ? 1 : 0) - (this.input.isDown('moveBackward') ? 1 : 0) : 0;
    const right = canMove ? (this.input.isDown('moveRight') ? 1 : 0) - (this.input.isDown('moveLeft') ? 1 : 0) : 0;
    const res = this.prediction.step({
      dt: STEP, forward: fwd, right,
      jump: canMove && this.input.isDown('jump'),
      crouch: this.input.enabled && this.input.isDown('crouch'),
      sprint: canMove && this.input.isDown('sprint'),
      yaw: this.input.yaw, pitch: this.input.pitch,
    }, me.weaponId);
    this.net.sendInput({ seq: res.seq, dt: res.dt, forward: res.forward, right: res.right, jump: res.jump, crouch: res.crouch, sprint: res.sprint, yaw: res.yaw, pitch: res.pitch });
    if (res.jumped) audio.jump();
    if (res.landed > 3) audio.land();
  }

  private handleCombat(me: PlayerStateView, now: number): void {
    const w = WEAPONS[me.weaponId as WeaponId];
    const b = settings.data.bindings;
    // Cambio de arma
    if (this.input.wasPressed('primaryWeapon')) this.net.send(ClientMessage.SwitchWeapon, { slot: 'primary' });
    if (this.input.wasPressed('secondaryWeapon')) this.net.send(ClientMessage.SwitchWeapon, { slot: 'secondary' });
    if (this.input.wasPressed('melee')) this.net.send(ClientMessage.SwitchWeapon, { slot: 'melee' });
    if (this.input.wasPressed('grenade')) this.net.send(ClientMessage.SwitchWeapon, { slot: 'grenade' });
    if (this.input.wheel !== 0) {
      const slots = ['primary', 'secondary', 'melee', 'grenade'] as const;
      const owned = slots.filter((s) => (s === 'primary' ? me.primaryId : s === 'secondary' ? me.secondaryId : s === 'melee' ? me.meleeId : me.grenadeIds) !== '');
      const cur = owned.findIndex((s) => (s === 'primary' ? me.primaryId : s === 'secondary' ? me.secondaryId : s === 'melee' ? me.meleeId : me.grenadeIds.split(',')[0]) === me.weaponId || (s === 'grenade' && me.grenadeIds.split(',').includes(me.weaponId)));
      const next = owned[(cur + (this.input.wheel > 0 ? 1 : owned.length - 1)) % owned.length];
      if (next) this.net.send(ClientMessage.SwitchWeapon, { slot: next });
    }
    if (this.input.wasPressed('reload') && w && w.magazineSize > 0 && !me.reloading && me.ammoMag < w.magazineSize && me.ammoReserve > 0) {
      this.net.send(ClientMessage.Reload);
      this.viewModel.startReload(w.reloadTime);
      audio.reload();
    }
    // Interactuar (plantar / desactivar)
    const holding = this.input.isDown('interact');
    if (holding !== this.interactHeld) { this.interactHeld = holding; this.net.send(ClientMessage.Interact, { active: holding }); }

    // Disparo
    const live = this.state.phase === 'live' || this.state.phase === 'warmup';
    if (!w || !live || me.reloading) return;
    const wantFire = w.automatic ? this.input.isDown('fire') : this.input.wasPressed('fire');
    if (!wantFire) return;
    if (now - this.lastFire < 1000 / w.fireRate) return;
    if (w.category !== 'grenade' && w.magazineSize > 0 && this.predictedMag <= 0) { this.lastFire = now; audio.empty(); this.net.send(ClientMessage.Reload); this.viewModel.startReload(w.reloadTime); return; }
    this.lastFire = now;
    if (w.category !== 'grenade' && w.magazineSize > 0) this.predictedMag--;
    this.net.send(ClientMessage.Fire, { yaw: this.input.yaw, pitch: this.input.pitch });
    this.viewModel.fire();
    audio.gunshot(me.weaponId);
    // Trazador local inmediato
    if (w.category !== 'grenade') {
      const dir = directionFromAngles(this.input.yaw, this.input.pitch);
      const eye = this.camera.position.clone();
      const hit = this.physics.raycastMap(eye, dir, w.category === 'knife' ? w.range : 500);
      const end = hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : eye.clone().addScaledVector(new THREE.Vector3(dir.x, dir.y, dir.z), 500);
      const muzzle = eye.clone().add(new THREE.Vector3(0, -0.15, 0)).addScaledVector(new THREE.Vector3(dir.x, dir.y, dir.z), 0.6);
      if (w.category !== 'knife') { this.effects.tracer(muzzle, end); this.effects.muzzleFlash(muzzle); }
    }
    void b;
  }

  private updateHud(me: PlayerStateView | undefined, dt: number, showScoreboard: boolean): void {
    const st = this.state;
    const f = this.hud.tickFps(dt);
    if (f !== null) this.fps = f;
    this.hud.setPing(me?.ping ?? 0, this.fps, settings.data.showFps);
    this.hud.setScore(st.scoreA, st.scoreB, this.mode.teams);
    this.hud.setTimer(st.timer, st.phase, st.round, st.bombState === 'planted', st.bombTimer);
    if (me) {
      this.hud.setVitals(me.health, me.armor);
      this.hud.setWeapon(me.weaponId, this.predictedMag >= 0 ? this.predictedMag : me.ammoMag, me.ammoReserve, me.reloading, me.grenadeIds);
      this.hud.setMoney(me.money, this.mode.economy);
      this.hud.setProgress(me.interactProgress > 0 ? me.interactProgress : null);
      const layout = this.physics.layout;
      const p = this.prediction.kin;
      const inSite = (z: { x: number; y: number; z: number; sx: number; sy: number; sz: number }) => Math.abs(p.x - z.x) <= z.sx / 2 && Math.abs(p.z - z.z) <= z.sz / 2;
      let hint: string | null = null;
      const key = settings.data.bindings.interact.replace('Key', '');
      if (me.alive && st.phase === 'live' && this.mode.bomb) {
        if (me.hasBomb && (inSite(layout.bombsites.A) || inSite(layout.bombsites.B))) hint = `Mantén ${key} para plantar la bomba`;
        else if (me.team === 'A' && st.bombState === 'planted' && Math.hypot(p.x - st.bombX, p.z - st.bombZ) < 1.6) hint = `Mantén ${key} para desactivar`;
      }
      if (st.phase === 'freeze' && this.mode.economy && me.alive) hint = `Pulsa ${settings.data.bindings.buyMenu.replace('Key', '')} para comprar`;
      if (st.phase === 'waiting') hint = `Esperando jugadores (${[...st.players.values()].filter((x) => x.team !== 'spectator').length}/${GAMEPLAY.match.minPlayersToStart})${st.code ? ' · Código: ' + st.code : ''}`;
      this.hud.setHint(hint);
      if (this.buyMenu.visible) this.buyMenu.render(me.money, me.team);
    }
    const rows = [...st.players.values()].map((p) => ({ id: p.id, nickname: p.nickname, team: p.team, kills: p.kills, deaths: p.deaths, ping: p.ping, alive: p.alive, money: p.money }));
    this.hud.setScoreboard(showScoreboard, rows, this.net.sessionId, this.mode.teams, MAPS[st.mapId as MapId]?.displayName ?? st.mapId, this.mode.displayName);
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    for (const u of this.unsubs) u();
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.engine.canvas.removeEventListener('click', this.onCanvasClick);
    this.input.onKeyDown = null;
    this.input.enabled = true;
    this.input.exitPointerLock();
    for (const r of this.remotes.values()) r.entity.dispose();
    this.remotes.clear();
    this.hud.destroy();
    this.buyMenu.root.remove();
    this.pause.root.remove();
    this.prediction.dispose();
    this.physics.free();
    this.scene.clear();
  }
}
