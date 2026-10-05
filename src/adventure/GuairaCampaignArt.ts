import { mapAssetPrefix } from './WorldMapArt';
import guairaMetadata from '../../public/assets/world/map/guaira-campaign/guaira.meta.json';
import factoryMetadata from '../../public/assets/world/map/guaira-campaign/fabrica.meta.json';
import serraMetadata from '../../public/assets/world/map/guaira-campaign/serra.meta.json';
import { localToAtlas, WORLD_ATLAS_PLACEMENTS, type AtlasBounds, type AtlasPlacement } from './WorldAtlasModel';
import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';

export function campaignMapAsset(file: string, base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'): string {
    return `${mapAssetPrefix(base)}${file}`;
}

/** Region keys never consume or renumber a numeric campaign world/stage ID. */
export type GuairaCampaignRegion = 'fabrica' | 'guaira' | 'serra';
export interface CampaignArtFrame { left: number; top: number; widthInMap: number; heightInMap: number }
export interface CampaignAirportTerminal {
    groundAnchor: MapPoint;
    runwayStart: MapPoint;
    runwayEnd: MapPoint;
    /** Inset wheel contacts, separate from the physical strip extent. */
    rollStart?: MapPoint;
    rollEnd?: MapPoint;
    boardingPath: readonly MapPoint[];
    surface: string;
    clearSpanMeters: number;
    usableLengthMeters: number;
}
export interface CampaignRegionArt {
    regionKey: GuairaCampaignRegion;
    path: string;
    frame: CampaignArtFrame;
    placement: AtlasPlacement;
    terminal: CampaignAirportTerminal;
    /** Match the 20.6-unit aircraft source to the destination camera scale. */
    aircraftScale: number;
    /** Complete same-camera mountain image replaces the old base, never doubles it. */
    replacesBase?: boolean;
}
export const GUAIRA_CAMPAIGN_PLACEMENT: AtlasPlacement = Object.freeze({ origin: Object.freeze({ x: 3.65, y: .05 }), scale: 1.1 });
const descriptor = (regionKey: GuairaCampaignRegion, metadata: typeof guairaMetadata | typeof factoryMetadata | typeof serraMetadata,
    placement: AtlasPlacement): CampaignRegionArt => ({ regionKey, path: campaignMapAsset(`guaira-campaign/${regionKey}.webp`),
    frame: metadata.assetFrame, placement, terminal: metadata.terminal, replacesBase: regionKey === 'serra', aircraftScale: .65 * 20.6 / metadata.camera.orthoScale });
export const GUAIRA_CAMPAIGN_ART: Readonly<Record<GuairaCampaignRegion, CampaignRegionArt>> = Object.freeze({
    fabrica: descriptor('fabrica', factoryMetadata, WORLD_ATLAS_PLACEMENTS[3]),
    guaira: descriptor('guaira', guairaMetadata, GUAIRA_CAMPAIGN_PLACEMENT),
    serra: descriptor('serra', serraMetadata, WORLD_ATLAS_PLACEMENTS[4]),
});
export const GUAIRA_CAMPAIGN_NODES: Readonly<Record<string, MapPoint>> = guairaMetadata.nodes;
export const GUAIRA_CAMPAIGN_ROUTES: Readonly<Record<string, readonly MapPoint[]>> = guairaMetadata.routes;

/** Visible terrain bounds, distinct from transparent image framing used for painting. */
export function campaignTerrainBounds(region: 'guaira'): AtlasBounds {
    const metadata = guairaMetadata;
    const a = localToAtlas({ x: metadata.artBounds.left, y: metadata.artBounds.top }, GUAIRA_CAMPAIGN_ART[region].placement);
    const b = localToAtlas({ x: metadata.artBounds.right, y: metadata.artBounds.bottom }, GUAIRA_CAMPAIGN_ART[region].placement);
    return { left: a.x, top: a.y, right: b.x, bottom: b.y };
}
export function campaignArtBounds(region: GuairaCampaignRegion, atlas = true): AtlasBounds {
    const art = GUAIRA_CAMPAIGN_ART[region], frame = art.frame;
    const placement = atlas ? art.placement : { origin: { x: 0, y: 0 }, scale: 1 };
    const top = localToAtlas({ x: frame.left, y: frame.top }, placement);
    const bottom = localToAtlas({ x: frame.left + frame.widthInMap, y: frame.top + frame.heightInMap }, placement);
    return { left: top.x, top: top.y, right: bottom.x, bottom: bottom.y };
}
/** The adapter also works as a WorldAtlasArt connection overlay; no renderer fork. */
export function campaignArtOverlay(region: GuairaCampaignRegion, image: CanvasImageSource | null, atlas = true) {
    const bounds = campaignArtBounds(region, atlas);
    return { image, left: bounds.left, top: bounds.top, widthInMap: bounds.right - bounds.left, heightInMap: bounds.bottom - bounds.top };
}
export function campaignAirportTerminal(region: GuairaCampaignRegion, atlas = false): CampaignAirportTerminal {
    const art = GUAIRA_CAMPAIGN_ART[region], terminal = art.terminal;
    const transform = (p: MapPoint) => atlas ? localToAtlas(p, art.placement) : { ...p };
    return { ...terminal, groundAnchor: transform(terminal.groundAnchor), runwayStart: transform(terminal.runwayStart),
        runwayEnd: transform(terminal.runwayEnd),
        ...(terminal.rollStart ? { rollStart: transform(terminal.rollStart) } : {}),
        ...(terminal.rollEnd ? { rollEnd: transform(terminal.rollEnd) } : {}), boardingPath: terminal.boardingPath.map(transform) };
}
/** Optional lazy art: failure returns null, leaving controls/flight state usable. */
export function loadCampaignRegionImage(region: GuairaCampaignRegion): Promise<HTMLImageElement | null> {
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
        image.onload = () => finish(image.naturalWidth > 0 ? image : null); image.onerror = () => finish(null);
        image.src = GUAIRA_CAMPAIGN_ART[region].path;
    });
}
export function paintCampaignRegion(c: CanvasRenderingContext2D, camera: MapCamera, region: GuairaCampaignRegion,
    image: CanvasImageSource | null, atlas = false): void {
    if (!image) return;
    const bounds = campaignArtBounds(region, atlas), a = mapToScreen({ x: bounds.left, y: bounds.top }, camera);
    const b = mapToScreen({ x: bounds.right, y: bounds.bottom }, camera);
    if (b.x < 0 || a.x > camera.width || b.y < 0 || a.y > camera.height) return;
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(image, a.x, a.y, b.x - a.x, b.y - a.y); c.restore();
}
