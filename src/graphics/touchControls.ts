import { panel, pixelText } from './BitmapFont';
import { ART } from './palette';

export interface TouchButton { x: number; y: number; width: number; height: number; label: string; key: string; name: string }
export const WORLD_TOUCH_BUTTONS: readonly TouchButton[] = Object.freeze([
    { x: 8, y: 145, width: 32, height: 29, label: '←', key: 'arrowleft', name: 'Esquerda' },
    { x: 56, y: 145, width: 32, height: 29, label: '→', key: 'arrowright', name: 'Direita' },
    { x: 144, y: 145, width: 32, height: 29, label: '↓', key: 's', name: 'Sentada' },
    { x: 232, y: 145, width: 32, height: 29, label: 'X', key: 'shift', name: 'Correr' },
    { x: 280, y: 145, width: 32, height: 29, label: '↑', key: ' ', name: 'Pular' },
]);

export function drawTouchButtons(c: CanvasRenderingContext2D, buttons = WORLD_TOUCH_BUTTONS): void {
    c.save(); c.globalAlpha = .72;
    for (const b of buttons) {
        panel(c, b.x, b.y, b.width, b.height, ART.ink, ART.rockLight);
        const scale = b.label.length === 1 ? 2 : 1;
        pixelText(c, b.label, b.x + b.width / 2, b.y + (scale === 2 ? 8 : 11), ART.paper, scale, 'center');
    }
    c.restore();
}
