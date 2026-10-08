import { GAME_WIDTH, GAME_HEIGHT } from '../../constants';
import { PLAYER_HITBOX_W, PLAYER_HITBOX_H } from '../../assets/playerSpriteSpec';

/** Legacy chapter coordinates remain save-compatible; all engine work is native. */
export const DELICIA_UNIT = 3;
export const DELICIA_WIDTH = GAME_WIDTH * DELICIA_UNIT;
export const DELICIA_HEIGHT = GAME_HEIGHT * DELICIA_UNIT;
export const DELICIA_PLAYER_WIDTH = PLAYER_HITBOX_W * DELICIA_UNIT;
export const DELICIA_PLAYER_HEIGHT = PLAYER_HITBOX_H * DELICIA_UNIT;
export const DELICIA_STEP = 1 / 60;
/** Headroom for the same spring/jump envelope, above legacy authored y=0. */
export const DELICIA_CAMERA_TOP = -240;
