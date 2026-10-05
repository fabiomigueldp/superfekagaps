import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from '../constants';
import type { CameraData, LevelData, PlayerData } from '../types';
import { clamp } from './types';

const FOLLOW = .12;
const GROUND_LINE = 108;
const RISE_LINE = 48;

/** Essential campaign framing, advanced only with the fixed-step simulation.
 * Falling and grounded tracking share a framing line: switching on contact must
 * not suddenly move the target 24 px and accelerate the camera after landing.
 * The rising dead zone, horizontal lead and settled framing stay unchanged.
 * No cosmetic motion, anticipation, oscillation or presentation clock is added.
 */
export function advanceCampaignCamera(
    camera: Pick<CameraData, 'x' | 'y'>,
    player: Pick<PlayerData, 'position' | 'velocity' | 'isGrounded'>,
    level: Pick<LevelData, 'width' | 'height'>,
): void {
    const { x, y } = player.position;
    const maxX = Math.max(0, level.width * TILE_SIZE - GAME_WIDTH);
    const maxY = Math.max(0, level.height * TILE_SIZE - GAME_HEIGHT);
    camera.x += (clamp(x - 125 + player.velocity.x * 12, 0, maxX) - camera.x) * FOLLOW;
    const screenY = y - camera.y;
    const targetY = player.isGrounded || screenY > GROUND_LINE ? y - GROUND_LINE
        : screenY < RISE_LINE ? y - RISE_LINE : camera.y;
    camera.y += (clamp(targetY, 0, maxY) - camera.y) * FOLLOW;
}
