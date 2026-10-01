import type { SkeletonBullModel } from './SkeletonBullModel';
export const BULL_PALETTE = { bone: '#F0DDAE', shade: '#AA8564', horn: '#302836', core: '#9D51E5', glow: '#DCAAF5' };
/** Code-native, integer-aligned pixel art; no texture loads, randomness or model mutation. */
export function drawSkeletonBull(ctx: CanvasRenderingContext2D, b: SkeletonBullModel, reducedMotion = false) {
    const p = BULL_PALETTE, moving = b.state === 'charge', warning = b.state === 'tell' || b.state === 'rattle';
    const stride = moving && !reducedMotion ? Math.floor(b.tick / 3) % 2 * 4 - 2 : 0;
    const bob = b.state === 'idle' && !reducedMotion ? Math.floor(b.tick / 24) % 2 : 0;
    const down = b.state === 'defeated';
    ctx.save(); ctx.translate(Math.round(b.x + b.width / 2), Math.round(b.y + bob)); ctx.scale(b.facing, 1);
    const r = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    r('#542A31', -22, 32, 45, 3);
    if (down) { r(p.shade, -21, 24, 42, 6); for (let x = -20; x < 20; x += 8) r(p.bone, x, 23, 5, 8); r(p.bone, 16, 22, 12, 7); ctx.restore(); return; }
    // Four separated legs and chunky cloven hooves.
    for (const [x, phase] of [[-17, stride], [-10, -stride], [9, -stride], [16, stride]]) {
        r(p.shade, x + phase, 20, 3, 12); r(p.bone, x + phase, 21, 2, 8); r(p.horn, x + phase - 2, 30, 6, 4);
    }
    r(p.shade, -21, 8, 38, 17); r(p.horn, -19, 11, 34, 11);
    r(b.vulnerable ? '#5B3A66' : p.core, -14, 13, 25, 7);
    if (warning && (reducedMotion || Math.floor(b.tick / 5) % 2 === 0)) r(p.glow, -13, 14, 24, 4);
    r(p.bone, -20, 8, 38, 3);
    for (let x = -17; x <= 10; x += 7) { r(p.bone, x, 10, 3, 12); r(p.shade, x + 3, 20, 3, 3); }
    r(p.bone, -25, 10, 6, 3); r(p.shade, -28, 13, 3, 7);
    const drop = moving || warning ? 4 : 0;
    r(p.shade, 13, 7 + drop, 9, 13); r(p.bone, 17, 9 + drop, 14, 12); r(p.bone, 24, 17 + drop, 9, 7);
    r(p.horn, 22, 13 + drop, 5, 4); r(p.glow, 24, 14 + drop, 2, 2); r(p.horn, 29, 21 + drop, 3, 2);
    r(p.horn, 18, 2 + drop, 4, 9); r(p.horn, 21, 1 + drop, 6, 3); r(p.bone, 25, 0 + drop, 3, 3);
    r(p.horn, 27, 5 + drop, 4, 6); r(p.horn, 30, 3 + drop, 5, 3);
    if (b.state === 'brake') for (let i = 0; i < 5; i++) r('#DB9C68', -30 - i * 6, 27 - (i % 2) * 4, 4, 3);
    ctx.restore();
}
