export type MusicTrackId = 'theme' | 'game' | 'boss' | 'powerup' | 'ending';

export interface MusicTrackConfig {
  id: MusicTrackId;
  url: string;
  loop: boolean;
  volume: number;
}

const base = (import.meta as any).env?.BASE_URL ?? '/';

export const MUSIC_TRACKS: Record<MusicTrackId, MusicTrackConfig> = {
  theme: {
    id: 'theme',
    url: `${base}assets/audio/music/theme.wav`,
    loop: true,
    volume: 0.6
  },
  game: {
    id: 'game',
    url: `${base}assets/audio/music/game.wav`,
    loop: true,
    volume: 0.6
  },
  boss: {
    id: 'boss',
    url: `${base}assets/audio/music/boss.wav`,
    loop: true,
    volume: 0.65
  },
  powerup: {
    id: 'powerup',
    url: `${base}assets/audio/music/powerup.wav`,
    loop: true,
    volume: 0.7
  },
  ending: {
    id: 'ending',
    url: `${base}assets/audio/music/ending.wav`,
    loop: true,
    volume: 0.6
  }
};
