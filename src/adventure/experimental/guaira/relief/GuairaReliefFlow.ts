import { drawGuairaRisingWater } from '../GuairaFluidArt';
import type { JetCycle } from '../../../WorldMachineState';

type LiquidPalette = Readonly<{ water: string; waterShade: string; foam: string; waterLight?:string; waterEdge?:string }>;

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
    drawGuairaRisingWater(c,danger,time,Math.round(cx),Math.round(cy),reducedMotion,
        {body:palette.water,shade:palette.waterShade,foam:palette.foam,light:palette.waterLight,edge:palette.waterEdge});
}
