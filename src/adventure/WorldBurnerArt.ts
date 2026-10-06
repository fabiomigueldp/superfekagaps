import { PixelGrid, SpriteAtlas, type PixelFrame } from '../graphics/pixels';
import { pixelText } from '../graphics/BitmapFont';
import { WORLD_PALETTE } from './WorldAssets';
import { jetCycle } from './WorldMachineState';
import type { MovingBody } from './WorldPhysics';
import { box as r, oval, pixelLine as line } from './WorldPainting';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** No independent heat clock: pause and manual valve rearming follow the actual jet state. */
export function burnerPresentation(b: MovingBody, time: number) {
    const cycle = jetCycle(b, time);
    const preheat = cycle.phase === 'charging' ? clamp((cycle.pressure - .2) / .8) : 0;
    const heat = b.active ? 0 : cycle.danger ? 1 : cycle.phase === 'charging' ? .2 + preheat * .55 : cycle.vent * .7;
    return { ...cycle, preheat, heat };
}
function ellipse(g: PixelGrid, x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) {
        const half = Math.sqrt(Math.max(0, 1 - ((j + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        g.rect(Math.ceil(x + w / 2 - half), y + j, Math.floor(half * 2), 1, color);
    }
}
function burnerBase(): PixelFrame {
    const g = new PixelGrid(42, 30);
    // Cast-iron plenum with a terracotta face, separate feet and a charcoal seam.
    g.rect(3, 15, 36, 11, 'K').rect(4, 16, 34, 8, 'o');
    g.rect(5, 16, 32, 2, 'O').rect(5, 18, 3, 5, 'F').rect(35, 18, 3, 6, 'h');
    g.rect(2, 25, 38, 4, 'K').rect(3, 25, 36, 1, 'i').rect(4, 27, 8, 2, 'n').rect(31, 27, 8, 2, 'n');
    // Ceramic-lined cup has a deep throat. Warm brass above, dark iron beneath.
    g.rect(12, 9, 18, 9, 'K').rect(13, 10, 16, 7, 'y').rect(14, 10, 13, 2, 'Y');
    ellipse(g, 9, 5, 24, 11, 'K'); ellipse(g, 10, 6, 22, 9, 'y');
    ellipse(g, 11, 6, 20, 7, 'I'); ellipse(g, 13, 7, 16, 5, 'i');
    ellipse(g, 14, 8, 14, 4, 'K'); g.rect(15, 9, 12, 2, 'h');
    g.rect(11, 12, 20, 3, 'O').rect(12, 12, 17, 1, 'Y').rect(13, 15, 16, 1, 'h');
    // Brackets and side gas feed explain how the burner belongs to the oven.
    g.rect(6, 9, 3, 9, 'K').rect(6, 10, 1, 6, 'i');
    g.rect(33, 10, 4, 9, 'K').rect(34, 11, 2, 7, 'N').rect(34, 11, 1, 5, 'E');
    g.rect(33, 7, 7, 4, 'K').rect(34, 8, 5, 2, 'i').dot(34, 8, 'I');
    // Three firebox ports are recessed, not painted stripes on the plenum.
    for (const x of [12, 18, 24]) g.rect(x, 18, 4, 6, 'K').rect(x + 1, 19, 2, 4, 'h');
    for (const x of [5, 34]) { g.rect(x, 19, 3, 3, 'K').rect(x, 19, 2, 1, 'I').dot(x, 20, 'i'); }
    return g.finish();
}
const BASE = burnerBase();

/** World 6 uses a dense flame envelope over every dangerous pixel, including its upper corners. */
export function drawBurner(c: CanvasRenderingContext2D, b: MovingBody, atlas: SpriteAtlas, cx: number, cy: number, time: number, _world: number) {
    const s = burnerPresentation(b, time), x = Math.round(b.x - cx), w = Math.max(1, Math.round(b.width));
    const floor = Math.round(b.y + b.height - cy), mid = Math.round(x + w / 2), baseY = floor - 16;
    atlas.draw(c, BASE, WORLD_PALETTE, mid - 21, baseY);
    // Heating is communicated by steady brightness and three filling ports, never strobes.
    for (let i = 0; i < 3; i++) {
        const hot = s.heat > i * .23;
        r(c, mid - 8 + i * 6, floor + 3, 2, 3, hot ? s.heat > .8 ? '#ffdd85' : '#df8a4f' : '#60464a');
        if (hot) r(c, mid - 8 + i * 6, floor + 3, 2, 1, s.heat > .8 ? '#fff1bf' : '#eab773');
    }
    if (s.heat > .4) {
        r(c, mid - 7, floor - 1, 14, 1, s.heat > .8 ? '#ffc77f' : '#ce8355');
        r(c, mid - 5, floor + 1, 10, 1, '#9c5646');
    }
    // A tiny recessed pilot is safe and stays in the mouth, distinct from the full column.
    if (!b.active && !s.danger && s.phase !== 'venting') {
        const pilot = s.phase === 'charging' ? 2 + Math.round(s.preheat * 3) : 1;
        r(c, mid - 2, floor - 5 - pilot, 3, pilot, '#e88b4d');
        r(c, mid - 1, floor - 5 - Math.max(1, pilot - 1), 1, Math.max(1, pilot - 1), '#ffe5a1');
    }
    if (s.phase === 'charging') {
        // The sign has its own backing so the oven's bright tiles cannot hide the warning.
        r(c, mid - 4, floor - 28, 8, 11, '#192c44');
        r(c, mid - 3, floor - 27, 6, 9, '#553e41');
        pixelText(c, '!', mid, floor - 26, '#ffe6a0', 1, 'center');
        // Slow pressure seep and a single contained igniter glint, all below the sign.
        if (s.preheat > .25) {
            const p = (time % 420) / 420;
            r(c, mid - 5 - Math.round(p * 2), floor - 8 - Math.round(p * 4), 2, 1, '#be9a80');
            r(c, mid + 4 + Math.round(p * 2), floor - 7 - Math.round(p * 3), 1, 1, '#cfaa82');
        }
        if (s.preheat > .75) r(c, mid + 4, floor - 9, 1, 2, '#fff0bd');
    }
    if (s.danger) {
        const top = Math.round(s.danger.y - cy), bottom = top + s.height, height = s.height;
        // This warm continuous envelope is deliberate: the physics is a rectangle.
        // Tongues may brighten or break up inside it, but cannot erase a dangerous corner.
        r(c, x, top, w, height, '#b4513e');
        // Clip only texture scanlines, retaining their original depth/phase.
        // The game and editor both use an untransformed native world buffer.
        const viewHeight = c.canvas?.height;
        const firstRow = viewHeight === undefined ? top : Math.max(0, top);
        const endRow = Math.min(bottom, viewHeight ?? Infinity);
        for (let yy = firstRow; yy < endRow; yy++) {
            const depth = (yy - top) / Math.max(1, height), motion = Math.sin((yy - top) * .43 + time / 94);
            const left = x + 1 + (motion > .45 ? 1 : 0), right = x + w - 1 - (motion < -.45 ? 1 : 0);
            r(c, left, yy, Math.max(1, right - left), 1, '#e98343');
            const center = mid + Math.round(Math.sin((yy - top) * .23 + time / 112));
            const hotWidth = Math.max(1, Math.round(2 + depth * 5 + Math.sin((yy - top) * .37 - time / 81)));
            const coreX = Math.max(x + 1, Math.min(x + w - hotWidth - 1, center - Math.floor(hotWidth / 2)));
            r(c, coreX, yy, Math.min(w - 2, hotWidth), 1, depth > .3 ? '#ffd17a' : '#f4ad57');
            if (depth > .62) r(c, Math.max(x + 1, center - 1), yy, Math.min(2, w - 2), 1, '#fff0b5');
        }
        // One-pixel attached licks break the straight edge without hiding any dangerous area.
        if (height > 12) for (let yy = top + 5; yy < bottom - 3; yy += 7) {
            const left = Math.sin((yy - top) * .38 + time / 120) > 0;
            r(c, left ? x - 1 : x + w, yy, 1, 2, '#d87242');
        }
        // Offset tongues soften the top silhouette *outside* the already visible danger.
        if (height > 8) for (let i = 0; i < 3; i++) {
            const xx = x + 1 + Math.round(i * Math.max(0, w - 4) / 2), lift = 1 + (Math.floor(time / 110) + i) % 3;
            r(c, xx, top - lift, 2, lift, i === 1 ? '#f5b35f' : '#d87242');
            r(c, xx, top, 2, 2, '#f8be6d');
        }
        // Tiny embers rise away; they never add damage above or beside the dense column.
        if (height > 16) for (let i = 0; i < 3; i++) {
            const p = ((time / 650 + i / 3) % 1 + 1) % 1;
            const xx = mid + (i % 2 ? 1 : -1) * (3 + Math.round(p * 5));
            const yy = top - 2 - Math.round(p * 8);
            if (p < .8) r(c, xx, yy, 1, p < .3 ? 2 : 1, p < .4 ? '#ffd284' : '#c07852');
        }
    }
    if (s.vent > 0) {
        const p = 1 - s.vent;
        // The hazardous column is already gone: cooling is low, disconnected and subdued.
        for (let i = 0; i < 3; i++) {
            const xx = mid + (i - 1) * (3 + Math.round(p * 5)), yy = floor - 8 - Math.round(p * (7 + i * 3));
            if (p < .8) r(c, xx, yy, p < .35 ? 2 : 1, 1, '#c4aa89');
        }
        if (p < .45) for (const d of [-1, 1]) r(c, mid + d * (4 + Math.round(p * 6)), floor - 5 - Math.round(p * 7), 1, 1, '#d58950');
    }
    // Foreground ceramic lip puts both pilot and flame inside the cup; it is below danger.
    oval(c, mid - 9, floor - 4, 18, 4, '#70433c');
    r(c, mid - 8, floor - 4, 16, 1, s.heat > .65 ? '#f2c88e' : '#ccb28d');
    line(c, mid - 7, floor - 2, mid + 6, floor - 2, '#b4774c');
    if (b.active) { r(c, mid - 6, floor - 5, 12, 1, '#334454'); r(c, mid - 2, floor + 4, 4, 1, '#667c78'); }
}
