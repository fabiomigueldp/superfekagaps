import { box as r, pixelLine as line, polygon } from '../../WorldPainting';
import { guairaBreeze } from './GuairaScenery';

/** Rooted rice, with arched grain heads on mature plants and narrower young
 * leaves. Position/variant belong to the field; the breeze bends only the tips.
 * The caller supplies its paused/reduced-motion simulation clock. */
export function drawGuairaRicePlant(c: CanvasRenderingContext2D, x: number, root: number,
    time: number, worldX: number, variant = 0, height = 16, muted = false) {
    if (![x, root, worldX, variant, height].every(Number.isFinite)) return;
    x = Math.round(x); root = Math.round(root);
    const seed = Math.abs(Math.floor(worldX / 7) + variant * 11), mature = seed % 3 !== 1;
    const h = Math.max(10, Math.min(20, Math.round(height))), lean = seed % 2 ? -2 : 2;
    const sway = guairaBreeze(time, worldX + variant * 23, 2);
    const dark = muted ? '#768b65' : '#587c53', leaf = muted ? '#8e9f72' : '#789652';
    const light = muted ? '#a5ae7e' : '#a1b16b', grain = muted ? '#bcb480' : '#c9b16e';
    const tipX = x + lean + sway, tipY = root - h;
    // Fixed submerged stem and crown. Three leaf bases share the same root.
    line(c, x, root - 4, x, root - 1, dark);
    polygon(c, [[x,root-2],[x-3,root-5],[x-6+sway,root-h+4],
        [x-3+sway,root-h+7],[x+1,root-1]], dark);
    polygon(c, [[x,root-1],[x+3,root-5],[x+6+sway,root-h+6],
        [x+5+sway,root-h+10],[x+1,root-1]], leaf);
    line(c, x, root - 4, tipX, tipY + (mature ? 2 : 0), leaf);
    line(c, x + 1, root - 4, x + 4 + sway, root - h + 8, light);
    if (mature) {
        const direction = lean < 0 ? -1 : 1;
        line(c, tipX, tipY + 2, tipX + direction * 3, tipY + 3, light);
        line(c, tipX + direction * 3, tipY + 3, tipX + direction * 4, tipY + 7, light);
        r(c, tipX + direction, tipY + 2, 2, 2, grain);
        r(c, tipX + direction * 3, tipY + 4, 2, 2, grain);
        r(c, tipX + direction * 4, tipY + 6, 1, 2, grain);
    } else r(c, tipX, tipY, 1, 3, light);
    r(c, x - 1, root - 1, 4, 1, dark);
}
