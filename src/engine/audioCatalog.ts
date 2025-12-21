export type MusicTrackId =
  | 'theme' | 'game' | 'boss' | 'powerup' | 'ending'
  // === MODO DA DELICIA ===
  | 'theme_delicia' | 'game_delicia' | 'boss_delicia' | 'powerup_delicia' | 'ending_delicia'
  // SFX tratado como track one-shot (stinger)
  | 'sfx_delicia';

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
  },

  // === MODO DA DELICIA (assets em public/assets_delicia/) ===
  theme_delicia: {
    id: 'theme_delicia',
    url: `${base}assets_delicia/super_feka_gaps_delicia_theme_75.577s.webm`,
    loop: true,
    volume: 0.6
  },
  game_delicia: {
    id: 'game_delicia',
    url: `${base}assets_delicia/super_feka_world_delicia_92.051s.webm`,
    loop: true,
    volume: 0.6
  },
  powerup_delicia: {
    id: 'powerup_delicia',
    url: `${base}assets_delicia/delicia_da_mini_fanta_23.106s.webm`,
    loop: true,
    volume: 0.7
  },
  boss_delicia: {
    id: 'boss_delicia',
    url: `${base}assets_delicia/boss_delicia_149.191s.webm`,
    loop: true,
    volume: 0.65
  },
  ending_delicia: {
    id: 'ending_delicia',
    url: `${base}assets_delicia/delicia_ending_53.090s.webm`,
    loop: true,
    volume: 0.6
  },

  // SFX tratado como stinger
  sfx_delicia: {
    id: 'sfx_delicia',
    url: `${base}assets_delicia/ai_que_delicia_1.674s.webm`,
    loop: false,
    volume: 0.8
  }
};
