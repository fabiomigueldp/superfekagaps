import { box as r } from '../../../WorldPainting';
import type { JetCycle } from '../../../WorldMachineState';

type LiquidPalette = Readonly<{ water: string; waterShade: string; foam: string }>;
const BENDS = [0, 1, 2, 1, 0, -1] as const;
const STREAM_PHASES = [0, 13, 31, 7, 23, 41, 17, 37] as const;
const mod = (value: number, period: number) => ((value % period) + period) % period;

/** Opaque native danger with small, continuous streams travelling towards its top.
 * The source-anchored pattern depends only on the existing simulation clock.
 * Freeze decoration in reduced motion; the caller's live envelope still changes.
 */
export function drawReliefFlow(
    c: CanvasRenderingContext2D,
    danger: NonNullable<JetCycle['danger']>,
    time: number,
    cx: number,
    cy: number,
    reducedMotion: boolean,
    palette: LiquidPalette,
) {
    const cameraX = Number.isFinite(cx) ? Math.round(cx) : 0;
    const cameraY = Number.isFinite(cy) ? Math.round(cy) : 0;
    const left = Math.round(danger.x - cameraX), width = Math.round(danger.width);
    const worldTop = Math.floor(danger.y), worldBottom = Math.ceil(danger.y + danger.height);
    const top = worldTop - cameraY, height = worldBottom - worldTop;
    if (width <= 0 || height <= 0) return;
    // A full opaque base retains every dangerous pixel, including the side edges.
    c.save();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    r(c, left, top, width, height, palette.water);
    const travel = reducedMotion ? 0 : Math.floor(time / 24);
    for (let lane = 0, dx = 5; dx < width - 4; lane++, dx += 16) {
        // Offset adjacent streams without random noise or disconnected particles.
        const stagger = STREAM_PHASES[lane % STREAM_PHASES.length];
        const first = Math.floor((worldTop + travel + stagger) / 8);
        const last = Math.ceil((worldBottom + travel + stagger) / 8);
        for (let segment = first; segment < last; segment++) {
            const worldY = segment * 8 - travel - stagger;
            const y = Math.max(worldTop, worldY), bottom = Math.min(worldBottom, worldY + 8);
            r(c, left + dx + BENDS[mod(segment, BENDS.length)], y - cameraY, 3, bottom - y, palette.waterShade);
        }
    }
    // The unchanged continuous top line marks the exact current native height.
    r(c, left, top, width, 1, palette.foam);
    c.restore();
}
