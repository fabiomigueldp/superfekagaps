import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from '../constants';
import type { CameraData, LevelData, PlayerData } from '../types';
import { clamp } from './types';

const FOLLOW = .12;
const FALL_LAG = 4;
const FALL_CATCHUP = .4;
const GROUND_LINE = 108;
const RISE_LINE = 48;

/** Essential campaign framing, advanced only with the fixed-step simulation.
 * Reserve 36 px of the former 40 px downward lag for landing anticipation.
 * Catch-up begins just below the shared ground/fall line, rather than waiting
 * until only Feka's body fits. Its maximum gain is still .52, and the current
 * grounded target bounds all travel: no prediction overshoot or landing reversal.
 * The 4 px allowance preserves load settling; ascent and short-hop dead zones,
 * horizontal lead, world bounds and the settled framing remain unchanged.
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
    const verticalDelta = clamp(targetY, 0, maxY) - camera.y;
    camera.y += verticalDelta * FOLLOW + Math.max(0, verticalDelta - FALL_LAG) * FALL_CATCHUP;
}
