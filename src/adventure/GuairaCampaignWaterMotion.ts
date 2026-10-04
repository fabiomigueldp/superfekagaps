import { campaignArtBounds } from './GuairaCampaignArt';
import { mapToScreen, type MapCamera } from './WorldMapModel';
import type { AtlasConnectionOverlay } from './WorldAtlasArt';

/** Existing restored-water alpha components, with two transparent filtering pixels.
 * Source camera: guaira-campaign/guaira-water-restored.webp, 1920 × 1200.
 * These are crops of that authored mask, never new water surfaces or route geometry.
 */
export const GUAIRA_CAMPAIGN_WATER_PATCHES = [
    [1001, 621, 35, 19], // public trough
    [1372, 751, 24, 13], // upper channel
    [1329, 899, 12, 9],  // rice-channel branch
    [1292, 940, 16, 10], // lower channel
] as const;

type Surface = Pick<HTMLCanvasElement, 'width' | 'height' | 'getContext'>;
interface Patch { surface: Surface; context: CanvasRenderingContext2D; overlay: AtlasConnectionOverlay }
const bounds = campaignArtBounds('guaira');
const overlays = GUAIRA_CAMPAIGN_WATER_PATCHES.map(([x, y, width, height]) => ({
    left: bounds.left + x / 1920 * (bounds.right - bounds.left),
    top: bounds.top + y / 1200 * (bounds.bottom - bounds.top),
    widthInMap: width / 1920 * (bounds.right - bounds.left),
    heightInMap: height / 1200 * (bounds.bottom - bounds.top),
}));

/** Optional, bounded decoration on top of the unchanged earned-water layer.
 * The caller owns visible time and reduced-motion changes. No timers, random values,
 * full-island canvas, new textures or progress writes. Four reusable crops total 1245px.
 */
export class GuairaCampaignWaterMotion {
    private patches: Patch[] | null = null;
    private unavailable = false;
    constructor(private readonly image: CanvasImageSource, private readonly createSurface: () => Surface) {}

    overlays(restored: boolean, camera: MapCamera, seconds: number, reducedMotion: boolean): readonly AtlasConnectionOverlay[] {
        if (!restored || reducedMotion || this.unavailable) return [];
        const visible = overlays.map(overlay => {
            const a = mapToScreen({ x: overlay.left, y: overlay.top }, camera);
            const b = mapToScreen({ x: overlay.left + overlay.widthInMap, y: overlay.top + overlay.heightInMap }, camera);
            return b.x >= 0 && b.y >= 0 && a.x <= camera.width && a.y <= camera.height;
        });
        if (!visible.some(Boolean)) return [];
        if (!this.patches) {
            const patches: Patch[] = [];
            for (let i = 0; i < GUAIRA_CAMPAIGN_WATER_PATCHES.length; i++) {
                const surface = this.createSurface(), [, , width, height] = GUAIRA_CAMPAIGN_WATER_PATCHES[i];
                surface.width = width; surface.height = height;
                const context = surface.getContext('2d');
                if (!context) { this.unavailable = true; return []; }
                patches.push({ surface, context, overlay: { ...overlays[i], image: surface as CanvasImageSource } });
            }
            this.patches = patches;
        }
        const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
        return this.patches.flatMap((patch, i) => {
            if (!visible[i]) return [];
            const [x, y, width, height] = GUAIRA_CAMPAIGN_WATER_PATCHES[i], c = patch.context;
            c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
            c.clearRect(0, 0, width, height);
            if (i === 0) {
                // Two short reflections travel gently across the existing angled bowl.
                c.strokeStyle = '#d8eeee'; c.lineWidth = .8; c.lineCap = 'round';
                for (let n = 0; n < 2; n++) {
                    const phase = (time / 4.8 + n * .5) % 1;
                    const px = 9 + n * 11, py = 4.8 + n * 3.5 + phase * 3;
                    c.globalAlpha = .32 * Math.sin(phase * Math.PI) ** 2;
                    c.beginPath(); c.moveTo(px - 3, py); c.lineTo(px + 3, py + 1.8); c.stroke();
                }
            } else {
                // A slow, soft shade crosses each existing glint. Nothing leaves its
                // authored holdout, so sluices, rice stalks and bridge rims stay intact.
                const phase = (time / (5.2 + i * .45) + i * .27) % 1;
                const center = -5 + phase * (width + 10);
                const shade = c.createLinearGradient(center - 5, 0, center + 5, 0);
                shade.addColorStop(0, '#42899100'); shade.addColorStop(.5, '#42899148'); shade.addColorStop(1, '#42899100');
                c.fillStyle = shade; c.fillRect(0, 0, width, height);
            }
            c.globalAlpha = 1; c.globalCompositeOperation = 'destination-in';
            c.drawImage(this.image, x, y, width, height, 0, 0, width, height);
            c.globalCompositeOperation = 'source-over';
            return [patch.overlay];
        });
    }
}
