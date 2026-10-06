import { PixelGrid, type SpriteAtlas } from '../graphics/pixels';
import { SEALS, WORLD_PALETTE } from './WorldAssets';

// Keep the medal's native silhouette, but replace the star with a completion check.
// A still, muted medal marks an earned location without advertising another pickup.
const earnedSeal = new PixelGrid(16, 18).stamp(SEALS[0], 0, 0)
    .rect(5, 8, 6, 5, 'Y')
    .rect(4, 8, 2, 2, 'K').rect(6, 10, 2, 2, 'K')
    .rect(8, 8, 2, 2, 'K').rect(10, 6, 2, 2, 'K').finish();
const earnedPalette = { ...WORLD_PALETTE,
    R: '#788b9a', r: '#556475', y: '#34495c', Y: '#a2b9b5', B: '#c6dedc', W: '#c6dedc'
};

/** Painting only: collection and persistence remain owned by the campaign. */
export function drawWorldSeal(c: CanvasRenderingContext2D, atlas: SpriteAtlas,
    x: number, y: number, time: number, collected = false): void {
    c.save();
    if (collected)
        atlas.draw(c, earnedSeal, earnedPalette, x, y);
    else
        atlas.draw(c, SEALS[Math.floor(time / 160) % 4], WORLD_PALETTE,
            x, y + Math.round(Math.sin(time / 320) * 2));
    c.restore();
}
