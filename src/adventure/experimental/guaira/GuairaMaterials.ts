import { box as r } from '../../WorldPainting';

// Material variation belongs to the object/world, never the camera or clock.
// Integer clusters keep the native 320 × 180 image clean in motion.
function grain(x: number, y: number) {
    let n = Math.imul(x + 19, 374761393) ^ Math.imul(y + 37, 668265263);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return (n ^ n >>> 16) >>> 0;
}

/** Sparse mineral lenses inside a single solid tile. The four-pixel landing
 * band stays untouched; the caller retains authority over holes and side caps. */
export function drawGuairaClayGrain(c: CanvasRenderingContext2D, x: number, y: number,
    col: number, row: number, light = '#c58a60', shade = '#a66b4f') {
    const seed = grain(col, row);
    // Leave most clay quiet. Dense tile-by-tile specks read as confetti when
    // scrolling and compete with the deliberately broad sediment layers.
    if (seed % 4 !== 0) return;
    const dx = 2 + seed % 6, dy = 6 + (seed >>> 5) % 6;
    const width = 5 + (seed >>> 9) % 3;
    // A connected, flattened inclusion, not scattered noise or a brittle crack.
    r(c, x + dx, y + dy, width, 1, shade);
    r(c, x + dx + 1, y + dy - 1, width - 2, 1, light);
    if (seed % 5 === 0) r(c, x + dx + 1, y + dy + 1, width - 1, 1, shade);
}

/** Dressed stone in broad, staggered courses. No crack-shaped marks: these
 * blocks are safe masonry, distinct from the breakable clay covers. */
export function drawGuairaStoneFace(c: CanvasRenderingContext2D, x: number, y: number, col: number, row: number) {
    const block = Math.floor((col * 16 + (row % 2) * 16) / 32), seed = grain(block, row);
    r(c, x, y, 16, 16, ['#95806b', '#917c68', '#99836c'][seed % 3]);
    r(c, x, y + 1, 16, 1, '#ad9478');
    r(c, x, y + 12, 16, 2, '#87725f');
    r(c, x, y + 14, 16, 2, '#695449');
    const joint = (col + row) % 2 === 0;
    if (joint) {
        r(c, x, y, 1, 14, '#695449');
        r(c, x + 1, y + 2, 1, 10, '#b29a7d');
        r(c, x + 1, y, 2, 1, '#695449');
    } else {
        r(c, x + 15, y + 2, 1, 12, '#7c6757');
        r(c, x + 13, y + 13, 3, 1, '#695449');
    }
    if (seed % 3 !== 0) {
        const dx = 4 + (seed >>> 4) % 4, dy = 5 + (seed >>> 7) % 4;
        r(c, x + dx, y + dy, 5, 1, '#a58e74');
        r(c, x + dx + 2, y + dy + 1, 4, 1, '#8b7661');
    }
}

/** A few limewash repairs and exposed clay at the foot of a wall. All marks
 * are local to its inset face, below the eaves and behind doors and windows. */
export function drawGuairaPlaster(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant = 0) {
    if (w < 22 || h < 22) return;
    const seed = grain(variant, w), right = x + w, bottom = y + h;
    const patchX = x + 4 + seed % Math.max(1, Math.floor(w / 3));
    r(c, patchX, y + 5, 6, 1, '#ceb08d');
    r(c, patchX + 1, y + 6, 7, 3, '#ceb08d');
    r(c, patchX + 3, y + 9, 3, 2, '#ceb08d');
    // A stepped repair has thickness without a high-contrast rectangular decal.
    const repairW = 8 + seed % 4, repairX = right - repairW - 7, repairY = bottom - 12 - (seed >>> 4) % 3;
    r(c, repairX, repairY, repairW - 3, 7, '#c5a382');
    r(c, repairX - 2, repairY + 3, repairW + 1, 4, '#c5a382');
    r(c, repairX + 1, repairY, repairW - 5, 1, '#d8b995');
    r(c, repairX - 1, repairY + 4, repairW - 1, 1, '#af8b6d');
    r(c, repairX + 3, repairY + 1, 1, 3, '#af8b6d');
    r(c, repairX + 5, repairY + 5, 1, 2, '#af8b6d');
    r(c, x + 3, bottom - 5, 9, 3, '#c9a886');
    r(c, x + 4, bottom - 6, 5, 1, '#d9b996');
}

/** Longitudinal grain, staggered joins and an occasional knot. Coordinates
 * are local to the beam so texture travels with a moving platform. The caller
 * supplies only its wooden interior, preserving the bright collision cap. */
export function drawGuairaTimber(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant = 0) {
    w = Math.floor(w); h = Math.floor(h);
    if (w < 3 || h < 2) return;
    const mark = (dx: number, dy: number, width: number, height: number, color: string) => {
        const left = Math.max(0, dx), top = Math.max(0, dy);
        const right = Math.min(w, dx + width), bottom = Math.min(h, dy + height);
        if (right > left && bottom > top) r(c, x + left, y + top, right - left, bottom - top, color);
    };
    for (let start = 0, board = 0; start < w; board++) {
        const seed = grain(board, variant), length = 23 + seed % 11;
        if (start > 0) {
            mark(start, 0, 1, h, '#735b49');
            mark(start + 1, 1, 1, h - 2, '#c7a472');
        }
        mark(start + 4, 1, length - 9, 1, '#c7a472');
        if (h > 3) mark(start + 8, h - 2, length - 12, 1, '#8c684c');
        if (h > 4 && seed % 3 === 0) {
            mark(start + 12, 2, 5, 1, '#8c684c');
            mark(start + 11, 3, 2, 1, '#735b49');
            mark(start + 16, 3, 2, 1, '#735b49');
            mark(start + 13, 4, 3, 1, '#8c684c');
        }
        start += length;
    }
}
