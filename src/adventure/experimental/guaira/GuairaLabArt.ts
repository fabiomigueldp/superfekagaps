import { drawSkeletonBull } from './SkeletonBullArt';
import type { SkeletonBullModel } from './SkeletonBullModel';
import { box as r, pixelLine as line, polygon, oval, roof } from '../../WorldPainting';
import { drawGuairaLandscape, drawGuairaTree, drawGuairaPerchedBird, guairaBreeze, sceneryTime } from './GuairaScenery';

const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
};

/** An inhabited corral, with every prop rooted behind a quiet combat lane. */
export function drawGuairaBackground(c: CanvasRenderingContext2D, cx = 0, cy = 64, time = 0, reducedMotion = false) {
    const x = Number.isFinite(cx) ? Math.round(cx) : 0, y = Number.isFinite(cy) ? Math.round(cy) : 64;
    const t = sceneryTime(time, reducedMotion);
    c.save(); c.beginPath(); c.rect(0, 0, 320, 180); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    drawGuairaLandscape(c, x, y, t, reducedMotion, 'corral');
    // Far fields follow the same dry banks as the approach to Ossabravo.
    r(c, 0, 155 - y, 320, 180, '#b8a47b');
    for (const [left, top, width] of [[-15,155,124],[191,151,143]] as const) {
        polygon(c, [[left-x,top-y],[left+width-x,top+3-y],[left+width+14-x,top+14-y],[left-5-x,top+11-y]], '#8f9d72');
        line(c, left + 6 - x, top + 8 - y, left + width - 5 - x, top + 9 - y, '#aeb99a', 2);
        for (let xx = left + 9; xx < left + width; xx += 17) {
            const sway = guairaBreeze(t, xx, 1);
            line(c, xx - x, top + 9 - y, xx - 2 + sway - x, top + 3 - y, '#7e9368');
            line(c, xx + 1 - x, top + 9 - y, xx + 4 + sway - x, top + 2 - y, '#9caa79');
        }
    }
    r(c, 0, 174 - y, 320, 180, '#bf926b');
    polygon(c, [[112-x,174-y],[177-x,174-y],[225-x,209-y],[72-x,209-y]], '#cda177');
    // Plastered sluice house: thick jambs, roof weight and a fixed spindle.
    oval(c, 113 - x, 188 - y, 80, 6, '#b18a64');
    r(c, 121 - x, 137 - y, 62, 53, '#ad8a6b');
    r(c, 124 - x, 138 - y, 54, 48, '#cfb48a');
    r(c, 129 - x, 148 - y, 43, 40, '#8b7c67');
    r(c, 132 - x, 150 - y, 37, 38, '#ad9d7e');
    for (let yy = 155; yy < 187; yy += 7) {
        r(c, 133 - x, yy - y, 35, 2, '#8a806c');
        r(c, 135 - x, yy + 2 - y, 31, 1, '#c0b08b');
    }
    roof(c, 116 - x, 122 - y, 72, 17);
    drawGuairaPerchedBird(c, 174 - x, 122 - y, t, 174);
    r(c, 149 - x, 141 - y, 3, 47, '#b79e71');
    r(c, 145 - x, 142 - y, 11, 3, '#897558');
    r(c, 124 - x, 180 - y, 5, 5, '#bda078');
    r(c, 174 - x, 169 - y, 4, 8, '#bda078');
    // Shade trees frame the arena, never hide the bull's feet or charge warning.
    drawGuairaTree(c, 18 - x, 194 - y, 90, t, 18);
    drawGuairaTree(c, 309 - x, 193 - y, 68, t, 309, true);
    // Worn fence has ordinary dull upper edges, no platform-coloured cap.
    for (let wx = -7; wx < 340; wx += 37) {
        oval(c, wx - 3 - x, 196 - y, 12, 3, '#ae8663');
        r(c, wx - x, 172 - y, 4, 26, '#9c805f');
        r(c, wx + 1 - x, 174 - y, 1, 23, '#b6a075');
        r(c, wx - x, 179 - y, 38, 3, '#a48a65');
        r(c, wx - x, 191 - y, 38, 2, '#a48a65');
        if (wx % 2) line(c, wx + 5 - x, 190 - y, wx + 34 - x, 182 - y, '#ad946d');
    }
    // Compact feed trough belongs to the fence line, with a soil contact shadow.
    oval(c, 42 - x, 202 - y, 42, 4, '#af865e');
    polygon(c, [[44-x,191-y],[79-x,191-y],[75-x,202-y],[48-x,202-y]], '#a58a62');
    r(c, 45 - x, 191 - y, 33, 3, '#8d7a59');
    r(c, 49 - x, 191 - y, 25, 1, '#b6aa77');
    // Broad, quiet clay in front keeps the bone silhouettes and tells readable.
    r(c, 0, 207 - y, 320, 23, '#bb865e');
    for (const [wx, wy, width] of [[13,214,11],[113,218,18],[190,211,10],[274,216,19]])
        r(c, wx - x, wy - y, width, 1, '#c5976b');
    c.restore();
}

export function drawGuairaFloor(c: CanvasRenderingContext2D, cy: number) {
    const y = 224 - cy;
    rect(c, '#773f35', 0, y, 320, 180 - y);
    rect(c, '#e6a270', 0, y, 320, 2);
    rect(c, '#c07851', 0, y + 2, 320, 4);
    for (let x = 0; x < 320; x += 21) {
        rect(c, '#965239', x, y + 9, 12, 3);
        rect(c, '#ae6845', x + 6, y + 16, 6, 2);
    }
}

/** Full body sweep, including its starting position; no promised safe gap. */
export function bullChargeWarningRange(b: SkeletonBullModel) {
    const target = b.facing < 0 ? b.arena.left + 12 : b.arena.right - b.width - 12;
    return { left: Math.min(b.x, target), right: Math.max(b.x, target) + b.width };
}

export function drawBullWarning(c: CanvasRenderingContext2D, b: SkeletonBullModel) {
    if (b.state === 'tell' || b.state === 'rattle') {
        const y = b.arena.floor - 5, charge = b.state === 'tell';
        const range = charge ? bullChargeWarningRange(b) : { left: b.arena.left, right: b.arena.right };
        rect(c, '#653752', range.left, y, range.right - range.left, 3);
        for (let x = range.left + 7; x < range.right - 7; x += 20) {
            if (charge) for (let d = 0; d < 3; d++) {
                rect(c, '#edcaf5', x + b.facing * d, y - 1 + d, 1, 1);
                rect(c, '#edcaf5', x + b.facing * d, y + 3 - d, 1, 1);
            } else {
                rect(c, '#f0ddae', x - 3, y + 1, 7, 1);
                rect(c, '#f0ddae', x - 4, y, 2, 3); rect(c, '#f0ddae', x + 3, y, 2, 3);
            }
        }
    }
}

export function drawGuairaBoss(c: CanvasRenderingContext2D, b: SkeletonBullModel, cx: number, cy: number, reducedMotion: boolean) {
    c.save(); c.translate(-cx, -cy);
    drawBullWarning(c, b);
    drawSkeletonBull(c, b, reducedMotion);
    for (const bone of b.visibleBones) {
        rect(c, '#493444', bone.x - 1, bone.y - 1, 12, 9);
        rect(c, '#f0ddae', bone.x + 2, bone.y + 2, 6, 3);
        rect(c, '#f0ddae', bone.x, bone.y, 3, 7);
        rect(c, '#f0ddae', bone.x + 7, bone.y, 3, 7);
    }
    if (b.vulnerable) {
        rect(c, '#fff1bf', b.x + 20, b.y - 10, 8, 2);
        rect(c, '#fff1bf', b.x + 22, b.y - 8, 4, 2);
        rect(c, '#fff1bf', b.x + 23, b.y - 6, 2, 2);
    }
    c.restore();
}
