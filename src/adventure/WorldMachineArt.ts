import { SpriteAtlas } from '../graphics/pixels';
import { pixelText } from '../graphics/BitmapFont';
import { WORLD_PALETTE } from './WorldAssets';
import { CANNONS, NOZZLES } from './WorldMachineAssets';
import { cannonCycle, cannonMuzzle, jetCycle } from './WorldMachineState';
import type { MovingBody } from './WorldPhysics';
import { box as r, oval, polygon, pixelLine as line } from './WorldPainting';

export function drawJet(c: CanvasRenderingContext2D, b: MovingBody, atlas: SpriteAtlas, cx: number, cy: number, time: number, world: number) {
    const cycle = jetCycle(b, time), heat = world === 6, cold = world === 5;
    const x = Math.round(b.x - cx), w = Math.round(b.width), floor = Math.round(b.y + b.height - cy), mid = x + w / 2;
    const skin = heat ? 'oven' : cold ? 'cold' : 'factory';
    const stage = cycle.height ? 2 : cycle.phase === 'charging' ? 1 : cycle.phase === 'venting' ? 3 : 0;
    atlas.draw(c, NOZZLES[skin][stage], WORLD_PALETTE, mid - 18, floor - 16);
    const dialX = Math.round(mid - 18), dialY = floor - 10;
    oval(c, dialX, dialY, 9, 9, '#192c44');
    oval(c, dialX + 1, dialY + 1, 7, 7, '#f5e7b7');
    r(c, dialX + 6, dialY + 2, 1, 1, '#df9968');
    const angle = Math.PI * (1.15 + cycle.pressure * .7);
    line(c, dialX + 4, dialY + 4, dialX + 4 + Math.cos(angle) * 3, dialY + 4 + Math.sin(angle) * 3, '#22384f');
    if (b.active) {
        r(c, mid - 2, floor + 6, 5, 2, '#78938f');
        r(c, mid - 1, floor - 6, 2, 1, '#a2b5b8');
    }
    // Charging is deliberately short mist: distinct from the full, dangerous plume.
    if (cycle.phase === 'charging') {
        const amount = (cycle.pressure - .2) / .8;
        for (let i = 0; i < 3; i++) {
            const p = (time / 260 + i / 3) % 1;
            r(c, mid - 4 + i * 3, floor - 7 - p * (3 + amount * 5), 1 + i % 2, 2, heat ? '#f6bb6c' : '#ddbeeb');
        }
        // Pulse is slow enough to read at the native resolution, without strobing.
        pixelText(c, '!', mid, floor - 27 - Math.floor(time / 180) % 2, '#fff0b4', 1, 'center');
        r(c, mid - 2, floor + 6, 4, 2, Math.floor(time / 180) % 2 ? '#f4d68a' : '#be913f');
    }
    if (cycle.danger) {
        const top = Math.round(cycle.danger.y - cy), height = cycle.height, bottom = floor - 4;
        if (heat) {
            // Three different tongues share the same rising/falling envelope as the juice.
            polygon(c, [[x, bottom], [x, top + height * .45], [x + 3, top + height * .23], [x + 4, top], [x + 7, top + height * .35], [x + w - 2, top + height * .16], [x + w, bottom]], '#a94849');
            for (let i = 0; i < 3; i++) {
                const xx = x + 1 + i * 4, sway = Math.round(Math.sin(time / 70 + i * 3));
                polygon(c, [[xx, bottom], [xx + sway, top + height * (.1 + i * .16)], [xx + 3, top + height * .55], [xx + 4, bottom]], i === 1 ? '#ffe39b' : '#f29a52');
            }
            r(c, mid - 2, bottom - Math.min(6, height), 4, Math.min(6, height), '#fff0bd');
        } else {
            // A continuous dark silhouette, a winding liquid core and isolated bubbles.
            // No horizontal bands: the motion reads as fluid moving upward.
            for (let yy = top; yy < bottom; yy++) {
                const nearMouth = (yy - top) / Math.max(1, height);
                const ripple = Math.sin(yy * .43 + time / 80);
                const span = Math.round(Math.min(w, w - nearMouth * 4 + ripple * 1.5));
                const left = Math.round(mid - span / 2 + Math.sin(yy * .23 + time / 150));
                const xx = Math.max(x, left), width = Math.min(span, x + w - xx);
                const core = Math.round(Math.sin(yy * .19 + time / 120));
                r(c, xx, yy, width, 1, '#653581');
                r(c, xx + 1, yy, width - 2, 1, '#a863c8');
                r(c, Math.min(xx + width - 4, xx + 2 + core), yy, 3, 1, '#d59ae7');
                r(c, xx + width - 2, yy, 1, 1, '#81449f');
            }
            if (height >= 5) {
                oval(c, x, top, w, 5, '#dcaaf0');
                oval(c, x + 1, top, 5, 3, '#f4d8f6');
                oval(c, x + w - 5, top + 1, 4, 3, '#f4d8f6');
                r(c, x + 3, top + 4, 2, 2, '#edc3f3');
            }
            for (let i = 0; i < 4 && height > 9; i++) {
                const yy = bottom - 4 - ((time / 9 + i * 11) % (height - 5));
                r(c, x + 2 + i * 2, yy, 2, 2, i % 2 ? '#eac2f3' : '#c68bdf');
            }
        }
        // Small detached droplets/embers are decoration, never invisible damage.
        if (height > 16) for (let i = 0; i < 4; i++) {
            const p = (time / 500 + i / 4) % 1, dir = i % 2 ? 1 : -1;
            const xx = mid + dir * (w / 2 + p * 5), yy = top + 5 + p * p * 13 - p * 6;
            r(c, xx, yy, 1 + i % 2, 2, heat ? '#ffd291' : cold ? '#e3e5f5' : '#dfb6ef');
        }
    }
    if (cycle.vent > 0) {
        for (let i = 0; i < 4; i++) {
            const t = 1 - cycle.vent, dir = i % 2 ? 1 : -1;
            const xx = mid + dir * (3 + t * (6 + i)), yy = floor - 8 - t * (8 + i * 2);
            r(c, xx, yy, cycle.vent > .5 ? 3 : 2, 1, heat ? '#c6ab94' : '#b7b4d6');
        }
    }
    // Foreground flange makes the column visibly emerge from inside the nozzle.
    r(c, mid - 8, floor - 2, 16, 1, heat ? '#f4bc70' : '#d2dfda');
}

export function drawCannon(c: CanvasRenderingContext2D, b: MovingBody, atlas: SpriteAtlas, cx: number, cy: number, time: number, world: number) {
    const state = cannonCycle(b, time), dir = b.direction ?? -1, cold = world === 5 || b.pressurized;
    const x = Math.round(b.x + b.width / 2 - 24 - cx), y = Math.round(b.y + b.height - 28 - cy);
    const muzzle = cannonMuzzle(b), mx = Math.round(muzzle.x - cx), my = Math.round(muzzle.y - cy);
    atlas.draw(c, CANNONS[cold ? 'cold' : 'factory'][state.pose], WORLD_PALETTE, x, y, dir > 0);
    if (state.pose === 'charge') {
        pixelText(c, '!', x + 25, y - 9 - Math.floor(time / 180) % 2, '#ffe6a0', 1, 'center');
        const pulse = Math.floor(time / 90) % 3;
        line(c, mx + dir * 4, my - 4 - pulse, mx + dir * (6 + pulse), my - 6 - pulse, '#d4b5e8');
        line(c, mx + dir * 4, my + 4 + pulse, mx + dir * (6 + pulse), my + 6 + pulse, '#d4b5e8');
    }
    if (state.elapsed < 180) {
        const p = state.elapsed / 180, length = Math.round(5 + p * 14);
        if (p < .6) polygon(c, [[mx, my - 5], [mx + dir * length, my - 3], [mx + dir * (length + 4), my], [mx + dir * length, my + 3], [mx, my + 5]], '#deb7ec');
        for (let i = 0; i < 5; i++) {
            const xx = mx + dir * (3 + p * (12 + i * 4)), yy = my + (i - 2) * (1 + p * 3);
            r(c, xx, yy, p < .5 ? 3 : 2, 2, i % 2 ? '#f6dcf4' : '#af7ccc');
        }
    }
    if (state.elapsed >= 180 && state.elapsed < 480) {
        const p = (state.elapsed - 180) / 300;
        for (let i = 0; i < 3; i++) r(c, mx - dir * (3 + i * 2), my - 7 - p * (8 + i * 3), 2, 1, '#c6cbd4');
    }
}
