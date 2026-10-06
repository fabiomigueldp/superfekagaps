import type { SpriteAtlas } from '../graphics/pixels';
import { pixelText } from '../graphics/BitmapFont';
import type { MovingBody } from './WorldPhysics';
import { box as r, oval, pixelLine as line } from './WorldPainting';
import { GEYSER_HOUSINGS, GEYSER_PALETTE } from './WorldGeyserAssets';
import { geyserDroplet, geyserPresentation } from './WorldGeyserState';

const JUICE = { edge: '#653581', shade: '#81449f', body: '#a863c8', light: '#d59ae7', foam: '#edc3f3', shine: '#f4d8f6' };

/** Closing breaks the column into sparse pale beads, already harmless and only falling. */
function drawShutdownDrops(c: CanvasRenderingContext2D, b: MovingBody, mid: number, mouth: number, time: number, cold: boolean) {
    const shutdown = b.jetShutdown;
    if (!b.active || !shutdown) return;
    const elapsed = time - shutdown.at;
    if (elapsed < 0 || elapsed >= 380) return;
    const height = Math.min(shutdown.height, Math.max(0, b.height - 4));
    if (height <= 0) return;
    const count = Math.min(6, Math.ceil(height / 7));
    for (let i = 0; i < count; i++) {
        const depth = (i + .5) / count;
        const distance = height * depth;
        const flight = 110 + Math.sqrt(depth) * 190;
        const progress = Math.min(1, elapsed / flight);
        const side = i % 2 ? 1 : -1;
        const xx = Math.round(mid + side * (2 + progress * 3));
        const yy = Math.round(mouth - distance * (1 - progress * progress));
        if (elapsed < flight) {
            const length = Math.min(3, Math.max(1, mouth - yy));
            r(c, xx, yy, 2, length, cold ? '#d1d9ee' : '#d7b8e5');
            r(c, xx, yy, 1, 1, '#f4d8f6');
        } else if (elapsed < flight + 80) {
            // One low drain fleck, never a new upward burst or a solid purple core.
            r(c, xx + side, mouth, 2, 1, '#cbb9db');
        }
    }
}

/** Pixel-only machine art. Drawing is deterministic and never changes the simulation. */
export function drawGeyser(c: CanvasRenderingContext2D, b: MovingBody, atlas: SpriteAtlas, cx: number, cy: number, time: number, world: number) {
    const s = geyserPresentation(b, time), cold = world === 5;
    const x = Math.round(b.x - cx), w = Math.max(1, Math.round(b.width));
    const floor = Math.round(b.y + b.height - cy), mouth = floor - 4, mid = x + w / 2;
    const hx = Math.round(mid - 21), hy = floor - 16;
    const clock = s.tick, warning = s.phase === 'charging';
    atlas.draw(c, GEYSER_HOUSINGS[cold ? 'cold' : 'factory'], GEYSER_PALETTE, hx, hy);

    // Accumulator sight glass visibly fills before discharge. The three marks are
    // readable without colour: one, two, then three bars, followed by the plume.
    const fill = Math.max(1, Math.round(s.pressure * 10));
    r(c, hx + 35, hy + 21 - fill, 2, fill, b.active ? '#4d6676' : JUICE.body);
    if (!b.active) r(c, hx + 35, hy + 21 - fill, 2, 1, JUICE.foam);
    for (let i = 0; i < 3; i++) {
        const lit = !b.active && s.pressure > .25 + i * .3;
        r(c, hx + 26 + i * 3, hy + 24, 2, 1, lit ? '#f5d488' : '#22384f');
    }
    // Dial stays anchored. Only the needle and a 1px regulator piston react.
    const dx = hx + 1, dy = hy + 3;
    oval(c, dx, dy, 11, 11, '#192c44');
    oval(c, dx + 1, dy + 1, 9, 9, '#967145');
    oval(c, dx + 2, dy + 2, 7, 7, '#f5e7b7');
    r(c, dx + 3, dy + 3, 1, 1, '#6e9ca6'); r(c, dx + 7, dy + 3, 1, 1, '#cf826a');
    const angle = Math.PI * (1.14 + s.pressure * .73);
    line(c, dx + 5, dy + 5, dx + 5 + Math.cos(angle) * 3, dy + 5 + Math.sin(angle) * 3, '#22384f');
    r(c, dx + 5, dy + 5, 1, 1, '#653581');
    const piston = s.pose === 'pressure' && Math.floor(clock / 100) % 2 ? 1 : 0;
    r(c, hx + 12, hy + 3 - piston, 3, 5 + piston, '#192c44');
    r(c, hx + 12, hy + 3 - piston, 3, 1, '#dba94a');
    r(c, hx + 13, hy + 5 - piston, 1, 2 + piston, '#b6d6cb');

    // The valve crosses its spokes when closed; the shutoff cue does not rely on hue.
    const vx = hx + 29, vy = hy + 1;
    oval(c, vx, vy, 8, 8, '#192c44'); oval(c, vx + 1, vy + 1, 6, 6, '#dba94a');
    oval(c, vx + 2, vy + 2, 4, 4, '#365d70');
    if (b.active) {
        line(c, vx + 2, vy + 2, vx + 5, vy + 5, '#f5e7b7');
        line(c, vx + 5, vy + 2, vx + 2, vy + 5, '#f5e7b7');
        r(c, mid - 4, mouth - 1, 8, 2, '#6e9ca6');
        r(c, mid - 3, mouth - 1, 6, 1, '#b6d6cb');
    } else {
        line(c, vx + 4, vy + 1, vx + 4, vy + 6, '#f5e7b7');
        line(c, vx + 1, vy + 4, vx + 6, vy + 4, '#f5e7b7');
    }

    if (s.pose === 'anticipation' || warning) {
        // Bubbles stay in the mouth during the first tell, then squash before bursting.
        const bubbles = s.pose === 'anticipation' ? 1 : s.pose === 'bubble' ? 2 : 3;
        for (let i = 0; i < bubbles; i++) {
            const p = ((clock - 820) / (warning ? 210 : 360) + i * .36) % 1;
            const xx = mid - 4 + i * 3, rise = s.pose === 'pressure' ? 4 : 2;
            if (p < .76) {
                oval(c, xx, mouth - 1 - Math.floor(p * rise), 3, p < .5 ? 3 : 2, JUICE.shade);
                r(c, xx, mouth - 1 - Math.floor(p * rise), 2, 1, JUICE.foam);
            } else {
                r(c, xx - 1, mouth - rise, 1, 1, JUICE.foam);
                r(c, xx + 3, mouth - rise + 1, 1, 1, JUICE.light);
            }
        }
        if (warning) {
            // One steady exclamation, slow two-frame lift. No rapid flashing or screen shake.
            pixelText(c, '!', mid, floor - 27 - (s.pose === 'pressure' ? 1 : 0), '#fff0b4', 1, 'center');
            if (s.pose === 'pressure') {
                line(c, mid - 8, mouth - 4, mid - 10, mouth - 6, '#d59ae7');
                line(c, mid + 8, mouth - 4, mid + 10, mouth - 6, '#d59ae7');
            }
        }
    }

    if (s.danger) {
        const top = Math.round(s.danger.y - cy), height = s.height;
        // Every collidable pixel has opaque purple fluid, even at the narrow neck.
        // The richer winding core changes texture, never the collision envelope.
        r(c, x, top, w, height, JUICE.edge);
        // World and its editor paint into an untransformed native buffer. Keep
        // the original row index so clipping cannot shift the liquid's texture.
        const viewHeight = c.canvas?.height;
        const firstRow = viewHeight === undefined ? 0 : Math.max(0, -top);
        const endRow = Math.min(height, (viewHeight ?? Infinity) - top);
        for (let yy = firstRow; yy < endRow; yy++) {
            const y = top + yy;
            const bend = Math.round(Math.sin((mouth - y) * .2 + clock / 95) * 2);
            const swell = Math.round((1 + Math.sin(yy * .32 + clock / 83)) * (yy < height - 4 ? 1 : .3));
            // Swelling fringe sits outside the conservative solid core; never the reverse.
            r(c, x - swell, y, w + swell * 2, 1, JUICE.edge);
            if (swell) r(c, x + w, y, swell, 1, JUICE.body);
            r(c, x + 1, y, w - 2, 1, JUICE.shade);
            const left = Math.max(x + 1, Math.round(mid - w * .3 + bend));
            const span = Math.min(x + w - 1 - left, Math.max(1, Math.round(w * .6)));
            r(c, left, y, span, 1, JUICE.body);
            const ribbon = Math.max(left, Math.min(left + span - 2, left + 1 + Math.round(Math.sin(yy * .19 + clock / 110) * 2)));
            r(c, ribbon, y, Math.min(2, span), 1, JUICE.light);
            if ((Math.floor((mouth - y + clock / 7) / 5) % 7) === 0)
                r(c, Math.min(x + w - 2, left + span - 2), y, 1, 1, JUICE.foam);
        }
        // A compressed liquid crown stretches on release and folds into the column.
        const crown = Math.min(height, s.pose === 'eruption' ? 5 : 4);
        r(c, x + 1, top, Math.max(1, w - 2), 1, JUICE.light);
        if (crown >= 3) {
            // Three asymmetrical lobes break the top into a heavy liquid crown.
            oval(c, x - 2, top - 1, Math.max(4, Math.ceil(w * .6)), crown + 1, JUICE.body);
            oval(c, Math.round(mid) - 2, top - 3, Math.max(5, Math.floor(w * .65)), crown + 2, JUICE.light);
            oval(c, x + w - 4, top, 6, crown, JUICE.foam);
            oval(c, x + 1, top, Math.max(2, Math.ceil(w * .55)), crown, JUICE.foam);
            oval(c, Math.round(mid), top + 1, Math.max(2, Math.floor(w * .45) - 1), crown - 1, JUICE.light);
            r(c, Math.round(mid), top - 2, 3, 1, JUICE.shine);
            r(c, x, top, 2, 1, JUICE.shine);
        }
        // Beads hang off the silhouette but are pale and detached from the dark core.
        if (height > 15) for (let i = 0; i < 2; i++) {
            const yy = top + 7 + (Math.floor(clock / 45) + i * 13) % Math.max(1, height - 10);
            const side = i ? x + w : x - 1;
            r(c, side, yy, 1, 2, JUICE.light);
        }
    }

    // Burst → falling drops → tiny drain splashes. One phase-locked trajectory,
    // not particles respawning against a moving top during retraction.
    if (!b.active && clock >= 1800 && clock < 2920) {
        for (let i = 0; i < 6; i++) {
            const birth = 1830 + Math.floor(i / 2) * 135;
            const age = (clock - birth) / (650 + i % 2 * 70);
            const originY = mouth - Math.max(0, b.height - 4) * (i < 2 ? .6 : 1);
            const drop = geyserDroplet(age, mid + (i % 2 ? 1 : -1) * w / 2, originY, floor - 1, i % 2 ? 1 : -1, 6 + i);
            if (!drop) continue;
            if (drop.impact) {
                const spread = 1 + Math.floor(drop.progress * 3);
                r(c, drop.x - spread, floor - 1, 1, 1, '#cbb9db');
                r(c, drop.x + spread, floor - 1, 1, 1, '#cbb9db');
                if (drop.progress < .6) r(c, drop.x, floor - 2, 1, 1, '#edc3f3');
            } else {
                const xx = Math.round(drop.x), yy = Math.round(drop.y);
                r(c, xx, yy, 2, 2, cold ? '#d1d9ee' : '#d7b8e5');
                r(c, xx, yy, 1, 1, '#f4d8f6');
                if (drop.progress > .55) r(c, xx + 1, yy - 1, 1, 1, '#d7b8e5');
            }
        }
    }
    drawShutdownDrops(c, b, mid, mouth, time, cold);
    if (s.pose === 'settle') {
        const spread = Math.round(3 + s.progress * 6);
        r(c, mid - spread, floor - 1, 3, 1, '#c69add');
        r(c, mid + spread - 2, floor - 1, 3, 1, '#c69add');
        if (s.progress < .6) r(c, mid - 3, mouth - 1, 6, 1, '#e0b4f1');
    }
    // Foreground lip at the collision floor, with a dark recess above it.
    r(c, mid - 9, floor - 3, 18, 2, '#365d70');
    r(c, mid - 8, floor - 2, 16, 1, cold ? '#e6f4ee' : '#b6d6cb');
    r(c, mid - 7, floor - 1, 14, 1, '#6e9ca6');
}
