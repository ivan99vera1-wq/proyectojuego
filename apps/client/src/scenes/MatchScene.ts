import * as THREE from 'three';
import { getStateCallbacks } from 'colyseus.js';
import { BRANDING, GAMEPLAY, GAME_MODES, MAPS, WEAPONS, type GameModeId, type MapDefinition, type MapId, type WeaponId } from '@game/config';
import {
  ClientMessage, ServerMessage, PhysicsWorld, getMapLayout, directionFromAngles, pointInZone,
  type BombExplodedPayload, type BombState, type ChatBroadcast, type EmoteBroadcast, type ErrorCode,
  type InspectBroadcast,
  type ErrorPayload, type ExplosionPayload, type HitPayload, type KillPayload, type MatchEndPayload,
  type MatchPhase, type MatchSnapshot, type PlayerSnapshot, type ProjectileSnapshot,
  type RoundEndPayload, type RoundStartPayload, type ShotFiredPayload, type SmokePayload,
} from '@game/shared';
import type { Engine } from '../core/Engine.js';
import type { GameScene } from '../core/GameScene.js';
import type { NetworkClient } from '../net/NetworkClient.js';
import type { InputManager } from '../input/InputManager.js';
import { settings } from '../app/Settings.js';
import { buildMapMeshes, disposeSharedProps, type RenderedMap } from '../world/MapRenderer.js';
import { PlayerEntity } from '../entities/PlayerEntity.js';
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
/** Radio en el que se puede desactivar la bomba (espejo de BombSystem). */
const DEFUSE_RADIUS = 1.6;
/** Alcance del trazador local cuando el disparo no toca nada (m). */
const TRACER_RANGE = 500;

interface Remote { entity: PlayerEntity; buffer: InterpolationBuffer; lastAlive: boolean; }

/** Traducción de los motivos de rechazo del servidor. */
const ERROR_TEXTS: Record<ErrorCode, string> = {
  no_economy: 'Este modo no tiene tienda',
  buy_closed: 'La tienda está cerrada',
  not_in_buyzone: 'Debes estar en tu zona de compra',
  no_money: 'No tienes suficiente dinero',
  slot_full: 'No puedes llevar más granadas',
  not_purchasable: 'Eso no se puede comprar',
  already_owned: 'Ya lo tienes',
  wrong_team: 'Solo para el otro equipo',
  unknown_item: 'Ese artículo no existe',
  team_full: 'Ese equipo está lleno',
};

/** Motivos de fin de ronda, en el orden en que los manda el servidor. */
const ROUND_END_TEXTS: Record<RoundEndPayload['reason'], string> = {
  elimination: 'Equipo eliminado',
  bomb_exploded: 'La bomba explotó',
  bomb_defused: 'Bomba desactivada',
  time: 'Se acabó el tiempo',
  score: '',
};

/**
 * Brazo de cámara de la tercera persona. `distance` es lo que se separa por
 * detrás, `shoulder` lo que se desplaza al hombro derecho (así la mira no
 * queda tapada por la cabeza) y `margin` el hueco que se deja al chocar con
 * una pared para que la cámara no la atraviese.
 */
const THIRD_PERSON = { distance: 2.1, shoulder: 0.42, height: 0.30, margin: 0.22 };

/**
 * Escena de partida: mundo, predicción local, jugadores remotos interpolados,
 * disparos, HUD, tienda, marcador, pausa y efectos.
 */
export class MatchScene implements GameScene {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private physics!: PhysicsWorld;
  prediction!: Prediction;
  private map: RenderedMap | null = null;
  readonly remotes = new Map<string, Remote>();
  private readonly projectiles = new Map<string, THREE.Mesh>();
  /** Geometría y materiales compartidos por todas las granadas en vuelo. */
  private readonly projectileGeo = new THREE.SphereGeometry(0.09, 10, 8);
  private readonly projectileMats = {
    frag: new THREE.MeshStandardMaterial({ color: '#ff5c7a' }),
    smoke: new THREE.MeshStandardMaterial({ color: '#cfd8dc' }),
  };
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
  /** Último dinero visto, para sonar la caja solo cuando la compra se acepta. */
  private lastMoney = -1;
  private fps = 0;
  private disposed = false;
  private readonly unsubs: (() => void)[] = [];
  private readonly sun: THREE.DirectionalLight;

  /**
   * Cámara en tercera persona. Se alterna en partida con la tecla de cámara y
   * se recuerda en los ajustes. En tercera persona se dibuja el personaje
   * propio (en primera solo se ven las manos y el arma).
   */
  private thirdPerson = settings.data.thirdPerson === true;
  private selfEntity: PlayerEntity | null = null;
  /** Distancia actual del brazo de cámara, suavizada al chocar con un muro. */
  private camBoom = THIRD_PERSON.distance;

  constructor(
    private readonly engine: Engine,
    private readonly net: NetworkClient,
    private readonly input: InputManager,
    private readonly onLeave: () => void,
  ) {
    this.camera = new THREE.PerspectiveCamera(settings.data.fov, 1, 0.05, 500);
    this.viewModel = new ViewModel();
    this.camera.add(this.viewModel.root);
    this.scene.add(this.camera);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: '#c0392b', emissive: '#ff2020', emissiveIntensity: 0.5 }));
    this.bombMesh.visible = false;
  }

  /** Estado autoritativo (el objeto raíz puede sustituirse al recibir el estado completo). */
  get state(): MatchSnapshot { return this.net.room!.state as unknown as MatchSnapshot; }
  get mode() { return GAME_MODES[this.state.modeId as GameModeId] ?? GAME_MODES.bomb; }
  get me(): PlayerSnapshot | undefined { return this.state.players.get(this.net.sessionId); }
  get phase(): MatchPhase { return this.state.phase as MatchPhase; }
  get bombState(): BombState { return this.state.bombState as BombState; }
  /** ¿Se puede comprar ahora? Mismas reglas que EconomySystem en el servidor. */
  get shopOpen(): boolean {
    return this.mode.economy && (this.mode.shopAlwaysOpen || this.phase === 'freeze');
  }

  init(): void {
    const mapId = this.state.mapId as MapId;
    // Tipado explícito: así los campos opcionales de paleta admiten respaldo.
    const mapDef: MapDefinition = MAPS[mapId] ?? MAPS.playground;
    const layout = getMapLayout(mapId);
    this.physics = new PhysicsWorld(layout);
    this.prediction = new Prediction(this.physics, 'local');

    // La niebla usa el color del horizonte para que lo lejano se funda con el
    // cielo en vez de recortarse contra él.
    const horizon = mapDef.skyHorizon ?? mapDef.skyColor;
    this.scene.background = new THREE.Color(horizon);
    this.scene.fog = new THREE.Fog(horizon, mapDef.fogDistance * 0.55, mapDef.fogDistance);
    this.sun.color = new THREE.Color(mapDef.sunColor ?? '#ffffff');
    this.sun.intensity = mapDef.sunIntensity ?? 2.2;
    // El sol entra bajo y de lado. Con la luz casi cenital de antes todas las
    // caras recibían lo mismo y el mapa se leía como un plano de colores; con
    // el sol tumbado cada volumen tiene una cara clara y otra en sombra.
    this.sun.position.set(38, 34, 26);
    this.sun.castShadow = settings.data.graphicsQuality !== 'low';
    const shadowRes = settings.data.graphicsQuality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(shadowRes, shadowRes);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 130;
    // Relleno desde el cielo y rebote cálido desde el suelo. Va más bajo que
    // antes: un relleno fuerte levanta las sombras hasta borrarlas, y sin
    // sombras no hay volumen.
    this.scene.add(
      this.sun, this.sun.target,
      new THREE.HemisphereLight(mapDef.ambientColor ?? horizon, '#5a4c33', 0.82),
      new THREE.AmbientLight('#ffffff', 0.10),
    );
    this.map = buildMapMeshes(layout, mapDef);
    this.scene.add(this.map.root);
    this.scene.add(this.effects.group, this.bombMesh);
    // Si el jugador dejó la cámara en tercera persona, su personaje tiene que
    // existir ya al entrar, no al primer fotograma.
    this.ensureSelfEntity();
    this.engine.renderer.shadowMap.enabled = settings.data.graphicsQuality !== 'low';
    this.engine.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // ACES comprime las altas luces en vez de quemarlas. Sin esto el cielo y
    // las caras al sol se van a blanco plano y la imagen pierde el color.
    this.engine.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.engine.renderer.toneMappingExposure = 1.22;
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
    const st = $(this.net.room!.state as unknown as { players: Map<string, PlayerSnapshot>; projectiles: Map<string, ProjectileSnapshot> });
    this.unsubs.push(st.players!.onAdd((p: PlayerSnapshot, key: string) => this.onPlayerAdd(p, key), true));
    this.unsubs.push(st.players!.onRemove((_p: PlayerSnapshot, key: string) => this.onPlayerRemove(key)));
    this.unsubs.push(st.projectiles!.onAdd((p: ProjectileSnapshot, key: string) => this.onProjectileAdd(p, key), true));
    this.unsubs.push(st.projectiles!.onRemove((_p: ProjectileSnapshot, key: string) => this.onProjectileRemove(key)));
    this.net.room!.onStateChange(() => this.onStateChange());
    this.net.room!.onLeave((code) => { if (!this.disposed && code !== 1000) { this.hud.showToast(t('disconnected'), 4000); setTimeout(() => this.leave(), 1500); } });
    this.bindMessages();

    // Arrancar la cámara donde el servidor ha colocado al jugador. Sin esto el
    // primer fotograma (y toda la espera de la fase 'waiting') se mira desde el
    // origen del mundo, que en casi cualquier mapa cae dentro del suelo.
    const me = this.me;
    if (me) {
      this.prediction.teleport(me.x, me.y, me.z);
      this.input.yaw = me.yaw;
      this.input.pitch = 0;
      this.wasAlive = me.alive;
    }

    audio.ensure();
    audio.setVolumes(settings.data.masterVolume, settings.data.sfxVolume, settings.data.musicVolume);
    audio.stopMusic();
    this.resize(window.innerWidth, window.innerHeight);
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
    on<RoundStartPayload>(ServerMessage.RoundStart, (m) => {
      this.hud.showBanner(`Ronda ${m.round}`, this.mode.economy ? 'Compra tu equipo (B)' : '');
      this.closeBuyMenu();
    });
    on<RoundEndPayload>(ServerMessage.RoundEnd, (m) => {
      const me = this.me;
      const won = !!me && m.winner === me.team;
      const winnerName = m.winner === 'draw' ? 'Empate' : `Ganan ${BRANDING.teams[m.winner].name}`;
      this.hud.showBanner(me && me.team !== 'spectator' ? (won ? t('roundWon') : t('roundLost')) : winnerName,
                          ROUND_END_TEXTS[m.reason] ?? '', 4000);
      if (won) audio.roundWin(); else audio.roundLose();
    });
    on<MatchEndPayload>(ServerMessage.MatchEnd, (m) => {
      const name = m.winner === 'A' || m.winner === 'B' ? BRANDING.teams[m.winner].name : m.winner === 'draw' ? 'Empate' : (this.state.players.get(m.winner)?.nickname ?? '');
      this.hud.showBanner('Fin de la partida', m.winner === 'draw' ? 'Empate' : `Victoria: ${name}`, 8000);
    });
    on(ServerMessage.BombPlanted, () => { this.hud.showBanner(t('bombPlanted'), '', 2500); audio.bombPlanted(); });
    on(ServerMessage.BombDefused, () => { this.hud.showBanner(t('bombDefused'), '', 2500); audio.bombDefused(); });
    on<BombExplodedPayload>(ServerMessage.BombExploded, (m) => { this.effects.explosion(new THREE.Vector3(m.x, m.y + 0.5, m.z)); audio.explosion(m); });
    on<ExplosionPayload>(ServerMessage.Explosion, (m) => { this.effects.explosion(new THREE.Vector3(m.x, m.y, m.z)); audio.explosion(m); });
    on<SmokePayload>(ServerMessage.Smoke, (m) => this.effects.smoke(new THREE.Vector3(m.x, m.y, m.z), m.duration));
    on<ChatBroadcast>(ServerMessage.Chat, (m) => { const p = this.state.players.get(m.from); this.hud.addChat(m.nickname, p?.team ?? '', m.text, m.team); });
    on<EmoteBroadcast>(ServerMessage.Emote, (m) => this.remotes.get(m.playerId)?.entity.playEmote(m.emote));
    on<InspectBroadcast>(ServerMessage.Inspect, (m) => {
      if (m.playerId === this.net.sessionId) this.selfEntity?.playInspect();
      else this.remotes.get(m.playerId)?.entity.playInspect();
    });
    on<ErrorPayload>(ServerMessage.Error, (m) => {
      this.hud.showToast(ERROR_TEXTS[m.code] ?? m.code);
      audio.empty();
    });
  }

  // ------------------------------------------------------------------ jugadores
  private onPlayerAdd(p: PlayerSnapshot, key: string): void {
    if (key === this.net.sessionId) return;
    const entity = new PlayerEntity(p.nickname, p.team);
    this.scene.add(entity.root);
    this.remotes.set(key, { entity, buffer: new InterpolationBuffer(), lastAlive: p.alive });
  }

  /**
   * En tercera persona hay que dibujar también al jugador local, que en
   * primera persona no existe como personaje (solo están las manos).
   */
  private ensureSelfEntity(): void {
    if (!this.thirdPerson) {
      if (this.selfEntity) {
        this.scene.remove(this.selfEntity.root);
        this.selfEntity.dispose();
        this.selfEntity = null;
      }
      return;
    }
    if (this.selfEntity) return;
    const me = this.me;
    this.selfEntity = new PlayerEntity(me?.nickname ?? '', me?.team ?? 'FFA');
    // Sin etiqueta de nombre sobre uno mismo: estorba la mira.
    this.selfEntity.setNameTag('', me?.team ?? 'FFA');
    this.scene.add(this.selfEntity.root);
  }

  toggleThirdPerson(): void {
    this.thirdPerson = !this.thirdPerson;
    settings.set('thirdPerson', this.thirdPerson);
    this.ensureSelfEntity();
    this.hud.showToast(this.thirdPerson ? 'Cámara en tercera persona' : 'Cámara en primera persona');
  }

  private onPlayerRemove(key: string): void {
    const r = this.remotes.get(key);
    if (!r) return;
    this.scene.remove(r.entity.root);
    r.entity.dispose();
    this.remotes.delete(key);
  }

  private onProjectileAdd(p: ProjectileSnapshot, key: string): void {
    const isSmoke = WEAPONS[p.weaponId as WeaponId]?.damage === 0;
    const m = new THREE.Mesh(this.projectileGeo, isSmoke ? this.projectileMats.smoke : this.projectileMats.frag);
    m.position.set(p.x, p.y, p.z);
    this.scene.add(m);
    this.projectiles.set(key, m);
  }

  private onProjectileRemove(key: string): void {
    const m = this.projectiles.get(key);
    if (!m) return;
    this.scene.remove(m);
    this.projectiles.delete(key);
  }

  /**
   * Coloca la cámara por detrás y al hombro del jugador. El brazo se acorta si
   * hay geometría en medio, usando el MISMO mundo de física que la partida:
   * así la cámara nunca atraviesa un muro ni deja ver a través de él.
   */
  private placeThirdPersonCamera(pos: { x: number; y: number; z: number }, eye: number, dt: number): void {
    const pivot = new THREE.Vector3(pos.x, pos.y + eye, pos.z);
    const back = new THREE.Vector3(0, 0, 1).applyEuler(this.camera.rotation);
    const rightward = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
    const offset = rightward.clone().multiplyScalar(THIRD_PERSON.shoulder)
      .add(new THREE.Vector3(0, THIRD_PERSON.height, 0));

    // Los rayos salen SIEMPRE del pivote (el centro del jugador), no del
    // hombro: si el hombro ya está dentro de un muro, el rayo nace al otro
    // lado y la cámara se cuela dentro de la pared.
    const probe = (dir: THREE.Vector3, max: number): number => {
      const hit = this.physics.raycastMap(
        { x: pivot.x, y: pivot.y, z: pivot.z },
        { x: dir.x, y: dir.y, z: dir.z },
        max + THIRD_PERSON.margin,
      );
      return hit ? Math.max(0, hit.distance - THIRD_PERSON.margin) : max;
    };

    // Primero se comprueba el desplazamiento al hombro, y después el brazo
    // hacia atrás desde donde de verdad haya quedado el ancla.
    const offLen = offset.length();
    let shoulderK = 1;
    if (offLen > 1e-4) {
      shoulderK = Math.min(1, probe(offset.clone().divideScalar(offLen), offLen) / offLen);
    }
    const realAnchor = pivot.clone().addScaledVector(offset, shoulderK);
    const fromAnchor = this.physics.raycastMap(
      { x: realAnchor.x, y: realAnchor.y, z: realAnchor.z },
      { x: back.x, y: back.y, z: back.z },
      THIRD_PERSON.distance + THIRD_PERSON.margin,
    );
    const wanted = fromAnchor
      ? Math.max(0.30, fromAnchor.distance - THIRD_PERSON.margin)
      : THIRD_PERSON.distance;

    // Acercarse al muro es inmediato; alejarse, suave. Al revés se ve el
    // interior de las paredes durante un instante.
    this.camBoom = wanted < this.camBoom
      ? wanted
      : this.camBoom + (wanted - this.camBoom) * Math.min(1, dt * 6);
    this.camera.position.copy(realAnchor).addScaledVector(back, this.camBoom);

    // Con la cámara muy pegada al jugador, su propio cuerpo tapa la pantalla.
    if (this.selfEntity) this.selfEntity.root.visible = this.camBoom > 0.55;
  }

  private onStateChange(): void {
    // `onStateChange` de colyseus.js no se puede dar de baja: puede llegar un
    // último patch cuando la escena ya está destruida.
    if (this.disposed || !this.net.room) return;
    const now = performance.now();
    const me = this.me;
    if (me) {
      this.prediction.reconcile(me, me.weaponId);
      if (me.ammoMag !== this.lastServerMag) { this.lastServerMag = me.ammoMag; this.predictedMag = me.ammoMag; }
    }
    for (const [id, r] of this.remotes) {
      const p = this.state.players.get(id);
      if (!p) continue;
      // Al reaparecer el jugador salta a otro punto del mapa: sin vaciar el
      // buffer se le vería recorrer el mapa en línea recta hasta su spawn.
      if (p.alive && !r.lastAlive) r.buffer.reset();
      r.lastAlive = p.alive;
      r.buffer.push({ t: now, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch });
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
    if (code === b.inspect) { this.inspectWeapon(); return true; }
    return;
  }

  /** Mirarse el arma. Local al instante y avisando para que lo vean los demás. */
  private inspectWeapon(): void {
    const me = this.me;
    if (!me?.alive) return;
    this.viewModel.inspect();
    this.net.send(ClientMessage.Inspect);
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
    if (!me || !this.shopOpen) {
      this.hud.showToast(this.mode.economy ? 'La tienda solo abre al inicio de la ronda' : 'Este modo no tiene tienda');
      return;
    }
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
    // Al salir de la sala la escena sigue viva un par de fotogramas hasta que
    // el menú la sustituye: sin sala no hay estado que leer.
    if (!this.net.room) return;
    const me = this.me;
    const now = performance.now();
    const showScoreboard = this.input.isDown('scoreboard') || this.phase === 'ended';
    if (me && me.alive && !this.wasAlive) {
      this.prediction.teleport(me.x, me.y, me.z);
      this.input.yaw = me.yaw; this.input.pitch = 0;
      this.hud.setDeath(false);
    }
    if (me && !me.alive && this.wasAlive) {
      this.viewModel.cancel();
      this.hud.setDeath(true, this.mode.respawn ? `Reapareces en ${this.mode.respawnDelay} s` : 'Espera a la siguiente ronda');
    }
    this.wasAlive = !!me?.alive;
    if (me && this.phase === 'waiting') this.hud.setDeath(false);

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
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.input.yaw;
    this.camera.rotation.x = this.input.pitch;
    if (this.thirdPerson) this.placeThirdPersonCamera(pos, targetEye, dt);
    else this.camera.position.set(pos.x, pos.y + targetEye, pos.z);
    audio.listener = { x: pos.x, y: pos.y, z: pos.z, yaw: this.input.yaw };
    this.sun.target.position.set(pos.x, 0, pos.z);
    this.sun.position.set(pos.x + 38, 34, pos.z + 26);
    this.sun.target.updateMatrixWorld();

    // Disparo / recarga / cambio de arma (por frame)
    if (me && me.alive && this.input.enabled) this.handleCombat(me, now);
    const speed = Math.hypot(this.prediction.kin.vx, this.prediction.kin.vz);
    const mdx = this.input.yaw - this.lastMouse.yaw, mdy = this.input.pitch - this.lastMouse.pitch;
    this.lastMouse = { yaw: this.input.yaw, pitch: this.input.pitch };
    this.viewModel.update(dt, speed, this.prediction.kin.grounded, mdx, mdy);
    // En tercera persona las manos de primera persona estorban.
    this.viewModel.root.visible = !!me?.alive && !this.thirdPerson;
    if (this.thirdPerson && this.selfEntity) {
      this.selfEntity.update(dt, {
        x: pos.x, y: pos.y, z: pos.z,
        yaw: this.input.yaw, pitch: this.input.pitch,
        speed, grounded: this.prediction.kin.grounded,
        crouching: this.prediction.kin.crouching,
        alive: !!me?.alive, weaponId: me?.weaponId ?? '',
        reloading: !!me?.reloading, hasBomb: !!me?.hasBomb,
        team: me?.team ?? 'FFA',
      });
    }
    this.viewModel.setWeapon(me?.weaponId ?? '');
    if (me?.alive && this.prediction.kin.grounded && speed > 1 && now - this.lastFootstep > 380 / Math.max(1, speed / 5)) { this.lastFootstep = now; audio.footstep(); }

    // Remotos
    for (const [id, r] of this.remotes) {
      const p = this.state.players.get(id);
      if (!p) continue;
      const s = r.buffer.sample(now);
      const pose = s ?? { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, speed: 0 };
      // Un jugador que acaba de entrar y todavía no ha aparecido no tiene sitio
      // en el mundo: antes se dibujaba su cadáver en el origen del mapa.
      r.entity.root.visible = p.spawned && p.connected && p.team !== 'spectator';
      r.entity.update(dt, { ...pose, grounded: p.grounded, crouching: p.crouching, alive: p.alive, reloading: p.reloading, weaponId: p.weaponId, hasBomb: p.hasBomb, team: p.team });
      if (pose.speed > 1 && p.alive && p.grounded && Math.random() < dt * 2.5) audio.footstep(pose);
    }

    // Bomba en el mundo
    const bs = this.bombState;
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

  private fixedStep(me: PlayerSnapshot | undefined): void {
    if (!me || !me.alive || !this.net.room) return;
    const frozen = this.phase === 'freeze' || this.phase === 'postround' || this.phase === 'ended';
    const canMove = this.input.enabled && !frozen;
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

  private handleCombat(me: PlayerSnapshot, now: number): void {
    const w = WEAPONS[me.weaponId as WeaponId];
    // Cambio de arma
    if (this.input.wasPressed('toggleCamera')) this.toggleThirdPerson();
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
      this.viewModel.startReload();
      audio.reload();
    }
    // Interactuar (plantar / desactivar)
    const holding = this.input.isDown('interact');
    if (holding !== this.interactHeld) { this.interactHeld = holding; this.net.send(ClientMessage.Interact, { active: holding }); }

    // Disparo
    const live = this.phase === 'live' || this.phase === 'warmup';
    if (!w || !live || me.reloading) return;
    const wantFire = w.automatic ? this.input.isDown('fire') : this.input.wasPressed('fire');
    if (!wantFire) return;
    if (now - this.lastFire < 1000 / w.fireRate) return;
    if (w.category !== 'grenade' && w.magazineSize > 0 && this.predictedMag <= 0) { this.lastFire = now; audio.empty(); this.net.send(ClientMessage.Reload); this.viewModel.startReload(); return; }
    this.lastFire = now;
    if (w.category !== 'grenade' && w.magazineSize > 0) this.predictedMag--;
    this.net.send(ClientMessage.Fire, { yaw: this.input.yaw, pitch: this.input.pitch });
    this.viewModel.fire();
    audio.gunshot(me.weaponId);
    // Trazador local inmediato
    if (w.category !== 'grenade') {
      const dir = directionFromAngles(this.input.yaw, this.input.pitch);
      const eye = this.camera.position.clone();
      const hit = this.physics.raycastMap(eye, dir, w.category === 'knife' ? w.range : TRACER_RANGE);
      const end = hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : eye.clone().addScaledVector(new THREE.Vector3(dir.x, dir.y, dir.z), TRACER_RANGE);
      const muzzle = eye.clone().add(new THREE.Vector3(0, -0.15, 0)).addScaledVector(new THREE.Vector3(dir.x, dir.y, dir.z), 0.6);
      if (w.category !== 'knife') { this.effects.tracer(muzzle, end); this.effects.muzzleFlash(muzzle); }
    }
  }

  private updateHud(me: PlayerSnapshot | undefined, dt: number, showScoreboard: boolean): void {
    const st = this.state;
    const f = this.hud.tickFps(dt);
    if (f !== null) this.fps = f;
    this.hud.setPing(me?.ping ?? 0, this.fps, settings.data.showFps);
    this.hud.setScore(st.scoreA, st.scoreB, this.mode.teams);
    this.hud.setTimer(st.timer, this.phase, st.round, this.bombState === 'planted', st.bombTimer);
    if (me) {
      this.hud.setVitals(me.health, me.armor);
      this.hud.setWeapon(me.weaponId, this.predictedMag >= 0 ? this.predictedMag : me.ammoMag, me.ammoReserve, me.reloading, me.grenadeIds);
      this.hud.setMoney(me.money, this.mode.economy);
      this.hud.setProgress(me.interactProgress > 0 ? me.interactProgress : null);
      // La caja suena cuando el dinero baja: es la única señal de que el
      // servidor aceptó la compra (si la rechaza llega un error, no un cobro).
      if (this.lastMoney >= 0 && me.money < this.lastMoney) audio.buy();
      this.lastMoney = me.money;
      this.hud.setHint(this.buildHint(me));
      if (this.buyMenu.visible) this.buyMenu.render(me.money, me.team);
    }
    if (showScoreboard) {
      const rows = [...st.players.values()].map((p) => ({
        id: p.id, nickname: p.nickname, team: p.team, kills: p.kills, deaths: p.deaths,
        assists: p.assists, ping: p.ping, alive: p.alive, connected: p.connected,
      }));
      this.hud.setScoreboard(true, rows, this.net.sessionId, this.mode.teams,
                             MAPS[st.mapId as MapId]?.displayName ?? st.mapId, this.mode.displayName);
    } else {
      this.hud.setScoreboard(false, [], this.net.sessionId, this.mode.teams, '', '');
    }
  }

  /** Lo que el jugador tiene que hacer ahora mismo, en una línea. */
  private buildHint(me: PlayerSnapshot): string | null {
    const st = this.state;
    const bindings = settings.data.bindings;
    const keyName = (code: string) => code.replace('Key', '');
    if (this.phase === 'waiting') {
      const ready = [...st.players.values()].filter((x) => x.connected && x.team !== 'spectator').length;
      return `Esperando jugadores (${ready}/${this.mode.minPlayers})${st.code ? ' · Código: ' + st.code : ''}`;
    }
    if (!me.alive) return null;
    const p = this.prediction.kin;
    const at = { x: p.x, y: p.y, z: p.z };
    if (this.phase === 'live' && this.mode.bomb) {
      const sites = this.physics.layout.bombsites;
      if (me.hasBomb && (pointInZone(at, sites.A) || pointInZone(at, sites.B))) {
        return `Mantén ${keyName(bindings.interact)} para plantar la bomba`;
      }
      if (me.team === 'A' && this.bombState === 'planted'
        && Math.hypot(p.x - st.bombX, p.z - st.bombZ) < DEFUSE_RADIUS) {
        return `Mantén ${keyName(bindings.interact)} para desactivar`;
      }
    }
    if (this.shopOpen && !this.buyMenu.visible) return `Pulsa ${keyName(bindings.buyMenu)} para comprar`;
    return null;
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Libera TODO lo que la escena ha creado. Sin esto, cada partida dejaba en la
   * GPU el mapa, los efectos y las mallas de los proyectiles de la anterior, y
   * la memoria de vídeo crecía cada vez que se volvía al menú.
   */
  dispose(): void {
    this.disposed = true;
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.engine.canvas.removeEventListener('click', this.onCanvasClick);
    this.input.onKeyDown = null;
    this.input.enabled = true;
    this.input.exitPointerLock();
    for (const r of this.remotes.values()) r.entity.dispose();
    this.remotes.clear();
    if (this.selfEntity) { this.selfEntity.dispose(); this.selfEntity = null; }
    for (const key of [...this.projectiles.keys()]) this.onProjectileRemove(key);
    this.projectileGeo.dispose();
    this.projectileMats.frag.dispose();
    this.projectileMats.smoke.dispose();
    this.bombMesh.geometry.dispose();
    (this.bombMesh.material as THREE.Material).dispose();
    this.viewModel.dispose();
    this.effects.dispose();
    this.map?.dispose();
    this.map = null;
    disposeSharedProps();
    this.hud.destroy();
    this.buyMenu.root.remove();
    this.pause.root.remove();
    this.prediction.dispose();
    this.physics.free();
    this.scene.clear();
  }
}
