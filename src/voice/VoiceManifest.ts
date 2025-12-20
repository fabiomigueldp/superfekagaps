export type VoiceLineId = string;

export interface VoiceLine {
  id: VoiceLineId;
  text: string;
  audioUrl: string;
  weight?: number;
  tags?: string[];
  cooldownOverrideMs?: number;
  allowImmediateRepeat?: boolean;
  immediateRepeatChance?: number;
  immediateRepeatGapMs?: number;
  expectedDurationSec?: number;
}

export interface VoiceGroupEntry {
  id: VoiceLineId;
  weight: number;
}

export interface VoiceSequence {
  id: string;
  steps: VoiceLineId[];
  weight: number;
  allowEncoreLastStep?: boolean;
  encoreChance?: number;
  encoreGapMs?: number;
}

export interface VoiceGroupsConfig {
  onFirstSeen: {
    id: string;
    priority: number;
    lineId: VoiceLineId;
    bypassGlobalCooldown?: boolean;
  };
  onHitReact: {
    id: string;
    priority: number;
    cooldownMs: number;
    chance: number;
    entries: VoiceGroupEntry[];
  };
  ambient: {
    id: string;
    priority: number;
    tickMinMs: number;
    tickMaxMs: number;
    speakChance: number;
    minStartCooldownMs: number;
    comboChance: number;
    lineEntries: VoiceGroupEntry[];
    sequenceEntries: VoiceGroupEntry[];
  };
}

export interface VoiceSystemConfig {
  globalCooldownMs: number;
  comboGapMs: number;
  durationWarningThresholdSec: number;
}

export interface VoiceManifest {
  id: string;
  voiceLines: Record<VoiceLineId, VoiceLine>;
  sequences: Record<string, VoiceSequence>;
  groups: VoiceGroupsConfig;
  config: VoiceSystemConfig;
}

export interface VoiceClip {
  id: VoiceLineId;
  text: string;
  url: string;
  expectedDurationSec?: number;
}

export interface VoiceQueueItem {
  clip: VoiceClip;
  gapAfterMs: number;
}
