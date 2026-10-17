import { box as r, pixelLine as line, polygon, oval } from '../../WorldPainting';
import { sceneryTime } from './GuairaScenery';

/** The workshop's background has its own muted values. Cream landing caps,
 * saturated water and the cracked clay pattern belong to gameplay objects. */
const P = {
    shadow: '#a18469', reveal: '#b99777', wall: '#cfad88', edge: '#dbc099',
    timber: '#ac8b69', grain: '#bd9d77', iron: '#89917d', glass: '#c4c9ad',
    sky: '#d6dac1', hill: '#b0b093', field: '#a0aa89', light: '#dfbf95',
};

/** Pixel-authored fan: twelve restrained poses over a long cycle, with a fixed
 * axle and grille. This is ventilation behind glass, never a pressure warning. */
export function workshopFanPose(time: number, reducedMotion: boolean, phase = 0): number {
    return Math.floor((sceneryTime(time, reducedMotion) + (reducedMotion ? 0 : phase)) / 150) % 12;
}

function fan(c: CanvasRenderingContext2D, x: number, y: number, time: number, reduced: boolean, phase: number) {
    oval(c, x - 15, y - 15, 31, 31, P.reveal);
    oval(c, x - 12, y - 12, 25, 25, P.shadow);
    oval(c, x - 10, y - 10, 21, 21, '#bcc0a4');
    const turn = workshopFanPose(time, reduced, phase) * Math.PI / 24;
    for (let blade = 0; blade < 4; blade++) {
        const a = turn + blade * Math.PI / 2;
        const point = (angle: number, radius: number): readonly [number, number] =>
            [x + Math.round(Math.cos(angle) * radius), y + Math.round(Math.sin(angle) * radius)];
        polygon(c, [point(a, 2), point(a - .27, 8), point(a + .24, 9), point(a + .7, 4)], P.iron);
    }
    // Grille crosses above the blades, attached to the fixed outer surround.
    for (const dx of [-6, 6]) line(c, x + dx, y - 9, x + dx, y + 9, '#b29d7c');
    r(c, x - 2, y - 2, 5, 5, P.shadow);
    r(c, x - 1, y - 1, 2, 2, P.edge);
    for (const [dx, dy] of [[0,-13],[13,0],[0,13],[-13,0]]) r(c, x + dx, y + dy, 1, 1, P.edge);
}

/** An upper window admits the same olive hills seen outside. Stone voussoirs,
 * inset glazing and clipped light give depth without drawing a usable ledge. */
export function drawWorkshopClerestory(c: CanvasRenderingContext2D, x: number, y: number, width: number,
    time: number, reducedMotion: boolean, ventilated = false) {
    if (x + width + 12 < 0 || x - 12 > 320 || y > 180 || y + 89 < 23) return;
    const height = 42;
    polygon(c, [[x-5,y+8],[x+4,y-3],[x+width-5,y-3],[x+width+5,y+8],
        [x+width+5,y+height+4],[x-5,y+height+4]], P.reveal);
    r(c, x - 2, y + 8, width + 4, height - 8, P.shadow);
    r(c, x + 2, y + 5, width - 4, height - 7, P.glass);
    r(c, x + 3, y + 6, width - 6, 17, P.sky);
    polygon(c, [[x+3,y+26],[x+width*.22,y+16],[x+width*.45,y+24],
        [x+width*.68,y+18],[x+width-3,y+29],[x+width-3,y+39],[x+3,y+39]], P.hill);
    r(c, x + 3, y + 34, width - 6, 5, P.field);
    r(c, x + 5, y + 36, width - 10, 1, '#b5b99a');
    for (let xx = 17; xx < width - 7; xx += 23) {
        r(c, x + xx, y + 5, 3, height - 8, P.shadow);
        r(c, x + xx + 1, y + 6, 1, height - 10, P.edge);
        // The pane's light stays on the background wall; terrain paints over it.
        polygon(c, [[x+xx-12,y+height+4],[x+xx-2,y+height+4],
            [x+xx-21,y+height+41],[x+xx-30,y+height+41]], P.light);
    }
    r(c, x + 2, y + 6, 2, height - 9, P.reveal);
    r(c, x + 3, y + 6, width - 6, 2, P.reveal);
    for (let xx = 11; xx < width - 7; xx += 18) {
        r(c, x + xx, y - 2, 1, 5, P.shadow);
        r(c, x + xx + 2, y, 7, 1, P.edge);
    }
    if (ventilated) fan(c, x + Math.round(width / 2), y + 22, time, reducedMotion, 0);
}

/** Long uprights and diagonal timber joints explain the roof's construction.
 * No cream horizontal stripe: the background never promises collision. */
export function drawWorkshopRoofFrame(c: CanvasRenderingContext2D, cx: number, cy: number,
    left: number, right: number, top: number, bottom: number) {
    r(c, left - cx, top - cy, right - left, 7, P.shadow);
    r(c, left - cx, top + 1 - cy, right - left, 2, P.timber);
    for (let worldX = left + 18; worldX < right; worldX += 128) {
        const x = worldX - cx, y = top - cy;
        if (x + 48 < 0 || x - 48 > 320) continue;
        r(c, x, y + 6, 5, bottom - top - 6, P.timber);
        r(c, x + 1, y + 9, 1, bottom - top - 12, P.grain);
        for (const direction of [-1, 1]) {
            line(c, x + 2, y + 38, x + 2 + 35 * direction, y + 6, P.shadow, 4);
            line(c, x + 2, y + 36, x + 2 + 33 * direction, y + 6, P.grain);
        }
        r(c, x - 2, y + 28, 9, 7, '#a38e73');
        r(c, x, y + 30, 1, 1, P.edge); r(c, x + 4, y + 33, 1, 1, P.edge);
        r(c, x - 2, bottom - 8 - cy, 9, 7, P.reveal);
        r(c, x, bottom - 6 - cy, 1, 1, P.edge); r(c, x + 4, bottom - 4 - cy, 1, 1, P.edge);
    }
}

/** Low-contrast cut stone beside a recess ties plaster to the older foundation.
 * Staggered joints and rubbed edges replace broad featureless shafts. */
export function drawWorkshopMasonryReveal(c: CanvasRenderingContext2D, x: number, y: number, height: number, right = false) {
    if (x + 16 < 0 || x > 320 || y > 180 || y + height < 23) return;
    for (let yy = 0, row = 0; yy < height; yy += 17, row++) {
        const w = row % 2 ? 10 : 14, h = Math.min(16, height - yy), xx = x + (right ? 14 - w : 0);
        r(c, xx, y + yy, w, h, P.reveal);
        r(c, xx + 1, y + yy + 1, w - 2, Math.max(1, h - 3), row % 3 ? '#bea17e' : '#c4a783');
        r(c, xx + 2, y + yy + 2, Math.max(1, w - 5), 1, '#cfb18b');
        if (h > 7) r(c, xx + w - 3, y + yy + 5, 1, 3, '#b79877');
    }
}
