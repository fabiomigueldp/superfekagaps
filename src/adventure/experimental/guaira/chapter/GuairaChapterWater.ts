import data from './GuairaBairroWaterData.json';
import type { GuairaCamera, GuairaMapWaterEffect } from '../GuairaMapArt';
import type { GuairaChapterSnapshot } from './GuairaChapterSession';

/** Only the host's owned session snapshot is an authority; this is not an import validator.
 * Accepted generations are historical: selecting or replaying must not erase real water. */
export function hasAcceptedPublicWater(snapshot: GuairaChapterSnapshot): boolean {
    return !snapshot.disposed && snapshot.accepted.some(receipt => receipt.sceneId === 'guaira-prefeito'
        && receipt.result.sceneId === 'guaira-prefeito' && receipt.result.kind === 'mayor-water-released'
        && receipt.attempt.sceneId === 'guaira-prefeito' && receipt.attempt.sessionId === snapshot.generation.sessionId);
}

const bairro = { bounds: data.bounds as [number, number, number, number] };
const xs = data.bowl.map(point => point[0]), ys = data.bowl.map(point => point[1]);
const left = Math.min(...xs), top = Math.min(...ys), width = Math.max(...xs) - left, height = Math.max(...ys) - top;
function polygon(ctx: CanvasRenderingContext2D, points: number[][]) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
}

/** Adds no texture, canvas, timer or RAF. The map owns time, suspension and Feka's final paint. */
export class GuairaChapterWater implements GuairaMapWaterEffect {
    private irrigation?: GuairaMapWaterEffect;
    released = false;
    regions: GuairaMapWaterEffect['regions'] = [];
    get active(): boolean { return !!this.irrigation || this.released; }
    update(snapshot: GuairaChapterSnapshot): void {
        this.released = hasAcceptedPublicWater(snapshot); this.refreshRegions();
    }
    setIrrigation(effect: GuairaMapWaterEffect): void { this.irrigation = effect; this.refreshRegions(); }
    dispose(): void { this.irrigation = undefined; this.released = false; this.regions = []; }
    private refreshRegions(): void {
        this.regions = this.released ? [...(this.irrigation?.regions ?? []), bairro] : this.irrigation?.regions ?? [];
    }
    draw(ctx: CanvasRenderingContext2D, camera: GuairaCamera, seconds: number, reducedMotion: boolean): void {
        this.irrigation?.draw(ctx, camera, seconds, reducedMotion);
        if (!this.released) return;
        const time = reducedMotion ? 1.25 : Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
        ctx.save();
        try {
            ctx.translate(camera.x, camera.y); ctx.scale(camera.imageWidth / 1920, camera.imageWidth / 1920);
            ctx.fillStyle = '#579c9f'; polygon(ctx, data.fall); ctx.fill();
            polygon(ctx, data.bowl); ctx.fill(); ctx.clip();
            ctx.strokeStyle = '#c0eff0'; ctx.lineWidth = .9; ctx.lineCap = 'round';
            for (let i = 0; i < 2; i++) {
                const x = left + width * (.28 + i * .38), y = top + height * (.42 + i * .19) + Math.sin(time * .8 + i * 2) * .35;
                ctx.globalAlpha = .16 + Math.sin(time * .7 + i * 2) * .035;
                ctx.beginPath(); ctx.moveTo(x - width * .09, y); ctx.lineTo(x + width * .09, y - .6); ctx.stroke();
            }
        } finally { ctx.restore(); }
    }
}
