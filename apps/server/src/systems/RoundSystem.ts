import { GAMEPLAY } from '@game/config';
import {
  ServerMessage,
  type MatchEndPayload, type MatchPhase, type RoundEndPayload, type RoundStartPayload, type RoundWinner,
} from '@game/shared';
import type { MatchRoom } from '../rooms/MatchRoom.js';

/** Segundos que se queda el marcador final en pantalla antes de reiniciar. */
const ENDED_RESTART_SECONDS = 15;
/** Tope del reloj de un modo por rondas sin límite de tiempo declarado. */
const OPEN_ENDED_LIMIT = 3600;

/**
 * Máquina de estados de la partida (las transiciones, en MatchPhase).
 * Es la única que cambia `state.phase`.
 */
export class RoundSystem {
  private phaseEndsAt = 0;
  private roundTimerFrozen = false;

  constructor(private readonly room: MatchRoom) {}

  get phase(): MatchPhase { return this.room.phase; }

  /**
   * Jugadores necesarios para arrancar. El modo de entrenamiento baja a uno
   * para poder probar el juego sin esperar a nadie.
   */
  private get minPlayers(): number {
    return this.room.mode.minPlayers ?? GAMEPLAY.match.minPlayersToStart;
  }

  /** Un modo sin límite de puntos ni de tiempo no termina nunca solo. */
  private get endless(): boolean {
    return this.room.mode.scoreLimit <= 0 && this.room.mode.timeLimit <= 0;
  }

  private setPhase(phase: MatchPhase, seconds: number): void {
    this.room.state.phase = phase;
    this.phaseEndsAt = Date.now() + seconds * 1000;
    this.room.state.timer = seconds;
  }

  update(_dt: number, now: number): void {
    const s = this.room.state;
    if (!(this.phase === 'live' && this.roundTimerFrozen)) {
      s.timer = Math.max(0, (this.phaseEndsAt - now) / 1000);
    }
    const playing = this.room.playingCount();

    switch (this.phase) {
      case 'waiting':
        if (playing >= this.minPlayers) this.startWarmup();
        break;
      case 'warmup':
        if (playing < this.minPlayers) { this.setPhase('waiting', 0); break; }
        this.respawnDead(now, true);
        if (now >= this.phaseEndsAt) this.startMatch();
        break;
      case 'freeze':
        if (playing === 0) { this.resetMatch(); break; }
        if (now >= this.phaseEndsAt) this.goLive();
        break;
      case 'live':
        if (playing === 0) { this.resetMatch(); break; }
        if (this.room.mode.respawn) {
          this.respawnDead(now, false);
          // El entrenamiento no compite: ni límite de puntos ni de tiempo. Sin
          // esto la sesión se cerraba sola a los pocos segundos porque un modo
          // con scoreLimit 0 lo alcanza de inmediato.
          if (this.endless) {
            this.room.state.timer = 0;
          } else {
            this.checkScoreLimit();
            if (this.phase === 'live' && now >= this.phaseEndsAt) this.endMatchByScore();
          }
        } else if (!this.roundTimerFrozen && now >= this.phaseEndsAt) {
          // Se agota el tiempo sin plantar: gana quien defiende.
          this.endRound('A', 'time');
        }
        break;
      case 'postround':
        if (playing === 0) { this.resetMatch(); break; }
        if (now >= this.phaseEndsAt) this.nextRound();
        break;
      case 'ended':
        if (now >= this.phaseEndsAt) this.resetMatch();
        break;
    }
  }

  private startWarmup(): void {
    this.room.economy.reset();
    this.room.bomb.reset();
    this.setPhase('warmup', this.room.timings.warmup);
    for (const id of this.room.state.players.keys()) this.room.spawnPlayer(id, true);
  }

  private startMatch(): void {
    const s = this.room.state;
    s.round = 0; s.scoreA = 0; s.scoreB = 0; s.lastWinner = '';
    this.room.economy.reset();
    if (this.room.mode.respawn) {
      for (const id of s.players.keys()) this.room.spawnPlayer(id, true);
      this.setPhase('live', this.endless ? 0 : this.room.mode.timeLimit || OPEN_ENDED_LIMIT);
      s.round = 1;
      const payload: RoundStartPayload = { round: 1 };
      this.room.broadcast(ServerMessage.RoundStart, payload);
    } else {
      this.nextRound();
    }
  }

  private nextRound(): void {
    const s = this.room.state;
    s.round++;
    // El cambio de lado ocurre aquí, sin fase propia: el reloj no se para.
    if (s.round === GAMEPLAY.match.halftimeRound + 1) this.room.swapTeams();
    this.room.projectiles.clear();
    this.room.bomb.reset();
    this.roundTimerFrozen = false;
    for (const id of s.players.keys()) this.room.spawnPlayer(id, false);
    this.room.bomb.assignCarrier();
    this.setPhase('freeze', this.room.timings.freeze);
    const payload: RoundStartPayload = { round: s.round };
    this.room.broadcast(ServerMessage.RoundStart, payload);
  }

  private goLive(): void {
    this.setPhase('live', this.room.timings.roundTime);
  }

  onBombPlanted(): void {
    this.roundTimerFrozen = true;
  }

  /** Llamado tras cada muerte o retirada. Decide si la ronda ya está resuelta. */
  onPlayerDied(): void {
    if (this.phase !== 'live' || this.room.mode.respawn) return;
    const s = this.room.state;
    let aliveA = 0, aliveB = 0;
    for (const p of s.players.values()) {
      if (!p.alive || !p.connected) continue;
      if (p.team === 'A') aliveA++;
      else if (p.team === 'B') aliveB++;
    }
    const planted = s.bombState === 'planted';
    if (aliveA === 0 && aliveB === 0) this.endRound(planted ? 'B' : 'draw', 'elimination');
    else if (aliveA === 0) this.endRound('B', 'elimination');
    else if (aliveB === 0 && !planted) this.endRound('A', 'elimination');
  }

  endRound(winner: RoundWinner, reason: RoundEndPayload['reason']): void {
    if (this.phase !== 'live') return;
    const s = this.room.state;
    if (winner === 'A') s.scoreA++;
    else if (winner === 'B') s.scoreB++;
    s.lastWinner = winner;
    this.room.economy.onRoundEnd(winner);
    for (const [id, rt] of this.room.runtime) {
      rt.interacting = false;
      rt.interactStart = null;
      const p = s.players.get(id);
      if (p) p.interactProgress = 0;
    }
    const payload: RoundEndPayload = { winner, reason };
    this.room.broadcast(ServerMessage.RoundEnd, payload);
    if (s.scoreA >= GAMEPLAY.match.roundsToWin || s.scoreB >= GAMEPLAY.match.roundsToWin) {
      this.endMatch(s.scoreA > s.scoreB ? 'A' : 'B');
    } else {
      this.setPhase('postround', this.room.timings.postRound);
    }
  }

  private checkScoreLimit(): void {
    const s = this.room.state;
    const mode = this.room.mode;
    if (mode.teams) {
      if (s.scoreA >= mode.scoreLimit || s.scoreB >= mode.scoreLimit) this.endMatch(s.scoreA > s.scoreB ? 'A' : 'B');
      return;
    }
    for (const p of s.players.values()) {
      if (p.kills >= mode.scoreLimit) { this.endMatch(p.id); return; }
    }
  }

  private endMatchByScore(): void {
    const s = this.room.state;
    if (this.room.mode.teams) {
      this.endMatch(s.scoreA === s.scoreB ? 'draw' : s.scoreA > s.scoreB ? 'A' : 'B');
      return;
    }
    let best: { id: string; kills: number } | null = null;
    for (const p of s.players.values()) if (!best || p.kills > best.kills) best = { id: p.id, kills: p.kills };
    this.endMatch(best?.id ?? 'draw');
  }

  private endMatch(winner: MatchEndPayload['winner']): void {
    this.room.state.lastWinner = winner;
    const payload: MatchEndPayload = { winner };
    this.room.broadcast(ServerMessage.MatchEnd, payload);
    this.setPhase('ended', ENDED_RESTART_SECONDS);
  }

  private resetMatch(): void {
    const s = this.room.state;
    s.round = 0; s.scoreA = 0; s.scoreB = 0; s.lastWinner = '';
    for (const p of s.players.values()) { p.kills = 0; p.deaths = 0; p.assists = 0; }
    this.roundTimerFrozen = false;
    this.room.projectiles.clear();
    this.room.bomb.reset();
    this.room.economy.reset();
    this.setPhase('waiting', 0);
  }

  private respawnDead(now: number, immediate: boolean): void {
    for (const [id, rt] of this.room.runtime) {
      const p = this.room.state.players.get(id);
      if (!p || p.alive || !p.connected || p.team === 'spectator') continue;
      if (immediate || now >= rt.respawnAt) this.room.spawnPlayer(id, true);
    }
  }
}
