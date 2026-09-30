import { SpriteAtlas } from '../graphics/pixels';
import { pixelText } from '../graphics/BitmapFont';
import { BARRELS, PRESSURE_BARRELS, WORLD_PALETTE } from './WorldAssets';
import type { MovingBody, WorldObjects } from './WorldPhysics';
import { box as r, pixelLine as line, oval, polygon, rivet, ink } from './WorldPainting';
import { drawJet, drawCannon } from './WorldMachineArt';
import { drawCarrier, drawCarrierTrack, drawBelt, drawSwitch, drawSupport } from './WorldTransportArt';
function identity(objects: WorldObjects, b: MovingBody) {
    const ids = [...new Set(objects.bodies.filter(s => s.kind === 'switch' && s.link).map(s => s.link!))];
    return ids.indexOf(b.kind === 'switch' ? b.link ?? '' : b.id) + 1;
}
function badge(c: CanvasRenderingContext2D, x: number, y: number, n: number, active: boolean) {
    if (!n)
        return;
    r(c, x - 5, y - 1, 10, 10, ink);
    r(c, x - 4, y, 8, 8, active ? '#a9d38a' : '#e9bb68');
    pixelText(c, String(n), x, y + 1, '#223c53', 1, 'center');
}
export function drawWorldObjects(c: CanvasRenderingContext2D, objects: WorldObjects, atlas: SpriteAtlas, cx: number, cy: number, time: number, world: number) {
    // Moving parts use the physics clock, including hit stop and paused previews.
    time = objects.time;
    for (const b of objects.bodies) {
        const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = b.width, h = b.height, mark = identity(objects, b);
        drawCarrierTrack(c, b, cx, cy);
        if (x + w < -30 || x > 350 || y > 200 || y + h < -30) continue;
        if (['platform', 'lift', 'swing'].includes(b.kind)) {
            drawCarrier(c, b, cx, cy, time, world);
            badge(c, x + w / 2, y + h + 8, mark, b.active);
        } else if (b.kind === 'support') {
            drawSupport(c, b, cx, cy, time);
            badge(c, x + w / 2, y + h + 8, mark, b.active);
        } else if (b.kind === 'belt') {
            drawBelt(c, b, cx, cy, time, world);
            badge(c, x + w / 2, y + h + 14, mark, b.active);
        } else if (b.kind === 'switch') {
            drawSwitch(c, b, cx, cy, time, world);
            badge(c, x + w / 2, y + h + 11, mark, b.active);
        }
        else if (b.kind === 'jet') {
            drawJet(c, b, atlas, cx, cy, objects.time, world);
            badge(c, x + w / 2, y + h + 13, mark, b.active);
        }
        else if (b.kind === 'target') {
            if (!b.active) {
                const cold = world === 5;
                r(c, x, y, w, h, ink);
                r(c, x + 1, y + 1, w - 2, h - 2, cold ? '#5b9cc1' : '#64729e');
                polygon(c, [[x + 2, y + 3], [x + w - 2, y + 1], [x + w - 2, y + h - 5], [x + 3, y + h - 2]], cold ? '#b6e5eb' : '#b2aed3');
                r(c, x + 3, y + 4, 2, h - 10, cold ? '#edfff1' : '#ece4f1');
                line(c, x + w - 3, y + 7, x + 6, y + h * .5, cold ? '#6aabcc' : '#8177a8');
                line(c, x + 6, y + h * .5, x + w - 4, y + h - 3, cold ? '#6aabcc' : '#8177a8');
                for (const yy of [y + 2, y + h - 6]) {
                    r(c, x, yy, w, 3, b.pressurized ? '#bc9556' : '#6c8c9e');
                    r(c, x + 1, yy, w - 2, 1, b.pressurized ? '#efd395' : '#c5d9dd');
                    rivet(c, x + 2, yy);
                }
                const mid = x + w / 2;
                r(c, mid - 5, y + h / 2 - 6, 10, 13, ink);
                r(c, mid - 4, y + h / 2 - 5, 8, 11, b.pressurized ? '#f3d58e' : '#dad4e8');
                if (b.pressurized) {
                    polygon(c, [[mid, y + h / 2 - 4], [mid + 3, y + h / 2 + 1], [mid + 2, y + h / 2 + 4], [mid - 2, y + h / 2 + 4], [mid - 3, y + h / 2 + 1]], '#8550af');
                    r(c, mid - 1, y + h / 2, 1, 3, '#e4b3ef');
                    r(c, x + 2, y + 6, 2, 4, '#f4eee1');
                    r(c, x + w - 4, y + 9, 2, 3, '#d5f2ed');
                } else pixelText(c, '×', mid, y + h / 2 - 3, '#54476e', 1, 'center');
                if (cold) for (let xx = x + 2; xx < x + w - 2; xx += 6) {
                    r(c, xx, y, 4, 2, '#eff9ee');
                    r(c, xx + 1, y + 2, 1, 3, '#d1eef0');
                }
                const impact = b.hitAt === undefined ? Infinity : objects.time - b.hitAt;
                if (impact < 180) {
                    line(c, x, y + 1, x, y + h - 1, '#fff5ce');
                    line(c, x + w - 1, y + 1, x + w - 1, y + h - 1, '#fff5ce');
                    for (const dir of [-1, 1]) r(c, mid + dir * (w / 2 + impact / 30), y + h / 2, 2, 2, '#f6d69d');
                }
            }
            else {
                r(c, x + 1, y + h - 3, w - 2, 3, '#8eafbd');
                for (let i = 0; i < w; i += 5)
                    r(c, x + i, y + h - 5 - i % 2, 3, 3, '#c4e5ed');
                const age = b.brokenAt === undefined ? Infinity : objects.time - b.brokenAt;
                if (age < 450) for (let i = 0; i < 7; i++) {
                    const t = age / 450, dir = i % 2 ? 1 : -1;
                    const xx = x + w / 2 + dir * t * (12 + i * 3);
                    const yy = y + h * (i / 8) - t * 16 + t * t * 36;
                    polygon(c, [[xx, yy], [xx + 4, yy + 1], [xx + 1, yy + 6]], i % 2 ? '#e6f4ee' : '#97ccdf');
                }
            }
        }
        else if (b.kind === 'launcher') {
            drawCannon(c, b, atlas, cx, cy, objects.time, world);
        }
    }
    for (const p of objects.barrels) {
        if (p.x + p.width < cx - 16 || p.x > cx + 336) continue;
        const frames = p.pressurized ? PRESSURE_BARRELS : BARRELS;
        const index = ((Math.floor(p.rotation / (Math.PI * 2) * frames.length) % frames.length) + frames.length) % frames.length;
        const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
        if (p.vy === 0) oval(c, x - 1, y + p.height - 1, 16, 3, '#263143');
        atlas.draw(c, frames[index], WORLD_PALETTE, x - 3, y - 4);
        const impact = p.landedAt === undefined ? Infinity : objects.time - p.landedAt;
        if (impact < 180) for (const dir of [-1, 1]) {
            r(c, x + 6 + dir * (8 + impact / 18), y + p.height - 2, 3, 1, '#d0c8b3');
            r(c, x + 6 + dir * (5 + impact / 24), y + p.height - 4, 1, 1, '#b5baa9');
        }
        if (p.returned) {
            const behind = p.vx < 0 ? x + p.width + 3 : x - 4, dir = p.vx < 0 ? 1 : -1;
            r(c, behind, y + 8, 3, 2, '#c3de85');
            r(c, behind + dir * 5, y + 10, 2, 1, '#92b46e');
        }
        if (p.pressurized && Math.floor(objects.time / 90) % 3 === 0)
            r(c, x + 6, y - 6, 2, 2, '#e1d0f1');
    }
}
