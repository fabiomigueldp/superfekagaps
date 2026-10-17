import type { Rect } from '../../../types';

/** The crest leads the boots, with a low trailing wake. The entire dangerous
 * silhouette is painted by the same contours, including the first active tick. */
export function mayorRushWater(q: Readonly<Rect>, direction: -1 | 1): readonly Readonly<Rect>[] {
    return [
        { x: q.x + (direction === 1 ? 24 : 8), y: q.y, width: 12, height: 5 },
        { x: q.x + (direction === 1 ? 16 : 4), y: q.y + 5, width: 24, height: 7 },
        { x: q.x + (direction === 1 ? 6 : 0), y: q.y + 12, width: q.width - 6, height: 6 },
        { x: q.x, y: q.y + 18, width: q.width, height: q.height - 18 }
    ];
}

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

/** A travelling packet of pressurised water, with genuinely empty outer corners. */
export function mayorJetWater(q: Readonly<Rect> & { readonly direction: -1 | 1 }): readonly Readonly<Rect>[] {
    return [
        { x: q.x + (q.direction === 1 ? 12 : 4), y: q.y, width: q.width - 16, height: 2 },
        { x: q.x + (q.direction === 1 ? 5 : 1), y: q.y + 2, width: q.width - 6, height: 3 },
        { x: q.x, y: q.y + 5, width: q.width, height: q.height - 10 },
        { x: q.x + (q.direction === 1 ? 4 : 2), y: q.y + q.height - 5, width: q.width - 6, height: 3 },
        { x: q.x + (q.direction === 1 ? 11 : 5), y: q.y + q.height - 2, width: q.width - 16, height: 2 }
    ];
}
