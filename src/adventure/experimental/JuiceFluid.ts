import type { JuiceGeyser } from './JuiceMinibossModel';
import type { Rect } from '../../types';

export const JUICE = {
    ink: '#241132', deep: '#42145f', shade: '#68238e', body: '#9837bd',
    light: '#c65be0', gloss: '#ed9bf3', white: '#ffe4ff', spent: '#713481',
} as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Pixel primitives use integer scanlines: no blurred vector edges on the action plane. */
export function fluidOval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    c.fillStyle = color;
    rx = Math.max(.6, rx); ry = Math.max(.6, ry);
    for (let row = Math.floor(y - ry); row < Math.ceil(y + ry); row++) {
        const v = (row + .5 - y) / ry;
        if (Math.abs(v) >= 1) continue;
        const w = rx * Math.sqrt(1 - v * v), left = Math.round(x - w), right = Math.round(x + w);
        if (right > left) c.fillRect(left, row, right - left, 1);
    }
}

export function fluidPolygon(c: CanvasRenderingContext2D, points: readonly number[], color: string) {
    c.fillStyle = color;
    const ys = points.filter((_p, i) => i % 2 === 1);
    for (let row = Math.floor(Math.min(...ys)); row < Math.ceil(Math.max(...ys)); row++) {
        const y = row + .5, edges: number[] = [];
        for (let i = 0; i < points.length; i += 2) {
            const j = (i + 2) % points.length, ay = points[i + 1], by = points[j + 1];
            if ((ay <= y && by > y) || (by <= y && ay > y))
                edges.push(points[i] + (points[j] - points[i]) * (y - ay) / (by - ay));
        }
        edges.sort((a, b) => a - b);
        for (let i = 0; i + 1 < edges.length; i += 2) {
            const left = Math.round(edges[i]), right = Math.round(edges[i + 1]);
            if (right > left) c.fillRect(left, row, right - left, 1);
        }
    }
}

/** The front rises under pressure; after shutoff the remaining mass falls under gravity. */
export function geyserHeight(g: JuiceGeyser): number {
    if (g.phase === 'warning') return 0;
    if (g.phase === 'active') return g.height * (1 - (1 - clamp(g.phaseTime / 160)) ** 3);
    const start = g.height * (1 - (1 - clamp((g.releaseTime ?? 520) / 160)) ** 3);
    return Math.max(0, start - 750 * (g.phaseTime / 1000) ** 2);
}

/** These same opaque scanlines are drawn and collided, including the growing front. */
export function geyserBands(g: JuiceGeyser): Rect[] {
    const height = Math.round(geyserHeight(g));
    const result: Rect[] = [], floor = g.y + g.height, middle = g.x + g.width / 2;
    const pressureTime = g.phase === 'recede' ? (g.releaseTime ?? 520) + g.phaseTime : g.phaseTime;
    for (let up = 0; up < height; up += 2) {
        const z = up / g.height, cap = Math.sqrt(clamp((height - up) / 7));
        // Packets travel from the nozzle toward the crown: swollen heads joined
        // by thinner necks. Their moving boundary is functional collision geometry.
        const packet = up * .19 - pressureTime * .033 + g.x * .09;
        const radius = g.width * (.33 - z * .11) * (1 + Math.sin(packet) * .25 + Math.cos(packet * 1.7) * .10);
        const shift = Math.sin(up * .10 - pressureTime * .017 + g.x * .09) * z * 2.4;
        const half = Math.max(1, (radius + 3.1 * Math.exp(-z * 14)) * cap);
        const left = Math.round(middle + shift - half), right = Math.round(middle + shift + half);
        result.push({ x: left, y: floor - Math.min(height, up + 2), width: right - left, height: Math.min(2, height - up) });
    }
    return result;
}

export interface LiquidFlight { x: number; y: number; vx: number; vy: number; hitTime: number; landed: boolean; sinceHit: number; }
/** Analytic ballistic motion, in seconds. A particle lands once and then belongs to the puddle. */
export function liquidFlight(x: number, y: number, vx: number, vy: number, gravity: number, floor: number, age: number): LiquidFlight {
    const hitTime = (-vy + Math.sqrt(vy * vy + 2 * gravity * Math.max(0, floor - y))) / gravity;
    const t = Math.min(Math.max(0, age), hitTime);
    return { x: x + vx * t, y: Math.min(floor, y + vy * t + .5 * gravity * t * t),
        vx, vy: vy + gravity * t, hitTime, landed: age >= hitTime, sinceHit: Math.max(0, age - hitTime) };
}

/** Heavy head with a thinning neck aligned opposite its velocity, not a round bead trail. */
export function fluidDrop(c: CanvasRenderingContext2D, x: number, y: number, radius: number, vx: number, vy: number, spent = false) {
    const speed = Math.hypot(vx, vy), nx = speed ? vx / speed : 0, ny = speed ? vy / speed : -1;
    const tail = Math.min(radius * 3.2, speed * .023), width = radius * .6;
    if (tail > 1) fluidPolygon(c, [x - ny * width, y + nx * width, x - nx * (radius + tail), y - ny * (radius + tail),
        x + ny * width, y - nx * width], spent ? JUICE.shade : JUICE.body);
    fluidOval(c, x, y, radius + .6, radius + .4, spent ? JUICE.deep : JUICE.ink);
    fluidOval(c, x - .2, y - .35, radius, Math.max(.7, radius - .25), spent ? JUICE.spent : JUICE.body);
    fluidOval(c, x - radius * .28, y - radius * .43, Math.max(.6, radius * .54), Math.max(.6, radius * .33), spent ? JUICE.light : JUICE.gloss);
    if (radius > 2.4 && !spent) { c.fillStyle = JUICE.white; c.fillRect(Math.round(x - 1), Math.round(y - 1), 1, 1); }
}

export function fluidPuddle(c: CanvasRenderingContext2D, x: number, floor: number, width: number, depth: number, seed = 0, spent = false) {
    fluidOval(c, x, floor, width + 1, depth + 1, JUICE.ink);
    fluidOval(c, x, floor - .5, width, depth, spent ? JUICE.deep : JUICE.shade);
    // Overlapping lobes form a wet meniscus rather than a perfect expanding ring.
    for (let i = 0; i < 3; i++) {
        const dx = (noise(seed + i) - .5) * width * 1.2;
        fluidOval(c, x + dx, floor - .9, width * (.27 + noise(seed + i + 8) * .13), depth * .7, spent ? JUICE.spent : JUICE.body);
    }
    c.fillStyle = spent ? JUICE.shade : JUICE.light;
    c.fillRect(Math.round(x - width * .55), Math.round(floor - 1.5), Math.max(1, Math.round(width * .45)), 1);
}

/** Impact sheet first, necks and airborne globs next, flattened deposits last. */
export function drawFluidImpact(c: CanvasRenderingContext2D, x: number, floor: number, elapsedMs: number,
    size: 'small' | 'landing' | 'defeat', seed = 0, duration = 850) {
    const t = Math.max(0, elapsedMs) / 1000, small = size === 'small', big = size === 'defeat';
    const fade = 1 - clamp((elapsedMs - duration * .62) / (duration * .38));
    if (fade <= 0) return;
    c.save(); c.globalAlpha *= fade;
    const spread = small ? 6 : big ? 31 : 23, depth = small ? 1 : 2.1;
    fluidPuddle(c, x, floor, spread * (.4 + .6 * (1 - Math.exp(-t * 18))), depth, seed, t > .24);
    const sheet = Math.max(0, 1 - t / .14);
    if (sheet > 0) for (const side of [-1, 1]) {
        const end = x + side * spread * (1 - sheet * .3), rise = sheet * (small ? 4 : 10);
        fluidPolygon(c, [x, floor - 1, end - side * 4, floor - rise * .5, end, floor - rise,
            end + side * 2, floor - rise * .45, end + side * 4, floor, x, floor + 1], JUICE.shade);
        fluidPolygon(c, [x + side * 2, floor - 1, end, floor - rise, end + side, floor - rise + 2,
            end - side * 2, floor - 1], JUICE.light);
    }
    const count = small ? 3 : big ? 12 : 8;
    for (let i = 0; i < count; i++) {
        const r = noise(seed + i * 3), side = i % 2 ? 1 : -1;
        const vx = side * (small ? 9 + r * 17 : 28 + r * (big ? 65 : 45));
        const vy = -(small ? 29 + noise(seed + i + 2) * 27 : 65 + noise(seed + i + 2) * 76);
        const drop = liquidFlight(x + side * (small ? 2 : 10 + r * 6), floor - 2, vx, vy, small ? 430 : 560, floor, t);
        const radius = small ? .8 + r * .6 : 1.2 + r * (big ? 1.8 : 1.2);
        if (!drop.landed) {
            fluidDrop(c, drop.x, drop.y, radius, drop.vx, drop.vy, true);
        } else {
            const settle = clamp(drop.sinceHit / .10), residue = 1 - clamp((drop.sinceHit - .15) / .32);
            if (residue <= 0) continue;
            c.save(); c.globalAlpha *= residue;
            fluidOval(c, drop.x, floor - .5, radius * (1.2 + settle), Math.max(.6, radius * (1 - settle * .7)), JUICE.spent);
            if (radius > 1.6 && drop.sinceHit < .13) {
                const rebound = liquidFlight(drop.x, floor - 1, -vx * .23, -28, 600, floor, drop.sinceHit);
                if (!rebound.landed) fluidDrop(c, rebound.x, rebound.y, .8, rebound.vx, rebound.vy, true);
            }
            c.restore();
        }
    }
    c.restore();
}

export function drawFluidGeyser(c: CanvasRenderingContext2D, g: JuiceGeyser, cx: number, cy: number, reducedMotion: boolean) {
    const floor = g.y + g.height - cy, middle = g.x + g.width / 2 - cx;
    const receding = g.phase === 'recede', elapsed = receding ? (g.releaseTime ?? 520) + g.phaseTime : g.phaseTime;
    const clock = reducedMotion ? 240 : elapsed, bands = geyserBands(g), seed = g.x * .19;
    const fade = receding ? 1 - clamp((g.phaseTime - 260) / 200) : 1;
    c.save(); c.globalAlpha *= fade;
    fluidPuddle(c, middle, floor, 14 + (receding ? Math.min(6, g.phaseTime * .03) : 0), 2.2, seed, receding);
    for (const band of bands) {
        const x = band.x - cx, y = band.y - cy, up = floor - y;
        // Dark rim and shaded far side make one translucent volume, with upward advection.
        c.fillStyle = receding ? JUICE.deep : JUICE.ink; c.fillRect(x - 1, y, band.width + 2, band.height);
        c.fillStyle = receding ? JUICE.spent : JUICE.body; c.fillRect(x, y, band.width, band.height);
        c.fillStyle = JUICE.shade; c.fillRect(x + Math.max(1, band.width - 4), y, Math.min(4, band.width - 1), band.height);
        const wave = Math.sin(up * .15 - clock * .029 + seed);
        const lightX = Math.round(x + band.width * .25 + wave * 1.2);
        const pulse = ((up - clock * .15 + seed * 13) % 25 + 25) % 25;
        if (band.width > 4) {
            c.fillStyle = receding ? JUICE.body : JUICE.light;
            c.fillRect(lightX, y, Math.min(3, band.width - 3), band.height);
            if (pulse < 9 && !receding) {
                c.fillStyle = pulse < 3 ? JUICE.white : JUICE.gloss;
                c.fillRect(lightX, y, pulse < 3 ? 1 : 2, band.height);
            }
        }
    }
    // Each packet has its own emission time and velocity. No modulo resets in mid-air.
    if (!reducedMotion) for (let i = 0; i < 11; i++) {
        const emitted = 35 + i * 28 + noise(seed + i) * 18;
        if (receding && emitted > (g.releaseTime ?? 520)) continue;
        const age = (elapsed - emitted) / 1000;
        if (age < 0) continue;
        const side = i % 2 ? 1 : -1, r = noise(seed + i * 2 + 20);
        const height = geyserHeight({ ...g, phase: 'active', phaseTime: emitted });
        const vx = side * (18 + r * 34), vy = -(22 + noise(seed + i + 5) * 49);
        const drop = liquidFlight(middle + side * (3 + r * 3), floor - height + 5, vx, vy, 620, floor, age);
        if (drop.landed) {
            if (drop.sinceHit < .24) drawFluidImpact(c, drop.x, floor, drop.sinceHit * 1000, 'small', seed + i, 240);
        } else {
            // The short-lived neck pinches before the heavy head separates.
            if (age < .14 && !receding) {
                const neck = (1 - age / .14) * 2.5;
                fluidPolygon(c, [middle + side * 2, floor - height + 13, middle + side * 5, floor - height + 2,
                    drop.x - neck, drop.y, drop.x + neck, drop.y,
                    middle + side * 8, floor - height + 5, middle + side * 7, floor - height + 13], JUICE.body);
            }
            fluidDrop(c, drop.x, drop.y, 1.4 + r * 1.5, vx, drop.vy, receding || age > .20);
        }
    }
    c.restore();
}
