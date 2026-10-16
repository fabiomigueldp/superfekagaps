import { TileType } from '../../../../constants';
import type { WorldLevel } from '../../../WorldPhysics';
import type { PlayerData } from '../../../../types';
import { GUAIRA_GALLERY as G } from './GuairaGalleryStage';

/** A single native tile opening is16px wide: wider than native Feka's14px. */
export function galleryOpenings(level: WorldLevel) {
    const open = (start: number, y: number) => [0, 1, 2].some(i => level.getTile(start / 16 + i, y / 16) === TileType.EMPTY);
    return { first: open(G.firstStart, G.firstY), second: open(G.secondStart, G.secondY) };
}

export function galleryArrival(level: WorldLevel, p: PlayerData): boolean {
    const open = galleryOpenings(level);
    return !p.isDead && p.isGrounded && p.position.x >= G.finishX &&
        Math.abs(p.position.y + p.height - G.terraceY) < .01 && open.first && open.second;
}

/** Continuous framing target between the next shelf and its lower floor. */
export function galleryReceivingY(x: number, feet: number): number {
    const progress = (value: number, start: number, end: number) => Math.max(0, Math.min(1, (value - start) / (end - start)));
    // The short one-way shelves do not cover the rightmost lid tile. An edge
    // opening previews the actual lower floor instead of promising a missed shelf.
    if (x < 224) return G.firstLandingY + 48 * Math.max(progress(x,176,192), progress(feet,208,240));
    if (x < 384) return G.galleryY + 48 * progress(x,320,368);
    if (x < 448) return G.secondLandingY + 48 * Math.max(progress(x,400,416), progress(feet,304,336));
    if (x < 496) return G.lowerY;
    if (x < 528) return 336;
    if (x < 560) return 288;
    if (x < 608) return 240;
    return G.terraceY;
}
