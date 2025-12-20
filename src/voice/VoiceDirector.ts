import { Vector2 } from '../types';
import { AudioVoicePlayer } from './AudioVoicePlayer';
import { SpeechBubbleController } from './SpeechBubbleController';
import { VoiceGroupEntry, VoiceLine, VoiceManifest, VoiceQueueItem } from './VoiceManifest';

export class VoiceDirector {
  private manifest: VoiceManifest;
  private player: AudioVoicePlayer;
  private bubble: SpeechBubbleController;
  private nowMs: number = 0;
  private speaking: boolean = false;
  private currentPriority: number = 0;
  private firstSeenPlayed: boolean = false;
  private hitReactCooldownUntil: number = 0;
  private ambientCooldownUntil: number = 0;
  private globalCooldownUntil: number = 0;
  private nextAmbientTickAt: number = 0;
  private recentLineIds: string[] = [];

  constructor(
    manifest: VoiceManifest,
    player: AudioVoicePlayer,
    bubble: SpeechBubbleController,
    anchorProvider: () => Vector2
  ) {
    this.manifest = manifest;
    this.player = player;
    this.bubble = bubble;
    this.bubble.setAnchorProvider(anchorProvider);
    this.player.setCallbacks({
      onClipStart: clip => {
        this.speaking = true;
        this.bubble.show(clip.text);
        this.recordHistory(clip.id);
      },
      onClipEnd: (clip, info) => {
        void clip;
        if (info.reason === 'stopped') {
          this.bubble.hide();
          return;
        }
        if (!info.hasNext || info.nextGapMs > 0) {
          this.bubble.hide();
        }
      },
      onQueueComplete: info => {
        this.speaking = false;
        this.currentPriority = 0;
        if (info.reason === 'ended') {
          this.globalCooldownUntil = this.nowMs + this.manifest.config.globalCooldownMs;
        }
      }
    });

    this.resetForEncounter();
  }

  update(deltaMs: number, options: { allowAmbient: boolean } = { allowAmbient: false }): void {
    this.nowMs += deltaMs;
    this.player.update(deltaMs);
    this.bubble.update(deltaMs);

    if (!options.allowAmbient) return;

    if (this.nowMs >= this.nextAmbientTickAt) {
      this.scheduleNextAmbientTick();
      this.tryAmbientTick();
    }
  }

  getBubbleRenderState(): ReturnType<SpeechBubbleController['getRenderState']> {
    return this.bubble.getRenderState();
  }

  onFirstSeen(): void {
    if (this.firstSeenPlayed) return;
    const group = this.manifest.groups.onFirstSeen;
    const queue = this.buildLineQueue(group.lineId);
    if (!queue.length) return;

    const started = this.startEvent(group.priority, queue, {
      bypassGlobalCooldown: group.bypassGlobalCooldown ?? false
    });
    if (started) {
      this.firstSeenPlayed = true;
    }
  }

  onDamaged(): void {
    const group = this.manifest.groups.onHitReact;
    if (this.nowMs < this.hitReactCooldownUntil) return;
    if (!this.roll(group.chance)) return;

    const lineId = this.pickWeightedLine(group.entries);
    if (!lineId) return;

    const queue = this.buildLineQueue(lineId);
    if (!queue.length) return;

    const started = this.startEvent(group.priority, queue, { bypassGlobalCooldown: false });
    if (started) {
      this.hitReactCooldownUntil = this.nowMs + group.cooldownMs;
    }
  }

  stop(): void {
    this.player.stop('stopped');
    this.bubble.hide();
    this.speaking = false;
    this.currentPriority = 0;
  }

  private resetForEncounter(): void {
    this.firstSeenPlayed = false;
    this.hitReactCooldownUntil = 0;
    this.ambientCooldownUntil = 0;
    this.globalCooldownUntil = 0;
    this.recentLineIds = [];
    this.scheduleNextAmbientTick();
  }

  private tryAmbientTick(): void {
    const group = this.manifest.groups.ambient;
    if (!this.roll(group.speakChance)) return;
    if (this.nowMs < this.ambientCooldownUntil) return;

    const useCombo = group.sequenceEntries.length > 0 && this.roll(group.comboChance);
    if (useCombo) {
      const sequenceId = this.pickWeightedSequence(group.sequenceEntries);
      if (!sequenceId) return;
      const queue = this.buildSequenceQueue(sequenceId);
      if (!queue.length) return;
      const started = this.startEvent(group.priority, queue, { bypassGlobalCooldown: false });
      if (started) {
        this.ambientCooldownUntil = this.nowMs + group.minStartCooldownMs;
      }
      return;
    }

    const lineId = this.pickWeightedLine(group.lineEntries);
    if (!lineId) return;
    const queue = this.buildLineQueue(lineId);
    if (!queue.length) return;

    const started = this.startEvent(group.priority, queue, { bypassGlobalCooldown: false });
    if (started) {
      this.ambientCooldownUntil = this.nowMs + group.minStartCooldownMs;
    }
  }

  private startEvent(
    priority: number,
    queue: VoiceQueueItem[],
    options: { bypassGlobalCooldown: boolean }
  ): boolean {
    if (!queue.length) return false;
    if (this.speaking) {
      if (priority <= this.currentPriority) {
        return false;
      }
      this.player.stop('stopped');
      this.bubble.hide();
    } else if (!options.bypassGlobalCooldown && this.nowMs < this.globalCooldownUntil) {
      return false;
    }

    this.speaking = true;
    this.currentPriority = priority;
    this.player.playQueue(queue);
    return true;
  }

  private buildLineQueue(lineId: string): VoiceQueueItem[] {
    const line = this.manifest.voiceLines[lineId];
    if (!line) {
      console.warn('[Voice] Unknown line id:', lineId);
      return [];
    }

    const clip = this.toClip(line);
    const queue: VoiceQueueItem[] = [{ clip, gapAfterMs: 0 }];

    if (line.allowImmediateRepeat && this.roll(line.immediateRepeatChance ?? 0)) {
      const gapMs = line.immediateRepeatGapMs ?? 0;
      queue[0].gapAfterMs = gapMs;
      queue.push({ clip, gapAfterMs: 0 });
    }

    return queue;
  }

  private buildSequenceQueue(sequenceId: string): VoiceQueueItem[] {
    const seq = this.manifest.sequences[sequenceId];
    if (!seq) {
      console.warn('[Voice] Unknown sequence id:', sequenceId);
      return [];
    }

    const comboGapMs = this.manifest.config.comboGapMs;
    const queue: VoiceQueueItem[] = [];

    seq.steps.forEach((lineId, idx) => {
      const line = this.manifest.voiceLines[lineId];
      if (!line) return;
      queue.push({
        clip: this.toClip(line),
        gapAfterMs: idx < seq.steps.length - 1 ? comboGapMs : 0
      });
    });

    if (!queue.length) return queue;

    if (seq.allowEncoreLastStep && this.roll(seq.encoreChance ?? 0)) {
      const last = queue[queue.length - 1];
      last.gapAfterMs = seq.encoreGapMs ?? 0;
      queue.push({ clip: last.clip, gapAfterMs: 0 });
    }

    return queue;
  }

  private toClip(line: VoiceLine): { id: string; text: string; url: string; expectedDurationSec?: number } {
    return {
      id: line.id,
      text: line.text,
      url: line.audioUrl,
      expectedDurationSec: line.expectedDurationSec
    };
  }

  private pickWeightedLine(entries: VoiceGroupEntry[]): string | null {
    const lastId = this.recentLineIds[0];
    const filtered = entries.filter(entry => entry.id !== lastId);
    const pool = filtered.length > 0 ? filtered : entries;
    return this.pickWeighted(pool);
  }

  private pickWeightedSequence(entries: VoiceGroupEntry[]): string | null {
    const lastId = this.recentLineIds[0];
    const filtered = entries.filter(entry => {
      const seq = this.manifest.sequences[entry.id];
      if (!seq || seq.steps.length === 0) return false;
      return seq.steps[0] !== lastId;
    });
    const pool = filtered.length > 0 ? filtered : entries;
    return this.pickWeighted(pool);
  }

  private pickWeighted(entries: VoiceGroupEntry[]): string | null {
    if (!entries.length) return null;
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return entries[0].id;
    let roll = Math.random() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.id;
    }
    return entries[entries.length - 1].id;
  }

  private roll(chance: number): boolean {
    if (chance <= 0) return false;
    if (chance >= 1) return true;
    return Math.random() < chance;
  }

  private scheduleNextAmbientTick(): void {
    const group = this.manifest.groups.ambient;
    const min = group.tickMinMs;
    const max = group.tickMaxMs;
    const span = Math.max(0, max - min);
    this.nextAmbientTickAt = this.nowMs + min + Math.random() * span;
  }

  private recordHistory(lineId: string): void {
    this.recentLineIds.unshift(lineId);
    if (this.recentLineIds.length > 3) {
      this.recentLineIds.length = 3;
    }
  }
}
