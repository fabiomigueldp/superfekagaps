import { pixelText } from '../graphics/BitmapFont';
import type { MovingBody } from './WorldPhysics';
import { box as r, pixelLine as line, polygon, rivet, wheel, steelBeam, ink } from './WorldPainting';

/** Position drives the pulleys: they stop and reverse with their carriage. */
function travel(b: MovingBody) {
    if (!b.to || !b.home) return 0;
    const dx = b.to.x - b.home.x, dy = b.to.y - b.home.y, length = Math.hypot(dx, dy);
    return length ? ((b.x - b.home.x) * dx + (b.y - b.home.y) * dy) / length : 0;
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

export function drawCarrierTrack(c: CanvasRenderingContext2D, b: MovingBody, cx: number, cy: number) {
    if (!b.to || b.kind === 'support' || b.kind === 'lift' && b.to.x === (b.home ?? b).x) return;
    const home = b.home ?? b, w = b.width, spin = travel(b) * 13;
    const from = { x: home.x + w / 2 - cx, y: home.y - 25 - cy }, to = { x: b.to.x + w / 2 - cx, y: b.to.y - 25 - cy };
    if (Math.max(from.x, to.x) < -20 || Math.min(from.x, to.x) > 340 || Math.max(from.y, to.y) < -20 || Math.min(from.y, to.y) > 200) return;
    const trolley = { x: b.x + w / 2 - cx, y: b.y - 25 - cy };
    // A loaded cable follows the actual carriage, including diagonal travel.
    for (const [a, z] of [[from, trolley], [trolley, to]]) {
        line(c, a.x, a.y, z.x, z.y, ink, 3);
        line(c, a.x, a.y, z.x, z.y, '#9cbbbd');
    }
    for (const end of [from, to]) {
        r(c, end.x - 9, end.y - 8, 18, 5, '#344f65');
        rivet(c, end.x - 7, end.y - 7);
        wheel(c, end.x - 6, end.y - 6, 13, spin);
    }
}

export function drawCarrier(c: CanvasRenderingContext2D, b: MovingBody, cx: number, cy: number, time: number, world: number) {
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = b.width, h = b.height, spin = travel(b) * 13;
    const home = b.home ?? b, cargo = world === 1 || world === 2 || world === 6;
    if (b.to && b.kind === 'lift' && b.to.x === home.x) {
        // Guide rails and winding drum are fixed; the ropes lengthen as the deck descends.
        const top = Math.min(home.y, b.to.y) - 23 - cy, bottom = Math.max(home.y, b.to.y) + h + 8 - cy;
        for (const xx of [x + 4, x + w - 6]) {
            r(c, xx - 1, top, 3, bottom - top, '#385064');
            r(c, xx, top, 1, bottom - top, '#829da8');
            for (let yy = top + 5; yy < bottom; yy += 18) r(c, xx - 3, yy, 7, 2, '#516b7b');
            line(c, xx + 3, top + 8, xx + 3, y - 1, '#c9c9a5');
            r(c, xx - 3, y + 2, 8, 5, ink);
            r(c, xx - 2, y + 3, 6, 2, '#a8c1c1');
        }
        steelBeam(c, x + 1, top - 2, w - 2, 5);
        wheel(c, x + w / 2 - 7, top - 6, 15, spin);
        r(c, x + w / 2 - 10, bottom - 7, 20, 7, ink);
        r(c, x + w / 2 - 8, bottom - 6, 16, 4, '#476b84');
        if (y + h < bottom - 6) {
            r(c, x + w / 2 - 3, y + h, 6, bottom - 6 - y - h, '#2b4057');
            r(c, x + w / 2 - 2, y + h, 3, bottom - 6 - y - h, '#b4cacf');
        }
    } else if (b.to) {
        const trolley = x + w / 2;
        steelBeam(c, trolley - 10, y - 26, 20, 6);
        wheel(c, trolley - 9, y - 28, 8, spin);
        wheel(c, trolley + 2, y - 28, 8, spin);
        line(c, trolley - 5, y - 20, x + 5, y - 1, '#283f55', 2);
        line(c, trolley + 5, y - 20, x + w - 7, y - 1, '#283f55', 2);
        line(c, trolley - 5, y - 20, x + 5, y - 1, '#afbdac');
        line(c, trolley + 5, y - 20, x + w - 7, y - 1, '#afbdac');
        if (world === 4 || b.kind === 'swing') {
            // Open rails stay behind the player; the pale deck is the landing surface.
            line(c, x + 3, y - 12, x + w - 4, y - 12, '#597c87');
            for (const xx of [x + 3, x + w / 2, x + w - 4]) line(c, xx, y - 12, xx, y - 2, '#597c87');
        }
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
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = b.width, h = b.height;
    const home = b.home ?? b, top = home.y - cy, bottom = (b.to?.y ?? home.y + 32) + h + 8 - cy;
    const flash = age(b, time), shake = b.active && flash < 240 ? Math.round(Math.sin(flash / 22) * (1 - flash / 240) * 2) : 0;
    for (const xx of [x + 5, x + w - 11]) {
        r(c, xx + shake, top + h, 6, bottom - top - h, '#544f57');
        r(c, xx + 1 + shake, top + h, 3, bottom - top - h, '#ba9571');
        r(c, xx - 2, bottom - 4, 10, 4, '#d8bd92');
        for (let yy = top + 15; yy < bottom - 5; yy += 18) {
            r(c, xx - 1, yy, 8, 3, '#655968'); rivet(c, xx, yy);
        }
    }
    if (!b.active) {
        line(c, x + 11, top + h + 4, x + w - 11, bottom - 6, '#94765f', 3);
        line(c, x + w - 11, top + h + 4, x + 11, bottom - 6, '#94765f', 3);
        r(c, x + w / 2 - 4, (top + bottom) / 2 - 2, 8, 5, '#d4ad7d');
    } else {
        const yy = Math.min(bottom - 5, top + 15 + Math.min(1, flash / 350) * 19);
        line(c, x + 11, yy, x + w / 2 - 5, yy + 15, '#94765f', 3);
        line(c, x + w / 2 + 5, yy + 12, x + w - 11, yy, '#94765f', 3);
    }
    deck(c, x, y, w, h, 6, true);
    r(c, x + w / 2 - 5, y + 2, 10, 6, ink);
    r(c, x + w / 2 - 4, y + 3, 8, 4, b.active ? '#916453' : '#c99162');
    line(c, x + w / 2 - 3, y + 3, x + w / 2 + 2, y + 6, '#f3d59d');
    line(c, x + w / 2 + 2, y + 3, x + w / 2 - 3, y + 6, '#f3d59d');
    if (b.active && flash < 420) for (let i = 0; i < 6; i++) {
        const t = flash / 420, dir = i % 2 ? 1 : -1;
        r(c, x + w / 2 + dir * (5 + t * (12 + i * 3)), top + 8 - t * 11 + t * t * 35, 2 + i % 2, 2, i % 2 ? '#ddc29b' : '#927060');
    }
}
