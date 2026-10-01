import { pixelText, textWidth } from '../../graphics/BitmapFont';
import { ART } from '../../graphics/palette';

/** Two CSS pixels per authored pixel; every control stays at least 44px tall. */
export function labActionSize(label: string): { width: number; height: number } {
    return { width: Math.max(22, textWidth(label) + 6), height: 22 };
}

/** Small stained-wood plates share the stage's bitmap lettering and warm trim. */
export function paintLabAction(ctx: CanvasRenderingContext2D, label: string, primary = false): void {
    const { width, height } = labActionSize(label);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = ART.ink; ctx.fillRect(0, 1, width, height - 1);
    ctx.fillStyle = primary ? ART.gold : ART.soilLight; ctx.fillRect(1, 0, width - 2, height - 3);
    ctx.fillStyle = ART.soilDark; ctx.fillRect(1, 2, width - 2, height - 5);
    ctx.fillStyle = ART.soil; ctx.fillRect(2, 3, width - 4, 1); ctx.fillRect(3, 17, width - 6, 1);
    ctx.fillStyle = primary ? ART.goldLight : ART.soilTop; ctx.fillRect(2, 1, width - 4, 1);
    ctx.fillStyle = ART.goldDark; ctx.fillRect(2, 19, width - 4, 1);
    pixelText(ctx, label, 3, 8, primary ? ART.goldLight : ART.paper);
}

/** Keep native button/link behavior; the bitmap is decoration, the name remains text. */
export class LabToolbarAction {
    private readonly canvas = document.createElement('canvas');
    private readonly text = document.createElement('span');
    private label = '';

    constructor(private readonly control: HTMLElement, private readonly primary = false) {
        this.canvas.className = 'lab-action-art';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.text.className = 'lab-sr';
        control.textContent = '';
        control.append(this.canvas, this.text);
    }

    setLabel(label: string, accessibleName: string): void {
        this.control.setAttribute('aria-label', accessibleName);
        this.control.title = accessibleName;
        this.text.textContent = accessibleName;
        if (label === this.label) return;
        this.label = label;
        const { width, height } = labActionSize(label);
        this.canvas.width = width * 2; this.canvas.height = height * 2;
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
            paintLabAction(ctx, label, this.primary);
        } else {
            // Canvas-unavailable environments still expose an ordinary readable control.
            this.canvas.hidden = true; this.text.className = '';
        }
    }
}
