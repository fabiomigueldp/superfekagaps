import { GameState } from '../constants';
import { AudioEngine } from './AudioEngine';
import { MUSIC_TRACKS, MusicTrackId } from './audioCatalog';
import { decideMusic, MusicDecision, MusicSnapshot } from './MusicPolicy';

export interface MusicContext {
  levelId: string | null;
  isBossLevel: boolean;
  playerAlive: boolean;
  powerupActive: boolean;
  gameState: GameState;
  deliciaMode?: boolean;
}

export class MusicManager {
  private engine: AudioEngine;
  private currentTrackId: MusicTrackId | null = null;
  private desiredTrackId: MusicTrackId | null = null;
  private baseTrackId: MusicTrackId | null = null;
  private overrideTrackId: MusicTrackId | null = null;
  private triggerTrackId: MusicTrackId | null | undefined = undefined;
  private levelId: string | null = null;
  private pendingTrackId: MusicTrackId | null = null;
  private requestToken = 0;
  private lastPowerupActive: boolean = false;
  private isPaused: boolean = false;
  private decision: MusicDecision | null = null;
  private deliciaMode: boolean = false; // estado atual do modo Delícia (propagado de onStateChange)

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  onStateChange(prevState: GameState, nextState: GameState, context: MusicContext): void {
    const levelChanged = this.levelId !== context.levelId;
    if (levelChanged || (nextState !== GameState.PLAYING && nextState !== GameState.PAUSED)) {
      this.triggerTrackId = undefined;
    }
    this.levelId = context.levelId;
    if (nextState === GameState.PAUSED) {
      this.isPaused = true;
      this.engine.setMusicVolume(0.2, 200);
      return;
    }

    if (prevState === GameState.PAUSED && nextState === GameState.PLAYING) {
      this.isPaused = false;
      this.engine.setMusicVolume(1, 200);
    }

    if (levelChanged || nextState !== GameState.PLAYING) {
      this.overrideTrackId = null;
      this.lastPowerupActive = false;
      this.pendingTrackId = null;
    }

    const snapshot: MusicSnapshot = {
      gameState: nextState,
      isBossLevel: context.isBossLevel,
      isDead: !context.playerAlive,
      powerupActive: context.powerupActive,
      deliciaMode: !!context.deliciaMode
    };

    this.deliciaMode = !!context.deliciaMode;

    this.decision = decideMusic(snapshot);
    this.baseTrackId = this.decision.trackId;
    this.applyDesiredTrack();
  }

  onPlayerDeathStart(): void {
    this.engine.setMusicVolume(0.1, 200);
  }

  onRespawn(): void {
    if (!this.isPaused) {
      this.engine.setMusicVolume(1, 300);
    }
    this.applyDesiredTrack();
  }

  onPowerupStart(): void {
    this.overrideTrackId = this.deliciaMode ? 'powerup_delicia' : 'powerup';
    this.applyDesiredTrack();
  }

  onPowerupEnd(): void {
    this.overrideTrackId = null;
    this.applyDesiredTrack();
  }

  update(deltaTime: number, snapshot: MusicSnapshot): void {
    void deltaTime;
    const powerupActive = snapshot.powerupActive;
    if (powerupActive !== this.lastPowerupActive) {
      if (powerupActive) {
        this.onPowerupStart();
      } else {
        this.onPowerupEnd();
      }
      this.lastPowerupActive = powerupActive;
    }

    if (this.desiredTrackId && this.desiredTrackId !== this.currentTrackId) {
      this.applyDesiredTrack();
    }
  }

  refresh(snapshot: MusicSnapshot): void {
    this.decision = decideMusic(snapshot);
    this.baseTrackId = this.decision.trackId;
    this.applyDesiredTrack();
  }

  applyLevelTrigger(trackId: string, action: 'PLAY' | 'STOP'): boolean {
    if (action === 'PLAY' && !Object.prototype.hasOwnProperty.call(MUSIC_TRACKS, trackId)) return false;
    this.triggerTrackId = action === 'STOP' ? null : trackId as MusicTrackId;
    this.applyDesiredTrack();
    return true;
  }

  stopAll(fadeOutMs: number): void {
    this.requestToken++;
    this.currentTrackId = null;
    this.desiredTrackId = null;
    this.baseTrackId = null;
    this.overrideTrackId = null;
    this.triggerTrackId = undefined;
    this.pendingTrackId = null;
    this.engine.stopMusic({ fadeOutMs });
  }

  private applyDesiredTrack(): void {
    const desired = this.triggerTrackId !== undefined ? this.triggerTrackId : this.overrideTrackId ?? this.baseTrackId;
    this.desiredTrackId = desired;

    if (!this.desiredTrackId) {
      this.requestToken++;
      this.pendingTrackId = null;
      const fadeOutMs = this.decision?.fadeOutMs ?? 300;
      this.engine.stopMusic({ fadeOutMs });
      this.currentTrackId = null;
      return;
    }

    if (this.currentTrackId === this.desiredTrackId && !this.pendingTrackId) {
      return;
    }

    if (this.pendingTrackId === this.desiredTrackId) {
      return;
    }

    const crossfadeMs = this.decision?.crossfadeMs ?? 500;
    const trackId = this.desiredTrackId;
    if (!this.currentTrackId) {
      const fadeInMs = this.decision?.fadeInMs ?? 400;
      if (!this.engine.ensureReady()) return;
      const request = ++this.requestToken;
      this.pendingTrackId = trackId;
      void this.engine.playMusic(trackId, { fadeInMs }).then(started => {
        if (request !== this.requestToken) return;
        this.pendingTrackId = null;
        if (started) {
          this.currentTrackId = trackId;
        }
      });
      return;
    }

    if (!this.engine.ensureReady()) return;
    const request = ++this.requestToken;
    this.pendingTrackId = trackId;
    void this.engine.crossfadeTo(trackId, { durationMs: crossfadeMs }).then(started => {
      if (request !== this.requestToken) return;
      this.pendingTrackId = null;
      if (started) {
        this.currentTrackId = trackId;
      }
    });
  }
}
