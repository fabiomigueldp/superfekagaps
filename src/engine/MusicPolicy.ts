import { GameState } from '../constants';
import { MusicTrackId } from './audioCatalog';

export interface MusicSnapshot {
  gameState: GameState;
  isBossLevel: boolean;
  isDead: boolean;
  powerupActive: boolean;
  deliciaMode: boolean; // Novo campo
}

export interface MusicDecision {
  trackId: MusicTrackId | null;
  crossfadeMs: number;
  fadeOutMs: number;
  fadeInMs: number;
}

export function decideMusic(snapshot: MusicSnapshot): MusicDecision {
  const base: MusicDecision = {
    trackId: null,
    crossfadeMs: 600,
    fadeOutMs: 400,
    fadeInMs: 400
  };

  // Helper para sufixo do modo delicia
  const suffix = snapshot.deliciaMode ? '_delicia' : '';
  const getTrack = (baseId: string) => (baseId + suffix) as MusicTrackId;

  if (snapshot.gameState === GameState.GAME_OVER) {
    return { ...base, trackId: null, fadeOutMs: 300 };
  }

  if (snapshot.gameState === GameState.ENDING) {
    return { ...base, trackId: getTrack('ending'), crossfadeMs: 700, fadeInMs: 600 };
  }

  if (snapshot.gameState === GameState.LEVEL_CLEAR) {
    return { ...base, trackId: null, fadeOutMs: 300 };
  }

  if (snapshot.gameState === GameState.BOSS_INTRO) {
    return { ...base, trackId: getTrack('boss'), crossfadeMs: 500, fadeInMs: 500 };
  }

  if (snapshot.gameState === GameState.PAUSED) {
    return { ...base, trackId: null };
  }

  if (snapshot.gameState === GameState.BOOT || snapshot.gameState === GameState.MENU) {
    return { ...base, trackId: getTrack('theme'), crossfadeMs: 500, fadeInMs: 500 };
  }

  if (snapshot.gameState === GameState.PLAYING) {
    if (snapshot.powerupActive) {
      return { ...base, trackId: getTrack('powerup'), crossfadeMs: 300, fadeInMs: 250 };
    }
    if (snapshot.isBossLevel) {
      return { ...base, trackId: getTrack('boss'), crossfadeMs: 500, fadeInMs: 400 };
    }
    return { ...base, trackId: getTrack('game'), crossfadeMs: 500, fadeInMs: 400 };
  }

  if (snapshot.isDead) {
    return { ...base, trackId: null, fadeOutMs: 200 };
  }

  return base;
}
