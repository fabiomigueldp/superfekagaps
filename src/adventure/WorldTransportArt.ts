import { pixelText } from '../graphics/BitmapFont';
import type { MovingBody } from './WorldPhysics';
import { box as r, pixelLine as line, polygon, oval, rivet, wheel, steelBeam, ink } from './WorldPainting';

import type { MechanismMount } from './types';
import type { WorldLevel } from './WorldPhysics';
import { carrierDistance } from './WorldCarrierMotion';
import { carrierFamily, carrierMounts, carrierStructureBounds, carrierWheelCenters, carrierRenderRoute as carrierRoute, carrierRenderTrolley as carrierTrolley } from './WorldCarrierStructure';

/** Wheel angle comes from signed route distance: pause and terminal dwell freeze it. */
const travel = carrierDistance;
export function carrierWheelTravel(b: MovingBody): number {
    const route = carrierRoute(b);
    if (!route) return 0;
    return travel(b) * Math.sign(route.to.x !== route.home.x ? route.to.x - route.home.x : route.to.y - route.home.y);
}
/** Shared wheel() has an eight-pixel hub; small transport bearings need their own
 * visible spoke so real travel and reversal can still be read at native size. */
export function drawCarrierBearing(c: CanvasRenderingContext2D, x: number, y: number, distance: number) {
    x = Math.round(x); y = Math.round(y);
    oval(c, x - 4, y - 4, 9, 9, ink);
    oval(c, x - 3, y - 3, 7, 7, '#bba168');
    oval(c, x - 2, y - 2, 5, 5, '#3a596d');
    const angle = distance / 4, dx = Math.cos(angle) * 2, dy = Math.sin(angle) * 2;
    line(c, x - dx, y - dy, x + dx, y + dy, '#e6ce8a');
    r(c, x, y, 1, 1, '#adc4c2');
}
const age = (b: MovingBody, time: number) => b.active !== b.observedActive ? 0 : b.changedAt === undefined ? Infinity : Math.max(0, time - b.changedAt);
function light(c: CanvasRenderingContext2D, x: number, y: number, b: MovingBody, time: number) {
    const flash = age(b, time) < 450;
    r(c, x, y, 8, 5, ink);
    r(c, x + 1, y + 1, 6, 3, b.active ? '#83b77f' : '#a88d5d');
    r(c, x + 2, y + 1, 3, 1, flash ? '#f3e4ad' : b.active ? '#d1e9ad' : '#e9c77e');
}
function deck(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, world: number, cargo: boolean) {
    steelBeam(c, x, y, w, h);
    r(c, x, y, w, 2, world === 5 ? '#e1f1e9' : world === 4 ? '#f2da92' : '#d8e4d4');
    if (cargo) {
        r(c, x + 2, y + 2, w - 4, Math.max(2, h - 3), world === 6 ? '#b98668' : '#9c795d');
        for (let xx = x + 3; xx < x + w - 3; xx += 12) {
            r(c, xx, y + 3, 8, 1, '#d9b788');
            line(c, xx + 9, y + 2, xx + 9, y + h - 2, '#534854');
        }
    } else for (let i = 3; i < w - 6; i += 12) {
        polygon(c, [[x + i, y + 3], [x + i + 4, y + 3], [x + i + 1, y + h - 1], [x + i - 2, y + h - 1]], '#d1ac61');
    }
    for (const xx of [x + 2, x + w - 5]) rivet(c, xx, y + 3);
    if (world === 5) for (let xx = x + 9; xx < x + w - 6; xx += 19) {
        r(c, xx, y + h - 1, 5, 1, '#e2f3ed');
        r(c, xx + 2, y + h, 1, 3, '#a7d5e1');
    }
}

/** A dark rear-plane mast/cantilever is bolted to terrain, not to backdrop art. */
function mount(c: CanvasRenderingContext2D, m: MechanismMount, target: { x: number; y: number }, cx: number, cy: number) {
    const x = m.x - cx, y = m.y - cy, tx = target.x - cx, ty = target.y - cy;
    if (m.kind === 'wall') {
        r(c, x - 3, y - 7, 6, 14, ink);
        r(c, x - 2, y - 6, 4, 12, '#526a77');
        rivet(c, x - 1, y - 5); rivet(c, x - 1, y + 3);
        line(c, x, y, tx, ty, '#283f55', 4);
        line(c, x, y - 5, tx, ty - 8, '#82979b');
        return;
    }
    const top = Math.min(ty - 3, y - 12);
    r(c, x - 3, top, 6, y - top, '#283f55');
    r(c, x - 1, top + 1, 2, y - top - 1, '#617b86');
    for (let yy = top + 13; yy < y - 6; yy += 23) {
        line(c, x - 2, yy - 7, x + 2, yy, '#8ca0a2');
        r(c, x - 3, yy + 2, 6, 2, '#405c70');
    }
    line(c, x, ty, tx, ty, '#283f55', 4);
    line(c, x, ty, tx, ty, '#82979b');
    if (Math.abs(tx - x) > 9) {
        const knee = Math.min(y - 5, ty + Math.max(15, Math.min(42, Math.abs(tx - x) * .55)));
        line(c, x, knee, tx, ty, '#405c70', 3);
        line(c, x + 1, knee, tx, ty + 1, '#82979b');
    }
    r(c, x - 6, y - 3, 12, 4, ink);
    r(c, x - 5, y - 2, 10, 2, '#71838a');
    rivet(c, x - 4, y - 2); rivet(c, x + 2, y - 2);
}
function shaftGeometry(b: MovingBody, headroom?: number) {
    const route = carrierRoute(b)!;
    return { left: route.home.x - 3, right: route.home.x + b.width + 1,
        top: headroom ?? Math.min(route.home.y, route.to.y) - 40, bottom: Math.max(route.home.y, route.to.y) + b.height + 7 };
}
export function drawCarrierTrack(c: CanvasRenderingContext2D, b: MovingBody, cx: number, cy: number, level?: WorldLevel, headroom?: number) {
    if (!['platform', 'lift', 'swing', 'support'].includes(b.kind)) return;
    const route = carrierRoute(b), family = carrierFamily(b);
    if (!route || family === 'static') return;
    const roughBounds = carrierStructureBounds(b, carrierMounts(b))!;
    if (headroom !== undefined) roughBounds.top = Math.min(roughBounds.top, headroom - 16);
    const inferred = b.mounts === undefined && !!level, reach = inferred ? 128 : 0;
    const bottom = inferred ? Math.max(roughBounds.bottom, level!.rowToWorldY(level!.data.height)) : roughBounds.bottom;
    if (roughBounds.right + reach < cx - 20 || roughBounds.left - reach > cx + 340 || bottom < cy - 20 || roughBounds.top > cy + 200) return;
    // Offscreen routes never snapshot terrain; visible routes share one tile view
    // across all footing/bolt probes, including bounded legacy foundation search.
    const mounts = carrierMounts(b, level);
    const spin = carrierWheelTravel(b);
    if (family === 'rail') {
        const endpoints = [route.rail.from, route.rail.to];
        endpoints.forEach((end, i) => { if (mounts[i]) mount(c, mounts[i]!, end, cx, cy); });
        const a = { x: endpoints[0].x - route.tangent.x * 12, y: endpoints[0].y - route.tangent.y * 12 };
        const z = { x: endpoints[1].x + route.tangent.x * 12, y: endpoints[1].y + route.tangent.y * 12 };
        line(c, a.x - cx, a.y - cy, z.x - cx, z.y - cy, ink, 4);
        line(c, a.x - cx, a.y - cy, z.x - cx, z.y - cy, '#809ba5');
        for (const end of [a, z]) {
            // Blunt stop blocks identify the end of a rigid rail, not floating pulleys.
            r(c, end.x - 2 - cx, end.y - 3 - cy, 5, 8, '#2c4559');
            r(c, end.x - 1 - cx, end.y - 2 - cy, 3, 3, '#c3a56b');
        }
        return;
    }
    const shaft = shaftGeometry(b, headroom), xs = [shaft.left, shaft.right];
    const top = family === 'lowering' ? Math.min(route.home.y, route.to.y) + b.height : shaft.top;
    for (const [i, xx] of xs.entries()) {
        if (mounts[i]) mount(c, mounts[i]!, { x: xx, y: family === 'lowering' ? shaft.bottom - 5 : top + 2 }, cx, cy);
        // Open guides are behind the deck. They have no bright horizontal landing cap.
        r(c, xx - 1 - cx, top - cy, 3, shaft.bottom - top, '#344e61');
        r(c, xx - cx, top + 1 - cy, 1, shaft.bottom - top - 1, '#81979e');
        for (const yy of [top + 3, shaft.bottom - 6]) r(c, xx - 3 - cx, yy - cy, 7, 3, '#3b5a6f');
    }
    if (family === 'lowering') {
        line(c, shaft.left - cx, shaft.bottom - 4 - cy, shaft.right - cx, shaft.bottom - 4 - cy, '#293f51', 4);
        line(c, shaft.left - cx, shaft.bottom - 3 - cy, shaft.right - cx, shaft.bottom - 3 - cy, '#69777a');
    }
    if (family === 'hoist') {
        steelBeam(c, shaft.left - 3 - cx, top - 5 - cy, shaft.right - shaft.left + 7, 6);
        const ropeXs = [shaft.left - 2, shaft.right + 2];
        // A common drive shaft connects two winding drums; each rope is continuous to its deck lug.
        line(c, ropeXs[0] - 4 - cx, top - 4 - cy, ropeXs[1] - 4 - cx, top - 4 - cy, ink, 2);
        r(c, route.home.x + b.width / 2 - 7 - cx, top - 9 - cy, 14, 10, '#334f66');
        r(c, route.home.x + b.width / 2 - 4 - cx, top - 7 - cy, 8, 3, '#b79758');
        for (const xx of ropeXs) {
            line(c, xx - cx, top - 4 - cy, xx - cx, b.y + 2 - cy, '#2b4358', 2);
            line(c, xx - cx, top - 4 - cy, xx - cx, b.y + 2 - cy, '#aab5aa');
            drawCarrierBearing(c, xx - 4 - cx, top - 4 - cy, spin);
        }
    }
}

export function drawCarrier(c: CanvasRenderingContext2D, b: MovingBody, cx: number, cy: number, time: number, world: number) {
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = b.width, h = b.height;
    const family = carrierFamily(b), cargo = world === 1 || world === 2 || world === 6;
    if (family === 'rail') {
        const trolley = carrierTrolley(b), wheels = carrierWheelCenters(b), spin = carrierWheelTravel(b);
        line(c, wheels[0].x - cx, wheels[0].y + 3 - cy, wheels[1].x - cx, wheels[1].y + 3 - cy, '#29455b', 4);
        for (const wheelCenter of wheels) drawCarrierBearing(c, wheelCenter.x - cx, wheelCenter.y - cy, spin);
        const tx = trolley.x - cx, ty = trolley.y - cy;
        r(c, tx - 3, ty + 2, 7, 7, '#314f65');
        r(c, tx - 2, ty + 4, 5, 3, '#ba9d68');
        // A level spreader keeps suspension outside the entire walkable deck.
        // A V bridle would cut through a centered rider's helmet even with a high trolley.
        const barY = y - 33, left = x - 3, right = x + w + 1;
        line(c, tx, ty + 8, tx, barY, '#314f65', 3);
        line(c, left, barY, right, barY, '#2f485d', 2);
        line(c, left + 1, barY, right - 1, barY, '#778e93');
        for (const [strap, lug] of [[left, x + 2], [right, x + w - 3]]) {
            line(c, strap, barY + 1, strap, y + 2, '#283f55', 2);
            line(c, strap, barY + 1, strap, y + 1, '#a7b5ab');
            line(c, strap, y + 2, lug, y + 2, '#354f62', 2);
        }
        if (world === 4 || b.kind === 'swing') {
            line(c, x + 3, y - 12, x + w - 4, y - 12, '#597c87');
            for (const xx of [x + 3, x + w / 2, x + w - 4]) line(c, xx, y - 12, xx, y - 2, '#597c87');
        }
    } else if (family === 'hoist') {
        for (const xx of [x - 5, x + w - 1]) {
            r(c, xx, y + 1, 7, 6, ink);
            r(c, xx + 1, y + 2, 5, 3, '#91a9ac');
        }
        for (const xx of [x + 5, x + w - 6]) r(c, xx - 2, y - 3, 5, 4, '#4d6b7b');
    }
    deck(c, x, y, w, h, world, cargo);
    if (b.to) {
        light(c, x + w / 2 - 4, y + h + 1, b, time);
        const moving = Math.abs(b.x - b.px) + Math.abs(b.y - b.py) > .01;
        if (moving) r(c, x + w / 2 - 2, y + h + 2, 4, 1, '#dae7b7');
    }
}

export function drawBelt(c: CanvasRenderingContext2D, b: MovingBody, cx: number, cy: number, time: number, world: number) {
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = Math.round(b.width), h = Math.round(b.height);
    const dir = (b.direction ?? 1) * (b.active ? -1 : 1), shift = ((b.beltOffset % 12) + 12) % 12;
    r(c, x, y, w, h + 11, ink);
    r(c, x + 1, y + 1, w - 2, h + 8, '#395c73');
    r(c, x + 1, y + h + 7, w - 2, 2, '#789baa');
    for (const xx of [x + 1, x + w - 12]) {
        wheel(c, xx, y + h - 2, 11, b.beltOffset * 13);
        r(c, xx + 3, y + h + 8, 6, 3, '#203b52');
    }
    // The top tread matches the walkable belt; its return run travels the other way.
    c.save(); c.beginPath(); c.rect(x + 1, y, w - 2, h + 8); c.clip();
    r(c, x + 1, y, w - 2, h, '#263f53');
    for (let i = -12; i < w + 12; i += 12) {
        r(c, x + i + Math.floor(shift), y, 9, 2, world === 5 ? '#c3e0dd' : '#a8c1b6');
        r(c, x + i + Math.floor(shift), y + 2, 2, Math.max(1, h - 2), '#6c919b');
        r(c, x + i + Math.floor(12 - shift), y + h + 6, 7, 1, '#668799');
    }
    c.restore();
    for (let xx = x + 20; xx < x + w - 15; xx += 42) {
        r(c, xx - 8, y + h + 1, 17, 6, ink);
        r(c, xx - 7, y + h + 2, 15, 4, '#c9a65c');
        const tip = xx + dir * 4;
        line(c, xx - dir * 4, y + h + 4, tip, y + h + 4, '#253f54');
        line(c, tip - dir * 2, y + h + 2, tip, y + h + 4, '#253f54');
        line(c, tip - dir * 2, y + h + 6, tip, y + h + 4, '#253f54');
    }
    if (w > 38) {
        r(c, x + w - 18, y + h + 3, 9, 8, ink);
        r(c, x + w - 17, y + h + 4, 7, 6, '#547c8f');
        for (let yy = y + h + 5; yy < y + h + 10; yy += 2) r(c, x + w - 15, yy, 4, 1, '#253f54');
    }
    if (world === 5) for (let xx = x + 8; xx < x + w - 6; xx += 27) r(c, xx, y + h + 10, 3, 2, '#b8dfea');
    const flash = age(b, time);
    if (flash < 300) for (const dir of [-1, 1]) r(c, x + w / 2 + dir * (7 + flash / 35), y + h + 4, 2, 1, '#f6d997');
}

export function drawSwitch(c: CanvasRenderingContext2D, b: MovingBody, cx: number, cy: number, time: number, world: number) {
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = b.width, h = b.height;
    const elapsed = 400 - b.timer;
    const press = b.timer > 0 ? elapsed < 60 ? Math.ceil(elapsed / 20) : elapsed < 240 ? 3 : Math.ceil((400 - elapsed) / 54) : 0;
    r(c, x - 2, y + 1, w + 4, h + 7, ink);
    r(c, x - 1, y + 2, w + 2, h + 4, '#36596d');
    r(c, x + 2, y + 3, w - 4, h + 1, '#1d354d');
    for (const xx of [x + 4, x + w - 7]) {
        r(c, xx, y - 1 + press, 3, 6 - press, '#b8c8c7');
        for (let yy = y + press; yy < y + 5; yy += 2) r(c, xx - 1, yy, 5, 1, '#597f8e');
    }
    polygon(c, [[x, y - 5 + press], [x + w, y - 5 + press], [x + w - 2, y + press], [x + 2, y + press]], b.active ? '#60915e' : '#9e743d');
    r(c, x, y - 5 + press, w, 2, b.active ? '#c2df9a' : '#f1d88a');
    r(c, x + 3, y - 3 + press, w - 6, 1, b.active ? '#94bc7d' : '#c7a267');
    for (const xx of [x, x + w - 3]) rivet(c, xx, y + 4);
    light(c, x + w / 2 - 4, y + h + 2, b, time);
    pixelText(c, '↓', x + w / 2, y - 19, '#fff0c3', 1, 'center');
    const flash = age(b, time);
    if (flash < 330) for (const dir of [-1, 1]) {
        const reach = 3 + flash / 40;
        line(c, x + w / 2 + dir * reach, y - 8, x + w / 2 + dir * (reach + 2), y - 11, b.active ? '#d6eab0' : '#f7dca5');
    }
    if (world === 5) r(c, x - 1, y + h + 5, 5, 2, '#bfe0e8');
}

export function drawSupport(c: CanvasRenderingContext2D, b: MovingBody, cx: number, cy: number, time: number) {
    if (carrierFamily(b) === 'rail') { drawCarrier(c, b, cx, cy, time, 6); return; }
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = b.width, h = b.height;
    const route = carrierRoute(b);
    if (route) {
        const bottom = Math.max(route.home.y, route.to.y) + h + 7 - cy;
        // Reversible telescoping shoes remain connected under the moving deck.
        for (const xx of [x + 5, x + w - 10]) {
            r(c, xx - 1, y + h, 6, Math.max(0, bottom - y - h - 3), '#554e55');
            r(c, xx + 1, y + h, 2, Math.max(0, bottom - y - h - 3), '#b39472');
            r(c, xx - 2, bottom - 7, 8, 5, '#414d5b');
        }
        for (const xx of [x - 5, x + w - 1]) {
            r(c, xx, y + 1, 7, 6, ink);
            r(c, xx + 1, y + 2, 5, 3, '#ab9677');
        }
        const kneeY = Math.min(bottom - 5, y + h + 10);
        line(c, x + 8, kneeY, x + w / 2, y + h + 1, '#86725f', 2);
        line(c, x + w - 8, kneeY, x + w / 2, y + h + 1, '#86725f', 2);
    }
    deck(c, x, y, w, h, 6, true);
    light(c, x + w / 2 - 4, y + h + 1, b, time);
    r(c, x + w / 2 - 5, y + 2, 10, 5, ink);
    r(c, x + w / 2 - 4, y + 3, 8, 3, b.active ? '#a68d60' : '#c99162');
    r(c, x + w / 2 - 1, y + 3, 2, 3, '#f3d59d');
}
