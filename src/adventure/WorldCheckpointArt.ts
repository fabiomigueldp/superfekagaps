import { box, ink } from './WorldPainting';

/** A reached safe point has a persistent shape cue, even without color or sound.
 * This marks a reached safe point; the existing toast explains save lifetime.
 * Static pixels keep the cue equally legible with reduced motion and while paused.
 */
export function drawWorldCheckpoint(c: CanvasRenderingContext2D, x: number, y: number, reached: boolean) {
    // Keep the original 17 × 35 footprint and ground anchor.
    box(c, x, y - 35, 2, 35, '#f0dbc0');
    box(c, x + 2, y - 34, 15, 10, ink);
    box(c, x + 3, y - 33, 13, 8, reached ? '#86d2ad' : '#788b9a');
    if (reached) {
        // An eight-pixel-wide check remains distinct from the exit's star.
        box(c, x + 5, y - 30, 2, 2, ink);
        box(c, x + 7, y - 28, 2, 2, ink);
        box(c, x + 9, y - 30, 2, 2, ink);
        box(c, x + 11, y - 32, 2, 2, ink);
    }
}
