import { drawJuiceArrivalAtPortal, drawJuiceArrivalSign } from '../experimental/JuiceFactoryArrivalArt';
import { FACTORY_SALON } from './FactorySalon';

/** Art only: runtime owns the portal and status, and draws objects/checkpoint/player next. Art never paints below the existing floor. */
export function drawFactorySalon(c: CanvasRenderingContext2D, cx: number, cy: number, defeated: boolean): void {
    drawJuiceArrivalSign(c, FACTORY_SALON.support.x + 24 - cx, FACTORY_SALON.support.y - cy, 'right');
    drawJuiceArrivalAtPortal(c, FACTORY_SALON.door, { x: cx, y: cy }, defeated ? 'complete' : 'open');
}
