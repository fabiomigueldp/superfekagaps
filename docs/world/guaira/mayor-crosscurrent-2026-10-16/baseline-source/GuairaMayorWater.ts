import type { Rect } from '../../../types';

/** Stepped pixel silhouettes shared by collision and paint. The warning bounds
 * enclose the entire burst; the empty upper corners are genuinely safe. */
export function mayorStampWater(q: Readonly<Rect>): readonly Readonly<Rect>[] {
    const cap = Math.max(1, Math.floor(q.height / 4)), base = Math.max(1, Math.floor(q.height / 3));
    return [
        { x: q.x + 12, y: q.y, width: q.width - 24, height: cap },
        { x: q.x + 4, y: q.y + cap, width: q.width - 8, height: q.height - cap - base },
        { x: q.x, y: q.y + q.height - base, width: q.width, height: base }
    ];
}

export function mayorWaveWater(q: Readonly<Rect> & { readonly direction: -1 | 1 }): readonly Readonly<Rect>[] {
    return [
        { x: q.x + (q.direction === 1 ? 6 : 2), y: q.y, width: q.width - 8, height: 4 },
        { x: q.x + (q.direction === 1 ? 2 : 0), y: q.y + 4, width: q.width - 2, height: 6 },
        { x: q.x, y: q.y + 10, width: q.width, height: q.height - 10 }
    ];
}
