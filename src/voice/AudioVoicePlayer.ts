import { AudioEngine } from '../engine/AudioEngine';
import { VoiceClip, VoiceQueueItem } from './VoiceManifest';

export type VoiceClipEndReason = 'ended' | 'stopped' | 'error';

export interface VoicePlaybackCallbacks {
  onClipStart?: (clip: VoiceClip) => void;
  onClipEnd?: (clip: VoiceClip, info: { reason: VoiceClipEndReason; hasNext: boolean; nextGapMs: number }) => void;
  onQueueComplete?: (info: { reason: VoiceClipEndReason }) => void;
}

export class AudioVoicePlayer {
  private audioEngine: AudioEngine;
  private callbacks: VoicePlaybackCallbacks;
  private queue: VoiceQueueItem[] = [];
  private currentItem: VoiceQueueItem | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private pendingGapMs: number = 0;
  private fallbackRemainingMs: number = 0;
  private usingFallback: boolean = false;
  private playToken: number = 0;
  private bufferCache = new Map<string, AudioBuffer>();
  private warnedDurationIds = new Set<string>();
  private durationWarningThresholdSec: number;

  constructor(
    audioEngine: AudioEngine,
    callbacks: VoicePlaybackCallbacks = {},
    options: { durationWarningThresholdSec?: number } = {}
  ) {
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
    this.durationWarningThresholdSec = options.durationWarningThresholdSec ?? 0.15;
  }

  setCallbacks(callbacks: VoicePlaybackCallbacks): void {
    this.callbacks = callbacks;
  }

  update(deltaMs: number): void {
    if (this.usingFallback) {
      this.fallbackRemainingMs -= deltaMs;
      if (this.fallbackRemainingMs <= 0) {
        this.usingFallback = false;
        this.handleClipEnd('ended');
      }
    }

    if (!this.currentItem && this.queue.length > 0) {
      if (this.pendingGapMs > 0) {
        this.pendingGapMs -= deltaMs;
      }
      if (this.pendingGapMs <= 0) {
        this.startNextClip();
      }
    }
  }

  playQueue(items: VoiceQueueItem[]): void {
    this.stopInternal('stopped', true);
    this.queue = items.slice();
    this.pendingGapMs = 0;
    this.startNextClip();
  }

  stop(reason: VoiceClipEndReason = 'stopped'): void {
    this.stopInternal(reason, false);
  }

  private stopInternal(reason: VoiceClipEndReason, silent: boolean): void {
    const hadWork = this.currentItem || this.queue.length > 0 || this.usingFallback;
    this.playToken++;
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch {
        // Ignorar stop redundante
      }
    }
    this.currentSource = null;
    this.queue = [];
    this.pendingGapMs = 0;
    this.usingFallback = false;
    this.fallbackRemainingMs = 0;

    const clip = this.currentItem?.clip ?? null;
    this.currentItem = null;

    if (!silent && hadWork) {
      if (clip) {
        this.callbacks.onClipEnd?.(clip, { reason, hasNext: false, nextGapMs: 0 });
      }
      this.callbacks.onQueueComplete?.({ reason });
    }
  }

  private startNextClip(): void {
    const next = this.queue.shift();
    if (!next) return;
    this.currentItem = next;
    this.startClip(next.clip, this.playToken);
  }

  private startClip(clip: VoiceClip, token: number): void {
    if (!this.audioEngine.ensureReady()) {
      this.startFallback(clip);
      return;
    }
    const ctx = this.audioEngine.getContext();
    const sfxGain = this.audioEngine.getSfxDestination();
    if (!ctx || !sfxGain) {
      this.startFallback(clip);
      return;
    }

    this.loadBuffer(clip.url).then(buffer => {
      if (token !== this.playToken) return;
      if (!buffer) {
        this.startFallback(clip);
        return;
      }

      this.validateDuration(clip, buffer.duration);

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(sfxGain);
      source.onended = () => {
        if (token !== this.playToken) return;
        this.handleClipEnd('ended');
      };
      source.start();

      this.currentSource = source;
      this.callbacks.onClipStart?.(clip);
    }).catch(() => {
      if (token !== this.playToken) return;
      this.startFallback(clip);
    });
  }

  private startFallback(clip: VoiceClip): void {
    const durationSec = clip.expectedDurationSec ?? 0;
    if (durationSec <= 0) {
      this.handleClipEnd('error');
      return;
    }
    this.usingFallback = true;
    this.fallbackRemainingMs = durationSec * 1000;
    this.callbacks.onClipStart?.(clip);
  }

  private handleClipEnd(reason: VoiceClipEndReason): void {
    if (!this.currentItem) return;

    const finishedItem = this.currentItem;
    const hasNext = this.queue.length > 0;
    const nextGapMs = hasNext ? finishedItem.gapAfterMs : 0;

    this.currentItem = null;
    this.currentSource = null;
    this.usingFallback = false;
    this.fallbackRemainingMs = 0;

    this.callbacks.onClipEnd?.(finishedItem.clip, {
      reason,
      hasNext,
      nextGapMs
    });

    if (!hasNext) {
      this.callbacks.onQueueComplete?.({ reason });
      return;
    }

    this.pendingGapMs = nextGapMs;
    if (this.pendingGapMs <= 0) {
      this.startNextClip();
    }
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url) ?? null;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const ctx = this.audioEngine.getContext();
      if (!ctx) return null;
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, buffer);
      return buffer;
    } catch (e) {
      console.warn('[Voice] Failed to load audio buffer:', url, e);
      return null;
    }
  }

  private validateDuration(clip: VoiceClip, actualDurationSec: number): void {
    const expected = clip.expectedDurationSec;
    if (!expected || this.warnedDurationIds.has(clip.id)) return;
    const diff = Math.abs(actualDurationSec - expected);
    if (diff > this.durationWarningThresholdSec) {
      console.warn(
        `[Voice] Duration mismatch for ${clip.id}: expected ${expected.toFixed(2)}s, got ${actualDurationSec.toFixed(2)}s`
      );
      this.warnedDurationIds.add(clip.id);
    }
  }
}
