import { box as r, pixelLine as line, polygon, type Point } from '../../WorldPainting';

/** Decoration only: callers supply the game's clock and the real bridge's active state. */
const clock = (time: number, reducedMotion: boolean) =>
    reducedMotion || !Number.isFinite(time) ? 0 : Math.max(0, time);

/** Keep every moving reflection inside the authored water, on the native pixel grid. */
function waterWindow(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
    paint: (left: number, top: number, w: number, h: number) => void) {
    const left = Math.round(x), top = Math.round(y), w = Math.round(width), h = Math.round(height);
    if (w <= 0 || h <= 0) return;
    c.save();
    c.beginPath(); c.rect(left, top, w, h); c.clip();
    paint(left, top, w, h);
    c.restore();
}

/** Four rigid sails turn around one fixed axle; the tower never rotates or changes pose. */
export function drawGuairaWindPump(c: CanvasRenderingContext2D, x: number, y: number,
    time: number, reducedMotion: boolean) {
    c.save();
    x = Math.round(x); y = Math.round(y);
    // Preserve the original tower, its footprint and all of its cross braces.
    line(c, x - 9, y, x - 3, y - 55, '#a17e62', 2);
    line(c, x + 10, y, x + 3, y - 55, '#97745b', 2);
    for (let yy = 8; yy < 45; yy += 12) {
        line(c, x - 7, y - yy, x + 7, y - yy - 9, '#ae8c68');
        r(c, x - 7, y - yy, 14, 2, '#bf9d72');
    }
    const hubY = y - 57;
    const angle = (clock(time, reducedMotion) % 9600) * Math.PI * 2 / 9600 - Math.PI / 8;
    for (let blade = 0; blade < 4; blade++) {
        const a = angle + blade * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
        const point = (radius: number, across: number): Point =>
            [Math.round(x + dx * radius - dy * across), Math.round(hubY + dy * radius + dx * across)];
        const root = point(3, 0), tip = point(13, 0);
        line(c, root[0], root[1], tip[0], tip[1], '#957257');
        // A narrow root and a broad outer sail share the same radial transform.
        polygon(c, [point(5, -1), point(13, -1), point(13, 3), point(6, 1)], '#bd936a');
        const brightRoot = point(6, -1), brightTip = point(12, -1);
        line(c, brightRoot[0], brightRoot[1], brightTip[0], brightTip[1], '#d1ac77');
    }
    // Stationary bearing masks all sail roots, preventing a wobbling centre.
    r(c, x - 2, hubY - 2, 5, 5, '#ae875f');
    r(c, x - 1, hubY - 1, 3, 3, '#dbb079');
    r(c, x, hubY, 1, 1, '#80664f');
    c.restore();
}

/** Surface trails follow the outlet: left toward town, right toward the rice fields. */
export function drawGuairaChannelFlow(c: CanvasRenderingContext2D, left: number, right: number, y: number,
    wet: boolean, time: number, reducedMotion: boolean, direction: -1 | 1 = 1) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / 120) % 32;
    waterWindow(c, left, y + 2, right - left, 3, (x, top, width) => {
        for (let offset = -32; offset < width + 32; offset += 32) {
            const head = x + offset + direction * drift;
            r(c, head, top + 1, 5, 1, '#a6d6c8');
            r(c, head - direction * 4, top + 2, 2, 1, '#85c6c1');
        }
    });
}

/** Called before the rice stalks, so the crop and its earth berm always occlude the water. */
export function drawGuairaRiceFlow(c: CanvasRenderingContext2D, x: number, y: number, width: number,
    wet: boolean, time: number, reducedMotion: boolean, row = 0) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / 240) % 39;
    waterWindow(c, x + 2, y + 6, width - 4, 6, (left, top, w) => {
        for (let offset = -39; offset < w + 39; offset += 39) {
            const head = left + offset + drift + row * 11;
            r(c, head, top + 1, 5, 1, '#b4cbb0');
            r(c, head - 9, top + 4, 3, 1, '#9dbfa6');
        }
    });
}

/** Vertical threads descend within the existing spill; geometry follows the real gate. */
export function drawGuairaSluiceFlow(c: CanvasRenderingContext2D, x: number, spillY: number, bottomY: number,
    wet: boolean, time: number, reducedMotion: boolean) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / 90) % 19;
    waterWindow(c, x + 17, spillY, 18, bottomY - spillY, (left, top, _w, height) => {
        for (let offset = -19; offset < height + 19; offset += 19) {
            const yy = top + offset + drift;
            r(c, left + 6, yy, 5, 1, '#a6d6c8');
            r(c, left + 8, yy + 1, 2, 2, '#85c6c1');
            r(c, left + 1, yy + 9, 1, 4, '#8bcec7');
            r(c, left + 15, yy + 5, 1, 3, '#77c1c0');
        }
    });
}

/** The pool's existing surface marks drift away from the falling water without a reset jump. */
export function drawGuairaPoolFlow(c: CanvasRenderingContext2D, left: number, right: number, y: number,
    wet: boolean, time: number, reducedMotion: boolean, sourceX = (left + right) / 2) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / 240) % 27;
    const source = Math.round(Math.max(left, Math.min(right, sourceX)));
    // Same 9px marks, color and y+3 line as the authored pool. Clip each half separately.
    for (const direction of [-1, 1] as const) {
        const from = direction < 0 ? left : source, to = direction < 0 ? source : right;
        waterWindow(c, from, y + 3, to - from, 1, (_x, top) => {
            for (let offset = 6 - 27; offset < right - left + 27; offset += 27)
                r(c, left + offset + direction * drift, top, 9, 1, '#b0dcce');
        });
    }
}
