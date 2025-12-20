// Especificação de Pixel Art do Player (Feka)
// 100% Pixel-Matrix Pipeline

export const PLAYER_PALETTE: Record<string, string | null> = {
  '_': null,        // Transparente
  'K': '#1a1a1a',   // Preto (Cabelo/Sapatos/Óculos)
  'S': '#b86f30',   // Pele (Skin)
  'B': '#0044cc',   // Azul Claro (Camisa)
  'D': '#002288',   // Azul Escuro (Calça)
  'G': '#555555',   // Cinza (Detalhe óculos)
  'W': '#ffffff',   // Branco (Cinto)
  'H': '#FFD700',   // Dourado (Capacete)
  'h': '#DAA520'    // Dourado Escuro (Sombra Capacete)
};

export const PLAYER_SPRITES = {
  idle: [
    "__KKKK__",
    "_KKKKKK_",
    "_KKSKSS_",
    "_SKSKSG_",
    "_SSSSSS_",
    "_SBBBB__",
    "BBBBBBBB",
    "BBSBBSBB",
    "BWWWWWB_",
    "_DDDDD__",
    "_DD_DD__",
    "_DD_DD__",
    "_KK_KK__"
  ],
  walk1: [
    "__KKKK__",
    "_KKKKKK_",
    "_KKSKSS_",
    "_SKSKSG_",
    "_SSSSSS_",
    "_SBBBB__",
    "BBBBBBBB",
    "BBSBBSBB",
    "BWWWWWB_",
    "_DDDDD__",
    "_DD__D__",
    "_KK__D__",
    "_____KK_"
  ],
  walk2: [
    "__KKKK__",
    "_KKKKKK_",
    "_KKSKSS_",
    "_SKSKSG_",
    "_SSSSSS_",
    "_SBBBB__",
    "BBBBBBBB",
    "BBSBBSBB",
    "BWWWWWB_",
    "_DDDDD__",
    "_D__DD__",
    "_D__KK__",
    "_KK_____"
  ],
  jump: [
    "__KKKK__",
    "_KKKKKK_",
    "_KKSKSS_",
    "_SKSKSG_",
    "_SSSSSS_",
    "__BBBB__",
    "_BBBBBB_",
    "BBSBBSBB",
    "_WWWWW__",
    "_DDDDD__",
    "_D___D__",
    "_KK_KK__",
    "________"
  ],
  sit: [
    "________",
    "________",
    "__KKKK__",
    "_KKKKKK_",
    "_KKSKSS_",
    "_SKSKSG_",
    "_SSSSSS_",
    "__BBBB__",
    "_BBBBBB_",
    "BBDDDDBB",
    "_KK__KK_",
    "________",
    "________"
  ],
  helmet: [
    "___hh___",
    "__HHHH__",
    "_HWHHhh_",
    "HHHHHHHH"
  ]
};

// Dimensões canônicas
export const PLAYER_FRAME_W = 8;
export const PLAYER_FRAME_H = 13;
export const PLAYER_PIXEL_SIZE = 2; // Escala interna do pixel art

// Hitbox e Offsets (em pixels lógicos do jogo)
export const PLAYER_HITBOX_W = 14;
export const PLAYER_HITBOX_H = 24;
export const PLAYER_RENDER_OFFSET_X = -1;
export const PLAYER_RENDER_OFFSET_Y = -2;
