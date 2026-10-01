import type { SpriteAtlas } from '../graphics/pixels';
import type { MovingBody } from './WorldPhysics';
import { drawBurner } from './WorldBurnerArt';
import { drawGeyser } from './WorldGeyserArt';

/** Keep the campaign's existing machine interface while each material has its own art. */
export function drawJet(c: CanvasRenderingContext2D, b: MovingBody, atlas: SpriteAtlas, cx: number, cy: number, time: number, world: number) {
    return world === 6 ? drawBurner(c, b, atlas, cx, cy, time, world) : drawGeyser(c, b, atlas, cx, cy, time, world);
}

export { drawCannon } from './WorldCannonArt';
