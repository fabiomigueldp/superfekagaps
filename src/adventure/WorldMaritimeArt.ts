import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';

export const MARITIME_BUOY_SPRITES = ['coral', 'sage'] as const;
export type MaritimeBuoyKind = typeof MARITIME_BUOY_SPRITES[number];
export type MaritimeBuoyRoute = 'coast-port' | 'reserva-dominio';
export interface MaritimeBuoySprite {
    path: string;
    width: number;
    height: number;
    widthInMap: number;
    waterlineAnchor: MapPoint;
}
export interface MaritimeBuoyInstance {
    id: string;
    route: MaritimeBuoyRoute;
    sprite: MaritimeBuoyKind;
    point: MapPoint;
}
export interface MaritimeBuoyMetadata {
    sprites: Record<MaritimeBuoyKind, MaritimeBuoySprite>;
    instances: MaritimeBuoyInstance[];
}
export interface AtlasMaritimeBuoy {
    point: MapPoint;
    sprite: MaritimeBuoySprite;
    image: CanvasImageSource;
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Optional scenery only: no route, progression or camera geometry is defined here. */
export function parseMaritimeBuoys(value: unknown): MaritimeBuoyMetadata | null {
    const data = object(value), sources = object(data?.sprites);
    if (!data || data.version !== 1 || data.coordinateSystem !== 'atlas' || !sources ||
        !Array.isArray(data.instances) || data.instances.length !== 4) return null;
    const sprites = {} as Record<MaritimeBuoyKind, MaritimeBuoySprite>;
    for (const kind of MARITIME_BUOY_SPRITES) {
        const source = object(sources[kind]), anchor = object(source?.waterlineAnchor);
        if (!source || source.path !== `/assets/world/map/maritime-buoy-${kind}.webp` ||
            source.width !== 160 || source.height !== 208 || !finite(source.widthInMap) || source.widthInMap <= 0 || source.widthInMap > 1 ||
            !anchor || !finite(anchor.x) || !finite(anchor.y) || anchor.x < 0 || anchor.x > source.width || anchor.y < 0 || anchor.y > source.height) return null;
        sprites[kind] = { path: source.path, width: source.width, height: source.height, widthInMap: source.widthInMap,
            waterlineAnchor: { x: anchor.x, y: anchor.y } };
    }
    const instances: MaritimeBuoyInstance[] = [], ids = new Set<string>();
    for (const raw of data.instances) {
        const instance = object(raw), point = object(instance?.point);
        if (!instance || typeof instance.id !== 'string' || !instance.id || ids.has(instance.id) ||
            (instance.route !== 'coast-port' && instance.route !== 'reserva-dominio') ||
            (instance.sprite !== 'coral' && instance.sprite !== 'sage') || !point || !finite(point.x) || !finite(point.y) ||
            Math.abs(point.x) > 16 || Math.abs(point.y) > 16) return null;
        ids.add(instance.id);
        instances.push({ id: instance.id, route: instance.route, sprite: instance.sprite, point: { x: point.x, y: point.y } });
    }
    if (instances.filter(instance => instance.route === 'coast-port').length !== 2) return null;
    return { sprites, instances };
}

/** At most four natural-size sprites; their waterlines use the boat's 8:5 map metric. */
export function paintMaritimeBuoys(c: CanvasRenderingContext2D, camera: MapCamera, buoys: readonly AtlasMaritimeBuoy[]): void {
    if (!buoys.length) return;
    c.save(); c.imageSmoothingEnabled = true;
    for (const { point, sprite, image } of buoys.slice(0, 4)) {
        const pixelX = sprite.widthInMap / sprite.width, pixelY = pixelX * 1.6;
        const top = mapToScreen({ x: point.x - sprite.waterlineAnchor.x * pixelX, y: point.y - sprite.waterlineAnchor.y * pixelY }, camera);
        const bottom = mapToScreen({ x: point.x + (sprite.width - sprite.waterlineAnchor.x) * pixelX,
            y: point.y + (sprite.height - sprite.waterlineAnchor.y) * pixelY }, camera);
        // One filtering pixel keeps partially visible artwork intact at viewport edges.
        if (bottom.x < -1 || top.x > camera.width + 1 || bottom.y < -1 || top.y > camera.height + 1) continue;
        c.drawImage(image, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    }
    c.restore();
}
