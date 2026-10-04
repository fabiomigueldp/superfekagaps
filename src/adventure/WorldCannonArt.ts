import { PixelGrid, SpriteAtlas, type PixelFrame } from '../graphics/pixels';
import { pixelText } from '../graphics/BitmapFont';
import { WORLD_PALETTE } from './WorldAssets';
import { cannonCycle, cannonMuzzle } from './WorldMachineState';
import type { MovingBody } from './WorldPhysics';
import { box as r, oval, pixelLine as line, polygon } from './WorldPainting';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** A pure presentation of the existing simulation; drawing never advances a clock. */
export function cannonPresentation(b: Pick<MovingBody, 'active' | 'timer' | 'firedAt' | 'id' | 'kind' | 'x' | 'y' | 'width' | 'height'>, time: number) {
    const cycle = cannonCycle(b, time), age = cycle.elapsed;
    const charge = cycle.pose === 'charge' ? clamp(1 - b.timer / 650) : 0;
    // A fast kick, a resisted return, then a tiny mechanical seating movement.
    const recoil = age < 85 ? Math.round(5 * Math.sin(age / 85 * Math.PI / 2))
        : age < 360 ? Math.round(5 * (1 - (age - 85) / 275) ** 2) : 0;
    const pressure = cycle.pose === 'charge' ? .3 + charge * .7
        : age < 260 ? .06 : age < 850 ? .06 + .24 * clamp((age - 260) / 590) : .3;
    const feed = age < 260 ? 0 : age < 610 ? clamp((age - 260) / 350) : 1;
    return { ...cycle, charge, recoil, pressure, feed };
}

function ellipse(g: PixelGrid, x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) {
        const half = Math.sqrt(Math.max(0, 1 - ((j + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        g.rect(Math.ceil(x + w / 2 - half), y + j, Math.floor(half * 2), 1, color);
    }
}
function bolt(g: PixelGrid, x: number, y: number) { g.rect(x, y, 2, 2, 'K').dot(x, y, 'D'); }
function chassis(cold: boolean): PixelFrame {
    const g = new PixelGrid(48, 40);
    // Stable cast-iron skid, a sunken slide rail and load-bearing triangular cheeks.
    g.rect(8, 35, 36, 4, 'K').rect(9, 35, 34, 1, 'E').rect(10, 36, 32, 2, 'n');
    g.rect(11, 28, 28, 7, 'K').rect(12, 28, 26, 2, 'D').rect(12, 30, 26, 4, 'N');
    g.rect(15, 26, 18, 3, 'n').rect(14, 27, 21, 1, 'E');
    for (let i = 0; i < 5; i++) g.rect(16 + i * 3, 31, 1, 3, 'n');
    for (const x of [12, 35]) { bolt(g, x, 30); g.rect(x - 1, 34, 5, 1, 'n'); }
    g.rect(21, 32, 10, 4, 'K').rect(22, 33, 8, 2, 'i').rect(23, 33, 3, 1, 'I');
    // The feed hopper is visible over the chamber, with separate rails and brass lid.
    g.rect(23, 1, 12, 18, 'K').rect(24, 3, 10, 13, 'n');
    g.rect(22, 1, 14, 2, 'y').rect(23, 1, 12, 1, 'I');
    g.rect(23, 4, 2, 10, 'N').rect(23, 4, 1, 8, 'D').rect(33, 4, 2, 10, 'E');
    // Opaque accumulator shell and recessed glass; the purple fill is drawn separately.
    ellipse(g, 36, 5, 10, 7, 'K');
    g.rect(36, 9, 10, 21, 'K').rect(37, 10, 8, 18, 'n');
    g.rect(36, 8, 10, 3, 'y').rect(37, 8, 8, 1, 'I').rect(37, 9, 7, 1, 'Y');
    g.rect(36, 27, 10, 3, 'y').rect(37, 27, 8, 1, 'Y');
    g.rect(38, 11, 6, 16, 'u');
    // Routed steel pipe joins accumulator to chamber. Its highlight explains the bend.
    g.line(40, 5, 40, 3, 'K').line(35, 3, 40, 3, 'K').line(35, 3, 35, 10, 'K');
    g.line(36, 4, 39, 4, 'E').line(36, 4, 36, 9, 'E');
    // Exhaust cap and an honest worn corner, not random all-over texture.
    g.rect(39, 0, 4, 3, 'K').rect(39, 0, 4, 1, 'D').dot(12, 29, 'I');
    if (cold) {
        g.rect(23, 0, 11, 1, 'W').rect(37, 6, 6, 2, 'Z').dot(43, 8, 'W');
        g.rect(11, 28, 7, 1, 'W').rect(12, 29, 2, 2, 'Z').rect(38, 29, 4, 1, 'Z');
    }
    return g.finish();
}
function chamber(cold: boolean): PixelFrame {
    const g = new PixelGrid(48, 40);
    // Cylindrical gunmetal: broad light plane above, narrow blue reflected light below.
    g.rect(6, 11, 29, 17, 'K').rect(7, 12, 27, 15, 'N');
    g.rect(8, 12, 25, 3, 'E').rect(10, 12, 20, 1, 'D');
    g.rect(8, 15, 26, 6, 'N').rect(8, 21, 26, 5, 'n').rect(10, 25, 21, 1, 'E');
    // Two collars bind the cylinder to its carriage, with deep dark seams and rivets.
    for (const x of [10, 29]) {
        g.rect(x, 10, 4, 19, 'K').rect(x + 1, 11, 3, 17, 'y');
        g.rect(x + 1, 11, 3, 3, 'Y').rect(x + 1, 11, 2, 1, 'I');
        g.rect(x + 1, 16, 2, 6, 'Y').rect(x + 1, 26, 3, 1, 'i');
        bolt(g, x + 1, 23);
    }
    // A bevelled annular mouth with a recessed, load-sized aperture.
    ellipse(g, 0, 9, 11, 21, 'K');
    ellipse(g, 1, 10, 9, 19, cold ? 'Z' : 'E');
    ellipse(g, 2, 11, 7, 17, 'D');
    ellipse(g, 2, 13, 6, 14, 'n');
    ellipse(g, 3, 14, 4, 12, 'K');
    g.rect(2, 14, 1, 9, 'E').rect(4, 25, 3, 1, 'N').rect(3, 11, 2, 1, 'I');
    // Glass inspection slit: shade, purple liquid and one restrained reflection.
    g.rect(17, 17, 10, 7, 'K').rect(18, 18, 8, 5, 'v');
    g.rect(19, 18, 6, 2, 'V').rect(19, 18, 2, 1, 'Q').rect(18, 21, 1, 1, 'E');
    g.rect(18, 14, 7, 1, 'D').rect(26, 15, 2, 1, 'n');
    if (cold) {
        g.rect(15, 10, 7, 2, 'Z').rect(16, 12, 2, 2, 'Z').dot(16, 14, 'W');
        g.rect(29, 10, 4, 1, 'W').dot(30, 11, 'Z');
    }
    return g.finish();
}
const CHASSIS = [chassis(false), chassis(true)], CHAMBER = [chamber(false), chamber(true)];

/** Native-pixel pneumatic launcher. Signature intentionally matches the legacy renderer. */
export function drawCannon(c: CanvasRenderingContext2D, b: MovingBody, atlas: SpriteAtlas, cx: number, cy: number, time: number, world: number) {
    const s = cannonPresentation(b, time), dir = b.direction ?? -1, cold = world === 5 || !!b.pressurized;
    const x = Math.round(b.x + b.width / 2 - 24 - cx), y = Math.round(b.y + b.height - 28 - cy);
    const muzzle = cannonMuzzle(b), mx = Math.round(muzzle.x - cx), my = Math.round(muzzle.y - cy);
    // Helpers mirror accents on the same native raster as SpriteAtlas, without smoothing.
    const xx = (a: number, w = 1) => dir < 0 ? x + a : x + 48 - a - w;
    const box = (a: number, v: number, w: number, h: number, color: string) => r(c, xx(a, w), y + v, w, h, color);
    atlas.draw(c, CHASSIS[Number(cold)], WORLD_PALETTE, x, y, dir > 0);
    const fill = 5 + Math.round(s.pressure * 9);
    box(39, 27 - fill, 4, fill, '#8148a2');
    box(39, 27 - fill, 4, 1, '#d69fea');
    box(39, 28 - fill, 1, Math.max(1, fill - 2), '#b87ad6');
    box(38, 12, 1, 12, '#adcbd0'); box(43, 13, 1, 11, '#486377');
    if (s.pose === 'charge') {
        const bubble = Math.floor(time / 90) % Math.max(1, fill - 2);
        box(41, 25 - bubble, 1, 1, '#e2b5ef');
    }
    // A fresh keg slides down the hopper; there is no refill during the actual shot.
    if (s.feed > 0) {
        const feedY = 3 + Math.round(s.feed * 5);
        box(25, feedY, 7, 9, '#683b93'); box(26, feedY, 5, 1, '#b77ed1');
        box(25, feedY + 2, 7, 1, '#ecd198'); box(25, feedY + 7, 7, 1, '#af864b');
        box(26, feedY + 3, 1, 3, '#d2a4e4');
    }
    atlas.draw(c, CHAMBER[Number(cold)], WORLD_PALETTE, x - dir * s.recoil, y, dir > 0);
    // Dial is fixed to the accumulator, so the barrel visibly recoils behind it.
    const dx = xx(34, 11), dy = y + 18;
    oval(c, dx, dy, 11, 11, '#192c44'); oval(c, dx + 1, dy + 1, 9, 9, '#bb9460');
    oval(c, dx + 2, dy + 2, 7, 7, '#f5e7b7');
    r(c, dx + 7, dy + 2, 1, 2, '#c76956'); r(c, dx + 3, dy + 2, 1, 1, '#7c998b');
    const angle = Math.PI * (1.15 + s.pressure * .7);
    line(c, dx + 5, dy + 5, dx + 5 + Math.cos(angle) * 3, dy + 5 + Math.sin(angle) * 3, '#22384f');
    r(c, dx + 5, dy + 5, 1, 1, '#192c44');
    // Three pressure lamps are a direction-independent countdown and stay readable frozen.
    box(18, 29, 11, 3, '#192c44');
    for (let i = 0; i < 3; i++) box(19 + i * 3, 30, 2, 1, s.charge > i / 3 ? '#f4d68a' : '#526b72');
    if (s.pose === 'charge') {
        // A dark plate keeps the non-color warning readable against cold room door handles.
        // Keep the complete existing tell when its cannon straddles a screen edge.
        // Never turn it into a tracker for machines outside the playable viewport.
        const bodyX = Math.round(b.x - cx), bodyY = Math.round(b.y - cy);
        if (bodyX + b.width > 0 && bodyX < GAME_WIDTH && bodyY + b.height > 23 && bodyY < GAME_HEIGHT) {
            const warningX = Math.max(1, Math.min(GAME_WIDTH - 9, x + 20));
            r(c, warningX, y - 11, 8, 11, '#192c44');
            r(c, warningX + 1, y - 10, 6, 9, '#304756');
            pixelText(c, '!', warningX + 4, y - 9, '#ffe6a0', 1, 'center');
        }
        const mouth = mx - dir * s.recoil;
        r(c, mouth - 1, my - 3, 2, 5, s.charge > .65 ? '#d8a5eb' : '#8f55b1');
        // Inward pressure marks suggest compression, never a spurious outgoing projectile.
        if (s.charge > .4) for (const dy of [-1, 1]) {
            const d = Math.round(7 - s.charge * 3);
            r(c, mouth + dir * d, my + dy * 5, 2, 1, '#d0b1dd');
        }
    }
    // Purple liquid pressure, not a fire/explosion flash. Every detached drop is cosmetic.
    if (s.elapsed < 240) {
        const p = s.elapsed / 240;
        if (p < .48) {
            const length = Math.round(4 + p * 25), half = Math.max(1, Math.round(4 * (1 - p)));
            polygon(c, [[mx, my - half], [mx + dir * length, my - 2], [mx + dir * (length + 3), my], [mx + dir * length, my + 2], [mx, my + half]], '#9656bb');
            line(c, mx, my - 1, mx + dir * (length - 2), my, '#dfb3ed');
        }
        for (let i = 0; i < 5; i++) {
            const age = Math.max(0, p - i * .025), spread = (i - 2) * 1.35;
            const px = mx + dir * (3 + age * (14 + i * 4));
            const py = my + spread * age * 5 - age * 4 + age * age * 10;
            r(c, px, py, age < .45 ? 2 : 1, 2, i % 2 ? '#e0b4f1' : '#a65ad9');
        }
    }
    if (s.elapsed >= 200 && s.elapsed < 650) {
        const p = (s.elapsed - 200) / 450, mouth = mx - dir * s.recoil;
        // Residual juice gathers on the lower lip and detaches under gravity.
        if (p < .65) r(c, mouth, my + 6 + Math.round(p * p * 9), 2, p < .25 ? 1 : 2, '#b77bd5');
        for (let i = 0; i < 2; i++) {
            const a = p + i * .16;
            if (a < 1) r(c, xx(40) + (i ? 1 : -1) * Math.round(a * 3), y - 2 - Math.round(a * 7), 2, 1, cold ? '#c4dce1' : '#a9bfc5');
        }
    }
}
