// Constantes do jogo Super Feka Gaps

// Resolução lógica do jogo (8-bit style)
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;

// Escala do canvas
export const SCALE = 3;

// Tamanho dos tiles
export const TILE_SIZE = 16;

// Física
export const GRAVITY = 0.5;
export const MAX_FALL_SPEED = 10;
export const PLAYER_SPEED = 2;
export const PLAYER_RUN_SPEED = 3.5;
export const PLAYER_JUMP_FORCE = -8;
export const PLAYER_ACCELERATION = 0.3;
export const PLAYER_FRICTION = 0.85;
export const ICE_FRICTION = 0.96;
export const COYOTE_TIME = 100; // ms
export const JUMP_BUFFER_TIME = 100; // ms
export const SPRING_BOOST = -13;

// Plataformas instaveis
export const FALLING_PLATFORM_MIN_CONTACT_MS = 150;
export const FALLING_PLATFORM_ARM_MS = 250;
export const FALLING_PLATFORM_FALL_MS = 300;
export const FALLING_PLATFORM_RESPAWN_MS = 1200;
export const FALLING_PLATFORM_FALL_DISTANCE = 12;

// Ground Pound
export const GP_WINDUP_MS = 120;
export const GP_RECOVERY_MS = 150;
export const GP_FALL_SPEED = 12;
export const GP_HORIZONTAL_MULT = 0.3;
export const GP_IMPACT_RADIUS_PX = 40;
export const GP_SHAKE_MS = 150;
export const GP_SHAKE_MAG = 4;

// Cores da paleta 8-bit
export const COLORS = {
  // Fundo
  SKY_LIGHT: '#87CEEB',
  SKY_DARK: '#4A90D9',

  // Terreno
  GROUND_TOP: '#4CAF50',
  GROUND_FILL: '#8B4513',
  GROUND_DARK: '#5D3A1A',

  // Blocos
  BRICK_MAIN: '#CD853F',
  BRICK_LIGHT: '#DEB887',
  BRICK_DARK: '#8B4513',

  // Personagens
  FEKA_SKIN: '#D2B48C', // Light-skinned Black / Pardo
  FEKA_HAIR: '#1A1A1A', // Indigenous Black
  FEKA_SHIRT: '#4169E1', // Royal Blue Dress Shirt
  FEKA_PANTS: '#1E90FF', // Jeans Blue
  FEKA_SHOES: '#333333',
  FEKA_GLASSES: '#000000', // Black Acetate Frames

  YASMIN_SKIN: '#FFE4C4',
  YASMIN_HAIR: '#FFD700',
  YASMIN_DRESS: '#FF69B4',

  JOAOZAO_SKIN: '#90EE90',
  JOAOZAO_HAIR: '#006400',
  JOAOZAO_SHIRT: '#800080',
  JOAOZAO_PANTS: '#333333',

  // Inimigos
  ENEMY_BODY: '#8B0000',
  ENEMY_FACE: '#FF6347',

  // UI
  COIN_GOLD: '#FFD700',
  COIN_SHINE: '#FFFACD',

  // Efeitos
  SPIKE: '#808080',
  ICE_LIGHT: '#BFE9FF',
  ICE_DARK: '#6FB7E6',
  LAVA_TOP: '#FFB020',
  LAVA_FILL: '#E4471F',
  SPRING_BASE: '#C0392B',
  SPRING_COIL: '#F1C40F',
  CHECKPOINT_FLAG: '#FF0000',
  PORTAL: '#00FFFF',

  // UI/HUD
  HUD_BG: '#000000',
  HUD_TEXT: '#FFFFFF',
  HUD_ACCENT: '#FFD700',

  // Menu
  MENU_BG: '#1a1a2e',
  MENU_TEXT: '#FFFFFF',
  MENU_HIGHLIGHT: '#FFD700',

  // Cores de Fogos (Vibrantes)
  FIREWORK_COLORS: [
    '#FF0000', // Vermelho
    '#00FF00', // Verde
    '#00FFFF', // Ciano
    '#FF00FF', // Magenta
    '#FFFF00', // Amarelo
    '#FFFFFF'  // Branco
  ],

  // Transparências
  OVERLAY: 'rgba(0, 0, 0, 0.7)',
  SHADOW: 'rgba(0, 0, 0, 0.3)',
};

// IDs dos tiles
export enum TileType {
  EMPTY = 0,
  GROUND = 1,
  BRICK = 2,
  PLATFORM = 3,
  SPIKE = 4,
  CHECKPOINT = 5,
  FLAG = 6,
  COIN = 7,
  POWERUP_COFFEE = 8, // (legacy) not used as tile by default
  POWERUP_HELMET = 9, // (legacy) not used as tile by default

  // Novos tipos para suporte de gameplay
  BRICK_BREAKABLE = 10,
  POWERUP_BLOCK_COFFEE = 11,
  POWERUP_BLOCK_HELMET = 12,
  BLOCK_USED = 13,
  SPRING = 14,
  ICE = 15,
  PLATFORM_FALLING = 16,
  LAVA_TOP = 17,
  LAVA_FILL = 18,
  HIDDEN_BLOCK = 19
}

// Estados do jogo
export enum GameState {
  BOOT = 'BOOT',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  LEVEL_CLEAR = 'LEVEL_CLEAR',
  BOSS_INTRO = 'BOSS_INTRO',
  ENDING = 'ENDING',
}

// Configurações de gameplay
export const INITIAL_LIVES = 3;
export const LEVEL_TIME = 200; // segundos
export const COIN_SCORE = 100;
export const ENEMY_SCORE = 200;
export const TIME_BONUS_MULTIPLIER = 10;
export const BLOCK_BREAK_SCORE = 50;
export const BOSS_DEFEAT_SCORE = 1000;
export const COINS_PER_LIFE = 100;
export const LIVES_BONUS_SCORE = 1000;

// Configurações de áudio
export const AUDIO_ENABLED_DEFAULT = true;
export const MASTER_VOLUME = 0.3;
