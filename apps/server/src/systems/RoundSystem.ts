import { GAMEPLAY } from '@game/config';
import { ServerMessage, type MatchPhase, type RoundEndPayload } from '@game/shared';
import type { MatchRoom } from '../rooms/MatchRoom.js';

const ENDED_RESTART_SECONDS = 15;

/**
 * Máquina de estados de la partida.
 * bomb:      waiting → warmup → (freeze → live → postround)* → ended → waiting
 * tdm / ffa: waiting → warmup → live → ended → waiting
 */
export class RoundSystem {
  private phaseEndsAt = 0;
  private roundTimerFrozen = false;

  constructor(private readonly room: MatchRoom) {}

  get phase(): MatchPhase { return this.room.state.phase as MatchPhase; }

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
        if (now >= this.phaseEndsAt) this.goLive();
        break;
      case 'live':
        if (this.room.mode.respawn) {
          this.respawnDead(now, false);
          // El entrenamiento no compite: ni límite de puntos ni de tiempo. Sin
          // esto la sesión se cerraba sola a los pocos segundos porque un modo
          // con scoreLimit 0 lo alcanza de inmediato.
          if (this.endless) {
            this.room.state.timer = 0;
          } else {
            this.checkScoreLimit();
            if (now >= this.phaseEndsAt) this.endMatchByScore();
          }
        } else if (!this.roundTimerFrozen && now >= this.phaseEndsAt) {
          this.endRound('A', 'time');
        }
        if (playing === 0) this.setPhase('waiting', 0);
        break;
      case 'postround':
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
      this.setPhase('live', this.endless ? 0 : this.room.mode.timeLimit || 3600);
      this.room.broadcast(ServerMessage.RoundStart, { round: 1 });
    } else {
      this.nextRound();
    }
  }

  private nextRound(): void {
    const s = this.room.state;
    s.round++;
    if (s.round === GAMEPLAY.match.halftimeRound + 1) this.room.swapTeams();
    this.room.projectiles.clear();
    this.room.bomb.reset();
    this.roundTimerFrozen = false;
    for (const id of s.players.keys()) this.room.spawnPlayer(id, false);
    this.room.bomb.assignCarrier();
    this.setPhase('freeze', this.room.timings.freeze);
    this.room.broadcast(ServerMessage.RoundStart, { round: s.round });
  }

  private goLive(): void {
    this.setPhase('live', this.room.timings.roundTime);
  }

  onBombPlanted(): void {
    this.roundTimerFrozen = true;
  }

  /** Llamado por CombatSystem tras cada muerte. */
  onPlayerDied(): void {
    if (this.phase !== 'live' || this.room.mode.respawn) return;
    const s = this.room.state;
    const aliveA = [...s.players.values()].filter((p) => p.team === 'A' && p.alive).length;
    const aliveB = [...s.players.values()].filter((p) => p.team === 'B' && p.alive).length;
    if (aliveA === 0 && aliveB === 0) this.endRound(s.bombState === 'planted' ? 'B' : 'draw', 'elimination');
    else if (aliveA === 0) this.endRound('B', 'elimination');
    else if (aliveB === 0 && s.bombState !== 'planted') this.endRound('A', 'elimination');
  }

  endRound(winner: 'A' | 'B' | 'draw', reason: RoundEndPayload['reason']): void {
    if (this.phase !== 'live') return;
    const s = this.room.state;
    if (winner === 'A') s.scoreA++;
    else if (winner === 'B') s.scoreB++;
    s.lastWinner = winner;
    this.room.economy.onRoundEnd(winner);
    for (const rt of this.room.runtime.values()) { rt.interacting = false; }
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
    } else {
      for (const p of s.players.values()) if (p.kills >= mode.scoreLimit) return this.endMatch(p.id);
    }
  }

  private endMatchByScore(): void {
    const s = this.room.state;
    if (this.room.mode.teams) this.endMatch(s.scoreA === s.scoreB ? 'draw' : s.scoreA > s.scoreB ? 'A' : 'B');
    else {
      let best: { id: string; kills: number } | null = null;
      for (const p of s.players.values()) if (!best || p.kills > best.kills) best = { id: p.id, kills: p.kills };
      this.endMatch(best?.id ?? 'draw');
    }
  }

  private endMatch(winner: string): void {
    this.room.state.lastWinner = winner;
    this.room.broadcast(ServerMessage.MatchEnd, { winner });
    this.setPhase('ended', ENDED_RESTART_SECONDS);
  }

  private resetMatch(): void {
    const s = this.room.state;
    s.round = 0; s.scoreA = 0; s.scoreB = 0; s.lastWinner = '';
    for (const p of s.players.values()) { p.kills = 0; p.deaths = 0; p.assists = 0; }
    this.room.projectiles.clear();
    this.room.bomb.reset();
    this.setPhase('waiting', 0);
  }

  private respawnDead(now: number, immediate: boolean): void {
    for (const [id, rt] of this.room.runtime) {
      const p = this.room.state.players.get(id);
      if (!p || p.alive || p.team === 'spectator') continue;
      if (immediate || now >= rt.respawnAt) this.room.spawnPlayer(id, true);
    }
  }
}
