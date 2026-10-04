import type { Renderer } from '../../../engine/Renderer';
import { pixelText } from '../../../graphics/BitmapFont';

/** The native attempt ledger, kept visible when pickup sound/particles are off.
 * No target fraction: optional coins never become a completion requirement.
 * A still native sprite also keeps this readout stable in reduced motion.
 */
export function drawGuairaCoinReadout(c: CanvasRenderingContext2D,
    renderer: Pick<Renderer, 'drawCoin'>, coins: number): void {
    const count = Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0;
    c.save();
    renderer.drawCoin(184, 4, 0, c);
    pixelText(c, `${count > 99 ? '99+' : count} NO TRECHO`, 202, 8, '#f5cf82');
    c.restore();
}
