import type { SkeletonBullModel } from './SkeletonBullModel';
import { pixelLine } from '../../WorldPainting';

export const BULL_PALETTE = { bone: '#F0DDAE', shade: '#AA8564', horn: '#302836', core: '#9D51E5', glow: '#DCAAF5' };
// Far hind/front, near hind/front: [horizontal reach, lift from the floor].
const GALLOP = [
    [[-4, 0], [4, 2], [4, 3], [-4, 0]],
    [[-2, 2], [5, 0], [2, 4], [-5, 0]],
    [[2, 4], [3, 0], [-2, 2], [-3, 0]],
    [[4, 3], [-4, 0], [-4, 0], [4, 2]],
    [[2, 4], [-5, 0], [-2, 2], [5, 0]],
    [[-2, 2], [-3, 0], [2, 4], [3, 0]],
] as const;

/** Native articulated poses driven by simulation state; no texture rotation or mutation. */
export function drawSkeletonBull(ctx: CanvasRenderingContext2D, b: SkeletonBullModel, reducedMotion = false) {
    const p = BULL_PALETTE, moving = b.state === 'charge', boneTell = b.state === 'rattle' || b.state === 'bones';
    const anticipation = b.state === 'tell', braking = b.state === 'brake', open = b.vulnerable;
    const frame = moving && !reducedMotion ? Math.floor(b.stateTick / 3) % GALLOP.length : 0;
    const pulse = !reducedMotion ? Math.floor(b.stateTick / 8) % 2 : 0;
    const bodyY = anticipation ? 10 : moving ? [8, 7, 6, 7, 8, 8][frame] : braking ? 7 : open ? 9 : 8;
    const headDrop = anticipation ? 6 : moving ? 5 : braking ? 1 : open ? 8 : boneTell ? -2 : 0;
    ctx.save(); ctx.translate(Math.round(b.x + b.width / 2), Math.round(b.y)); ctx.scale(b.facing, 1);
    const r = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const line = (x: number, y: number, xx: number, yy: number, color: string, size = 1) => pixelLine(ctx, x, y, xx, yy, color, size);
    r('#542A31', -22, 32, 45, 3);
    if (b.state === 'defeated') {
        r(p.shade, -21, 24, 42, 6);
        for (let x = -20; x < 20; x += 8) r(p.bone, x, 23, 5, 8);
        r(p.bone, 16, 22, 12, 7); ctx.restore(); return;
    }
    function leg(hip: number, index: number, near: boolean) {
        const [reach, lift] = moving ? GALLOP[frame][index]
            : braking ? [hip > 0 ? 5 : -4, 0]
            : anticipation ? [hip > 0 ? -2 : -4, 0]
            : open ? [hip > 0 ? 3 : -3, 0] : [0, 0];
        const knee = hip + (hip > 0 ? -2 : 3) + Math.round(reach / 2), foot = hip + reach;
        const kneeY = bodyY + 15 - Math.floor(lift / 2), footY = 30 - lift;
        line(hip, bodyY + 11, knee, kneeY, p.shade, 3);
        line(knee, kneeY, foot, footY, p.shade, 3);
        if (near) { line(hip, bodyY + 11, knee, kneeY, p.bone); line(knee, kneeY, foot, footY, p.bone); }
        r(near ? p.bone : p.shade, knee - 1, kneeY - 1, 4, 3);
        r(p.horn, foot - 2, footY, 6, 4); r('#826854', foot + 1, footY + 1, 1, 3);
    }
    leg(-12, 0, false); leg(10, 1, false);
    r(p.shade, -21, bodyY, 38, 17); r(p.horn, -19, bodyY + 3, 34, 11);
    const coreHeight = open ? 9 : anticipation ? 5 : moving ? [6, 7, 8, 7, 6, 6][frame] : 7;
    const coreY = bodyY + 6 + Math.floor((7 - coreHeight) / 2);
    r('#694082', -15, coreY - 1, 28, coreHeight + 2);
    r(p.core, -14, coreY, 25, coreHeight);
    r(p.glow, -10, coreY + 1, open ? 15 : 7, open ? 3 : 2);
    r('#BB73E8', -8, coreY + coreHeight - 2, 13, 2);
    r(p.bone, -20, bodyY, 38, 3);
    for (let x = -17, rib = 0; x <= 10; x += 7, rib++) {
        const flare = open ? (rib < 2 ? -2 : 2) : boneTell && !reducedMotion ? (rib % 2 ? pulse : -pulse) : 0;
        line(x, bodyY + 2, x + flare, bodyY + (open ? 7 : 12), p.bone, 2);
        r(p.shade, x + flare + 2, bodyY + (open ? 6 : 12), 3, 2);
    }
    r(p.bone, -25, bodyY + 2, 6, 3); line(-25, bodyY + 4, -28, bodyY + 11, p.shade, 2);
    leg(-17, 2, true); leg(16, 3, true);
    // Lowered horns signal the charge; a raised opening jaw signals low bones.
    line(14, bodyY + 3, 21, 16 + headDrop, p.shade, 5);
    r(p.bone, 17, 9 + headDrop, 14, 12); r(p.bone, 24, 17 + headDrop, 9, 6);
    r(p.shade, 18, 18 + headDrop, 8, 3);
    r(p.horn, 22, 13 + headDrop, 5, open ? 2 : 4);
    r(p.glow, 24, 14 + headDrop, 2, 1);
    const jaw = boneTell ? 2 + pulse : 0;
    r(p.horn, 28, 20 + headDrop, 5, 2 + jaw);
    r(p.bone, 27, 22 + headDrop + jaw, 6, 2);
    if (boneTell) r(p.core, 29, 21 + headDrop, 3, 2);
    r(p.horn, 18, 2 + headDrop, 4, 9); r(p.horn, 21, 1 + headDrop, 6, 3); r(p.bone, 25, headDrop, 3, 3);
    r(p.horn, 27, 5 + headDrop, 4, 6); r(p.horn, 30, 3 + headDrop, 5, 3);
    if (braking) for (let i = 0; i < 3; i++) r('#DB9C68', -27 - i * 5, 31 - i % 2, 3, 2);
    ctx.restore();
}
