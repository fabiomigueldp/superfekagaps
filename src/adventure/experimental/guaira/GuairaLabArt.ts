import { drawSkeletonBull } from './SkeletonBullArt';
import type { SkeletonBullModel } from './SkeletonBullModel';

const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
};

/** Quiet distant rice irrigation behind a dry, horizontal combat plane. */
export function drawGuairaBackground(c: CanvasRenderingContext2D) {
    rect(c, '#d9966b', 0, 0, 320, 180);
    rect(c, '#eac394', 0, 24, 320, 35);
    rect(c, '#e3ae80', 0, 59, 320, 17);
    rect(c, '#b98d6b', 0, 76, 320, 20);
    rect(c, '#98a075', 0, 82, 320, 6);
    rect(c, '#92b1a5', 0, 88, 320, 3);
    for (let x = 0; x < 320; x += 13) {
        rect(c, '#717d55', x, 81, 2, 8);
        rect(c, '#ab7254', x, 92, 10, 3);
    }
    rect(c, '#b77759', 0, 96, 320, 27);
    rect(c, '#ad6148', 0, 123, 320, 37);
    // Irrigation gate belongs to the background, never to the collision plane.
    rect(c, '#885d50', 137, 63, 52, 47);
    rect(c, '#574743', 143, 72, 40, 38);
    rect(c, '#9d8471', 146, 75, 34, 34);
    for (let y = 79; y < 108; y += 8) rect(c, '#78625a', 146, y, 34, 2);
    rect(c, '#c7a77c', 162, 61, 2, 49);
    rect(c, '#665147', 157, 61, 12, 3);
    for (let x = 8; x < 320; x += 36) rect(c, '#92664f', x, 102, 3, 27);
    rect(c, '#9d7054', 0, 107, 320, 3);
    rect(c, '#9d7054', 0, 121, 320, 2);
    for (const x of [26, 291]) {
        rect(c, '#64714c', x, 96, 6, 27);
        rect(c, '#788253', x + 1, 98, 2, 24);
        rect(c, '#64714c', x - 6, 105, 7, 4);
        rect(c, '#64714c', x - 6, 99, 3, 9);
        rect(c, '#64714c', x + 5, 111, 7, 4);
        rect(c, '#64714c', x + 9, 103, 3, 11);
    }
    for (let x = 5; x < 320; x += 37) rect(c, '#bb7352', x, 140 + x % 9, 7, 1);
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
