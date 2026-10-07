import { pixelText } from '../../../../graphics/BitmapFont';
import { labActionSize } from '../../JuiceLabToolbar';
import { WORKSHOP_UI, workshopPanel } from '../../../WorldWorkshopUI';

/** Native controls with the same compact metal-and-brass treatment as World. */
export class GuairaChapterAction {
    private readonly canvas = document.createElement('canvas');
    private readonly text = document.createElement('span');
    private label = '';

    constructor(private readonly control: HTMLElement, private readonly primary = false, private readonly plain = false) {
        this.canvas.className = 'lab-action-art'; this.canvas.setAttribute('aria-hidden', 'true');
        this.text.className = 'lab-sr'; control.textContent = '';
        control.append(this.canvas, this.text);
    }

    setLabel(label: string, accessibleName: string): void {
        this.control.setAttribute('aria-label', accessibleName); this.control.title = accessibleName;
        this.text.textContent = accessibleName;
        if (label === this.label) return;
        this.label = label;
        const { width, height } = labActionSize(label);
        this.canvas.width = width * 2; this.canvas.height = height * 2;
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, width, height);
            if (!this.plain) workshopPanel(ctx, 0, 0, width, height, this.primary, true);
            pixelText(ctx, label, width / 2, 8, this.plain ? WORKSHOP_UI.gold : this.primary ? WORKSHOP_UI.ink : WORKSHOP_UI.paper, 1, 'center');
        } else {
            this.canvas.hidden = true; this.text.className = '';
        }
    }
}
