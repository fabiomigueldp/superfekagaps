import { pixelText } from '../../../graphics/BitmapFont';
import { ART } from '../../../graphics/palette';
import { paintLabAction } from '../JuiceLabToolbar';

/** Keep the familiar 44px plate; captions never shrink the symbol or touch target. */
export function paintGuairaTouchAction(ctx: CanvasRenderingContext2D, symbol: string, caption: string): void {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    paintLabAction(ctx, '');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    pixelText(ctx, symbol, 22, caption ? 8 : 15, ART.paper, 2, 'center');
    if (caption) pixelText(ctx, caption, 22, 27, ART.paper, 1, 'center');
}

/** Visible shorthand is decorative; the native button keeps its complete name. */
export function decorateGuairaTouchAction(button: HTMLButtonElement, symbol: string, caption: string, name: string): void {
    button.setAttribute('aria-label', name);
    button.setAttribute('data-symbol', symbol);
    button.setAttribute('data-caption', caption);
    button.title = name;
    const canvas = document.createElement('canvas'), text = document.createElement('span');
    canvas.className = 'lab-action-art'; canvas.width = 44; canvas.height = 44;
    canvas.setAttribute('aria-hidden', 'true');
    text.className = 'lab-sr'; text.textContent = name;
    button.append(canvas, text);
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.imageSmoothingEnabled = false; paintGuairaTouchAction(ctx, symbol, caption); }
    else { canvas.hidden = true; button.setAttribute('data-art-unavailable', 'true'); }
}
