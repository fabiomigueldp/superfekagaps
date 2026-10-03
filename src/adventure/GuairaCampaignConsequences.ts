import type { AdventureSave } from './types';
import { campaignArtOverlay, campaignMapAsset } from './GuairaCampaignArt';

/** Earned chapter outcome, never inferred from old Serra access or optional wins. */
export function campaignWaterRestored(save: Pick<AdventureSave, 'guaira'>): boolean {
    return save.guaira.completed.includes('guaira-prefeito');
}
export const GUAIRA_RESTORED_WATER_IMAGE = campaignMapAsset('guaira-campaign/guaira-water-restored.webp');

/** Same source camera as the diorama; static even when motion is enabled. */
export function campaignWaterOverlay(save: Pick<AdventureSave, 'guaira'>, image: CanvasImageSource | null) {
    return campaignWaterRestored(save) && image ? campaignArtOverlay('guaira', image) : null;
}

/** Optional art failure leaves the original map and all travel controls intact. */
export function loadCampaignWaterImage(): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const image = new Image(); image.decoding = 'async';
        let settled = false;
        const finish = (result: HTMLImageElement | null) => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            image.onload = null; image.onerror = null; resolve(result);
        };
        const timer = setTimeout(() => finish(null), 10_000);
        (timer as unknown as { unref?: () => void }).unref?.();
        image.onload = () => finish(image.naturalWidth > 0 ? image : null);
        image.onerror = () => finish(null); image.src = GUAIRA_RESTORED_WATER_IMAGE;
    });
}
