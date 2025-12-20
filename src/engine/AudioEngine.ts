import { MASTER_VOLUME } from '../constants';
import { MUSIC_TRACKS, MusicTrackConfig, MusicTrackId } from './audioCatalog';

export interface MusicPlayOptions {
  loop?: boolean;
  fadeInMs?: number;
}

export interface MusicCrossfadeOptions {
  durationMs: number;
}

export interface MusicStopOptions {
  fadeOutMs?: number;
}

export interface MusicDuckOptions {
  duckLevel: number;
  duckMs: number;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private enabled: boolean = true;

  private bufferCache = new Map<string, AudioBuffer>();
  private currentMusic: {
    trackId: MusicTrackId | null;
    source: AudioBufferSourceNode | null;
    gain: GainNode | null;
  } = { trackId: null, source: null, gain: null };

  private visibilityHandlerBound = false;

  isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? MASTER_VOLUME : 0;
    }
    return this.enabled;
  }

  ensureReady(): boolean {
    if (!this.audioContext) {
      this.initContext();
    }
    if (!this.audioContext) return false;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        // Unlock can fail until user gesture.
      });
    }
    return this.audioContext.state === 'running';
  }

  getContext(): AudioContext | null {
    return this.audioContext;
  }

  getSfxDestination(): GainNode | null {
    return this.sfxGain;
  }

  setMusicVolume(volume: number, fadeMs: number): void {
    if (!this.audioContext || !this.musicGain) return;
    const now = this.audioContext.currentTime;
    const target = Math.max(0, Math.min(volume, 1));
    this.musicGain.gain.cancelScheduledValues(now);
    if (fadeMs <= 0) {
      this.musicGain.gain.setValueAtTime(target, now);
      return;
    }
    const duration = fadeMs / 1000;
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(target, now + duration);
  }

  duckMusic(options: MusicDuckOptions): void {
    if (!this.audioContext || !this.duckGain) return;
    const now = this.audioContext.currentTime;
    const target = Math.max(0, Math.min(options.duckLevel, 1));
    const duration = options.duckMs / 1000;
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setValueAtTime(this.duckGain.gain.value, now);
    this.duckGain.gain.linearRampToValueAtTime(target, now + duration);
  }

  async playMusic(trackId: MusicTrackId, options: MusicPlayOptions = {}): Promise<boolean> {
    if (!this.ensureReady()) return false;
    if (!this.audioContext || !this.musicGain) return false;
    const config = this.getTrackConfig(trackId);
    if (!config) return false;

    const buffer = await this.loadBuffer(config.url);
    if (!buffer || !this.audioContext) return false;

    this.stopCurrentSource(0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? config.loop;

    const trackGain = this.audioContext.createGain();
    trackGain.gain.value = 0;
    source.connect(trackGain);
    trackGain.connect(this.musicGain);

    source.start();

    this.currentMusic = { trackId, source, gain: trackGain };

    const fadeInMs = options.fadeInMs ?? 0;
    const now = this.audioContext.currentTime;
    const targetGain = config.volume;
    if (fadeInMs <= 0) {
      trackGain.gain.setValueAtTime(targetGain, now);
      return true;
    }
    trackGain.gain.setValueAtTime(0, now);
    trackGain.gain.linearRampToValueAtTime(targetGain, now + fadeInMs / 1000);
    return true;
  }

  async crossfadeTo(trackId: MusicTrackId, options: MusicCrossfadeOptions): Promise<boolean> {
    if (!this.ensureReady()) return false;
    if (!this.audioContext || !this.musicGain) return false;
    const config = this.getTrackConfig(trackId);
    if (!config) return false;

    if (this.currentMusic.trackId === trackId && this.currentMusic.source) {
      return true;
    }

    const buffer = await this.loadBuffer(config.url);
    if (!buffer || !this.audioContext) return false;

    const now = this.audioContext.currentTime;
    const duration = Math.max(0, options.durationMs) / 1000;

    const newSource = this.audioContext.createBufferSource();
    newSource.buffer = buffer;
    newSource.loop = config.loop;

    const newGain = this.audioContext.createGain();
    newGain.gain.setValueAtTime(0, now);
    newSource.connect(newGain);
    newGain.connect(this.musicGain);
    newSource.start();

    const prevSource = this.currentMusic.source;
    const prevGain = this.currentMusic.gain;
    if (prevGain && prevSource) {
      prevGain.gain.cancelScheduledValues(now);
      prevGain.gain.setValueAtTime(prevGain.gain.value, now);
      prevGain.gain.linearRampToValueAtTime(0, now + duration);
      prevSource.stop(now + duration + 0.05);
    }

    newGain.gain.linearRampToValueAtTime(config.volume, now + duration);
    this.currentMusic = { trackId, source: newSource, gain: newGain };
    return true;
  }

  stopMusic(options: MusicStopOptions = {}): void {
    if (!this.audioContext) return;
    const fadeOutMs = options.fadeOutMs ?? 0;
    this.stopCurrentSource(fadeOutMs);
  }

  playStinger(trackId: MusicTrackId, options: MusicDuckOptions): void {
    if (!this.ensureReady()) return;
    const config = this.getTrackConfig(trackId);
    if (!config) return;
    this.loadBuffer(config.url).then(buffer => {
      if (!buffer || !this.audioContext || !this.sfxGain) return;
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      const gain = this.audioContext.createGain();
      gain.gain.value = config.volume;
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start();
      this.duckMusic(options);
      source.stop(this.audioContext.currentTime + buffer.duration + 0.1);
    });
  }

  private initContext(): void {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      this.musicGain = this.audioContext.createGain();
      this.duckGain = this.audioContext.createGain();

      this.masterGain.connect(this.audioContext.destination);
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.duckGain);
      this.duckGain.connect(this.masterGain);

      this.masterGain.gain.value = this.enabled ? MASTER_VOLUME : 0;
      this.sfxGain.gain.value = 1;
      this.musicGain.gain.value = 1;
      this.duckGain.gain.value = 1;

      this.bindVisibilityHandler();
    } catch (e) {
      console.warn('WebAudio not supported:', e);
    }
  }

  private bindVisibilityHandler(): void {
    if (this.visibilityHandlerBound || typeof document === 'undefined') return;
    this.visibilityHandlerBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.audioContext) return;
      if (document.hidden) {
        this.audioContext.suspend().catch(() => undefined);
      } else {
        this.audioContext.resume().catch(() => undefined);
      }
    });
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url) || null;
    }
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      if (!this.audioContext) return null;
      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, buffer);
      return buffer;
    } catch (e) {
      console.warn('Failed to load audio buffer:', url, e);
      return null;
    }
  }

  private getTrackConfig(trackId: MusicTrackId): MusicTrackConfig | null {
    return MUSIC_TRACKS[trackId] ?? null;
  }

  private stopCurrentSource(fadeOutMs: number): void {
    if (!this.audioContext) return;
    const { source, gain } = this.currentMusic;
    if (!source || !gain) return;
    const now = this.audioContext.currentTime;
    const duration = Math.max(0, fadeOutMs) / 1000;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    if (duration <= 0) {
      gain.gain.linearRampToValueAtTime(0, now);
      source.stop(now + 0.02);
    } else {
      gain.gain.linearRampToValueAtTime(0, now + duration);
      source.stop(now + duration + 0.05);
    }
    this.currentMusic = { trackId: null, source: null, gain: null };
  }
}
