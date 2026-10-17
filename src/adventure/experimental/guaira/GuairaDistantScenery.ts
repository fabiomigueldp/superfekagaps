import { box as r, pixelLine as line, polygon, oval } from '../../WorldPainting';
import type { GuairaLandscape } from './GuairaScenery';

/** A third, quiet plane between the hills and the playable structures. These
 * colours deliberately omit the cream landing edge and cyan pressure water. */
export const GUAIRA_DISTANT_COLORS = {
    soil: '#b4ad87', bank: '#a9a483', edge: '#c1b590', field: '#a4ae88',
    leaves: '#94a183', leafLight: '#b0b58d', trunk: '#a29778',
    wall: '#c9b692', side: '#b6a485', reveal: '#a3987d', plaster: '#d0bd98',
    roof: '#b29a80', tile: '#c1a98b', glass: '#a1b1a0',
    water: '#9bad97', glint: '#bdc4a5',
} as const;
const P = GUAIRA_DISTANT_COLORS;
const PROFILES = {
    village: { root: 161, offset: 40 }, junction: { root: 180, offset: 367 },
    rice: { root: 168, offset: 763 }, heights: { root: 199, offset: 1080 },
} as const;

function orchard(c: CanvasRenderingContext2D, x: number, root: number, tall: boolean, time: number, seed: number) {
    const height = tall ? 29 : 21, tip = Math.round(Math.sin(time / 3100 + seed) * .65);
    r(c, x, root - height + 8, 2, height - 7, P.trunk);
    line(c, x, root - 10, x - 5, root - 17, P.trunk);
    // One connected canopy; the trunk and its soil contact never sway.
    oval(c, x - 10, root - height + 4, 20, 13, P.leaves);
    oval(c, x - 7 + tip, root - height, 15, 15, P.leaves);
    r(c, x - 4 + tip, root - height + 2, 6, 1, P.leafLight);
    r(c, x - 13, root, 29, 2, P.bank);
}

function house(c: CanvasRenderingContext2D, x: number, foot: number, width: number, height: number, arcade: boolean) {
    if (x + width + 8 < 0 || x - 8 > 320) return;
    const top = foot - height;
    r(c, x, top, width, height, P.wall);
    r(c, x + width - 9, top, 9, height, P.side);
    polygon(c, [[x-4,top+1],[x+3,top-9],[x+width-4,top-9],[x+width+4,top+1]], P.roof);
    for (let dx = 7; dx < width - 3; dx += 7) line(c, x + dx, top - 7, x + dx - 3, top - 1, P.tile);
    r(c, x - 3, top + 1, width + 6, 2, P.reveal);
    if (arcade) {
        for (let dx = 7; dx < width - 14; dx += 16) {
            oval(c, x + dx, foot - 20, 11, 13, P.reveal);
            r(c, x + dx, foot - 14, 11, 14, P.reveal);
            r(c, x + dx + 2, foot - 12, 7, 12, P.side);
        }
    } else {
        r(c, x + 7, foot - 17, 9, 17, P.reveal);
        r(c, x + 8, foot - 16, 1, 15, P.plaster);
        for (let dx = 25; dx < width - 15; dx += 19) {
            r(c, x + dx, top + 8, 10, 12, P.reveal);
            r(c, x + dx + 1, top + 9, 8, 9, P.glass);
            r(c, x + dx + 4, top + 9, 1, 9, P.plaster);
        }
    }
    r(c, x + 3, foot - 6, 5, 3, P.side);
    r(c, x + width - 17, top + 5, 6, 3, P.plaster);
    r(c, x - 4, foot, width + 8, 3, P.bank);
}

function mill(c: CanvasRenderingContext2D, x: number, foot: number, time: number) {
    house(c, x, foot, 57, 34, false);
    const hubX = x + 56, hubY = foot - 10, angle = time / 4200;
    // The working wheel is behind the canal bank, on a fixed masonry axle.
    r(c, hubX - 2, hubY - 2, 10, 14, P.side);
    oval(c, hubX - 11, hubY - 11, 23, 23, P.reveal);
    oval(c, hubX - 8, hubY - 8, 17, 17, P.bank);
    for (let spoke = 0; spoke < 8; spoke++) {
        const a = angle + spoke * Math.PI / 4;
        const px = hubX + Math.round(Math.cos(a) * 10), py = hubY + Math.round(Math.sin(a) * 10);
        line(c, hubX, hubY, px, py, P.tile);
        r(c, px - 1, py - 1, 3, 2, P.wall);
    }
    r(c, hubX - 1, hubY - 1, 3, 3, P.reveal);
    r(c, x + 30, foot + 2, 56, 4, P.water);
    r(c, x + 27, foot + 6, 62, 3, P.edge);
}

/** A long, authored arrangement (over four thousand playable pixels per
 * repeat), not a house/tree stamped every screen. Every element in this plane
 * shares one camera transform, including its footing, canal and animation. */
export function drawGuairaDistantSettlement(c: CanvasRenderingContext2D, cx: number, cy: number,
    time: number, kind: GuairaLandscape) {
    if (kind === 'corral' || kind === 'town') return;
    const profile = PROFILES[kind], shift = Math.round(cx * .46) + profile.offset;
    const root = profile.root - Math.round(cy * .36), span = 2048;
    for (let n = Math.floor((shift - 180) / span); n <= Math.floor((shift + 320) / span); n++) {
        const x = n * span - shift;
        // Sloping, connected fields recede into the hills; no detached strips.
        polygon(c, [[x,root+16],[x+160,root-2],[x+340,root+7],[x+530,root-9],
            [x+720,root+2],[x+930,root-4],[x+1160,root+15],[x+1440,root-8],
            [x+1710,root+2],[x+1900,root+9],[x+span,root+16],[x+span,600],[x,600]], P.soil);
        for (const [at, y, w] of [[36,22,176],[286,26,197],[652,19,151],[956,29,218],[1287,24,184],[1707,25,173]]) {
            const xx = x + at, yy = root + y;
            if (xx + w + 25 < 0 || xx > 320) continue;
            polygon(c, [[xx,yy],[xx+w-22,yy-5],[xx+w,yy+4],[xx+18,yy+9]], P.bank);
            polygon(c, [[xx+10,yy+1],[xx+w-24,yy-3],[xx+w-7,yy+3],[xx+22,yy+6]], P.water);
            line(c, xx + 27, yy + 3, xx + w - 35, yy, P.glint);
            const drift = Math.floor((time + at * 13) / 260) % 19;
            for (const offset of [36, 82, 127]) if (offset + 28 < w) {
                const px = offset + drift;
                r(c, xx + px, yy + 3 - Math.round(px / w * 4), 4, 1, P.glint);
            }
            for (let dx = 29; dx < w - 25; dx += 17) {
                const ry = yy + 2 - Math.round(dx / w * 4);
                r(c, xx + dx, ry - 3, 1, 4, P.leaves);
                r(c, xx + dx - 2, ry - 2, 2, 1, P.field);
            }
        }
        for (const [at, yy, tall] of [[14,15,1],[92,7,0],[315,6,1],[350,7,0],[827,1,1],
            [866,0,0],[1197,13,1],[1241,7,0],[1534,-2,1],[1592,0,0],[1943,13,1]]) {
            const xx = x + at;
            if (xx > -18 && xx < 338) orchard(c, xx, root + yy, !!tall, time, at);
        }
        if (kind === 'heights') {
            house(c, x + 151, root + 2, 68, 45, true);
            house(c, x + 219, root + 4, 41, 31, false);
            house(c, x + 495, root - 4, 71, 55, true);
            house(c, x + 1370, root - 1, 57, 40, false);
            house(c, x + 1432, root - 4, 72, 54, true);
            house(c, x + 1812, root + 7, 63, 42, false);
        } else {
            house(c, x + 164, root + 2, 52, 30, false);
            house(c, x + 236, root + 5, 42, 24, false);
            if (x + 490 < 320 && x + 580 > 0) mill(c, x + 490, root - 4, time);
            house(c, x + 989, root + 4, kind === 'junction' ? 91 : 66, 32, true);
            house(c, x + 1410, root - 1, 62, 39, false);
            if (x + 1808 < 320 && x + 1898 > 0) mill(c, x + 1808, root + 7, time + 710);
        }
    }
}
