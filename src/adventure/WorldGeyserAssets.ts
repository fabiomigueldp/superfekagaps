import { PixelGrid, type PixelFrame } from '../graphics/pixels';

/** Shared factory metals, brass and mysterious purple fluid. No new global palette entries. */
export const GEYSER_PALETTE = {
    _: null, K: '#192c44', n: '#22384f', N: '#365d70', E: '#6e9ca6', D: '#b6d6cb',
    I: '#f5e7b7', Y: '#dba94a', y: '#967145', v: '#683b93', V: '#a65ad9', Q: '#e0b4f1',
    W: '#e6f4ee', Z: '#a8e6ef', l: '#91bc8c', R: '#cf826a'
} as const;

function ellipse(g: PixelGrid, x: number, y: number, w: number, h: number, color: string) {
    for (let row = 0; row < h; row++) {
        const half = Math.sqrt(Math.max(0, 1 - ((row + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        g.rect(Math.ceil(x + w / 2 - half), y + row, Math.floor(half * 2), 1, color);
    }
}

function housing(cold: boolean): PixelFrame {
    const g = new PixelGrid(42, 30);
    // Bolted foot, rolled steel sump and a purple-stained, serviceable outlet.
    g.rect(5, 17, 32, 10, 'K').rect(6, 18, 30, 8, 'N');
    g.rect(7, 18, 28, 2, 'E').rect(7, 20, 3, 4, 'D').rect(33, 20, 2, 5, 'n');
    g.rect(3, 26, 36, 4, 'K').rect(4, 26, 34, 1, 'D').rect(6, 28, 5, 1, 'E').rect(31, 28, 5, 1, 'E');
    g.rect(12, 11, 18, 11, 'K').rect(13, 12, 16, 9, 'N').rect(14, 13, 3, 7, 'E');
    for (const y of [14, 18]) g.rect(12, y, 18, 2, 'n').rect(13, y, 15, 1, 'E');
    ellipse(g, 10, 7, 22, 10, 'K');
    ellipse(g, 11, 7, 20, 8, cold ? 'Z' : 'D');
    ellipse(g, 13, 8, 16, 6, 'N');
    ellipse(g, 14, 9, 14, 4, 'K');
    g.rect(16, 10, 10, 2, 'v').rect(18, 10, 3, 1, 'V');
    // A real pipe path joins the dial to the sump; the glass stands on the right.
    g.rect(7, 11, 3, 10, 'K').rect(8, 12, 1, 8, 'Y').rect(8, 20, 5, 2, 'y');
    g.rect(33, 8, 6, 15, 'K').rect(34, 9, 4, 13, 'n');
    g.rect(33, 8, 6, 2, 'Y').rect(33, 21, 6, 2, 'y');
    g.rect(34, 10, 1, 10, cold ? 'Z' : 'D');
    for (const x of [7, 32]) g.rect(x, 22, 3, 3, 'K').rect(x, 22, 2, 1, 'D').dot(x, 23, 'E');
    // Brass maker's plate with an engraved droplet, rather than unreadable text.
    g.rect(18, 20, 7, 5, 'K').rect(19, 20, 5, 4, 'Y');
    g.dot(21, 20, 'v').rect(20, 21, 3, 2, 'v').dot(20, 21, 'I');
    g.rect(13, 23, 2, 1, 'v').dot(14, 24, 'V').rect(27, 22, 1, 3, 'v');
    if (cold) {
        g.rect(11, 7, 6, 1, 'W').rect(12, 8, 2, 3, 'Z').dot(12, 11, 'W');
        g.rect(26, 8, 4, 1, 'W').dot(29, 9, 'Z');
        g.rect(6, 18, 5, 1, 'W').rect(7, 19, 1, 3, 'Z');
        g.rect(30, 26, 7, 1, 'Z').dot(34, 27, 'W');
    }
    return g.finish();
}

/** Immutable, cached by SpriteAtlas. Moving fluid and instrument parts are separate. */
export const GEYSER_HOUSINGS = { factory: housing(false), cold: housing(true) };
