import { type MapArtMetadata } from './WorldMapArt';
import { samplePath, type MapCamera, type MapPoint } from './WorldMapModel';

/** Every island keeps one placement for every selection and camera mode. */
export interface AtlasPlacement { origin: MapPoint; scale: number }
export interface AtlasBounds { left: number; top: number; right: number; bottom: number }
export interface AtlasInsets { top: number; right: number; bottom: number; left: number }
export interface AtlasOverlayBounds { left: number; top: number; widthInMap: number; heightInMap: number }
export interface AtlasIslandDescriptor {
    world: number;
    metadata: MapArtMetadata;
    placement: AtlasPlacement;
    overlay?: AtlasOverlayBounds;
    /** Local approach silhouettes, separate from a complete inter-island span. */
    approachBounds?: readonly AtlasBounds[];
}
export const WORLD_ATLAS_PLACEMENTS: Readonly<Record<number, AtlasPlacement>> = Object.freeze({
    1: Object.freeze({ origin: Object.freeze({ x: 0, y: 0 }), scale: 1 }),
    2: Object.freeze({ origin: Object.freeze({ x: 1.1, y: -.12 }), scale: 1 }),
    3: Object.freeze({ origin: Object.freeze({ x: 1.98, y: .03 }), scale: 1 }),
    4: Object.freeze({ origin: Object.freeze({ x: 2.78, y: -.65 }), scale: 1 }),
    5: Object.freeze({ origin: Object.freeze({ x: 2.7, y: -1.8 }), scale: 1 }),
});
/** Compatibility for the released ferry contract and its consumers. */
export const COAST_PORT_PLACEMENTS = WORLD_ATLAS_PLACEMENTS;
/** Measured alpha bounds of the shipped 1920×1200 layers, excluding soft shadows. */
export const ATLAS_ART_BOUNDS: Readonly<Record<number, AtlasBounds>> = Object.freeze({
    1: Object.freeze({ left: 259 / 1920, top: 96 / 1200, right: 1598 / 1920, bottom: 1166 / 1200 }),
    2: Object.freeze({ left: 277 / 1920, top: 153 / 1200, right: 1622 / 1920, bottom: 1077 / 1200 }),
});
export const ATLAS_FOCUS_CLEARANCE = 44;
const ASPECT = 1.6;
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const validPoint = (point: MapPoint | undefined): point is MapPoint => !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
const scaleOf = (placement: AtlasPlacement) => Number.isFinite(placement.scale) && placement.scale > 0 ? placement.scale : 1;

export function localToAtlas(point: MapPoint, placement: AtlasPlacement): MapPoint {
    const scale = scaleOf(placement);
    return { x: placement.origin.x + point.x * scale, y: placement.origin.y + point.y * scale };
}
export function atlasToLocal(point: MapPoint, placement: AtlasPlacement): MapPoint {
    const scale = scaleOf(placement);
    return { x: (point.x - placement.origin.x) / scale, y: (point.y - placement.origin.y) / scale };
}
export function localPathToAtlas(points: readonly MapPoint[], placement: AtlasPlacement): MapPoint[] {
    return points.map(point => localToAtlas(point, placement));
}
/** Preserve authored path order and stage IDs; global coordinates can exceed [0,1]. */
export function transformAtlasMetadata(metadata: MapArtMetadata, placement: AtlasPlacement): MapArtMetadata {
    const result: MapArtMetadata = {
        world: metadata.world,
        nodes: Object.fromEntries(Object.entries(metadata.nodes).map(([id, point]) => [id, localToAtlas(point, placement)])),
        routes: Object.fromEntries(Object.entries(metadata.routes).map(([id, points]) => [id, localPathToAtlas(points, placement)])),
        secretRoute: localPathToAtlas(metadata.secretRoute, placement),
        ...(metadata.secretTransport ? { secretTransport: metadata.secretTransport } : {}),
        ...(metadata.routeDurationsSeconds ? { routeDurationsSeconds: { ...metadata.routeDurationsSeconds } } : {}),
        ...(metadata.secretDurationSeconds !== undefined ? { secretDurationSeconds: metadata.secretDurationSeconds } : {}),
    };
    if (metadata.artBounds) {
        const bounds = metadata.artBounds;
        result.artBounds = { top: placement.origin.y + bounds.top * scaleOf(placement),
            bottom: placement.origin.y + bounds.bottom * scaleOf(placement),
            ...(bounds.left === undefined ? {} : { left: placement.origin.x + bounds.left * scaleOf(placement) }),
            ...(bounds.right === undefined ? {} : { right: placement.origin.x + bounds.right * scaleOf(placement) }) };
    }
    return result;
}
/** Numeric keys are campaign indices, ready for the existing DOM pin controller. */
export function atlasNodePoints(layers: readonly AtlasIslandDescriptor[]): Record<number, MapPoint> {
    return Object.fromEntries(layers.flatMap(layer => Object.entries(layer.metadata.nodes).map(([id, point]) =>
        [(Number(id.split('-')[0]) - 1) * 5 + Number(id.split('-')[1]) - 1, localToAtlas(point, layer.placement)])));
}
export function atlasIslandBounds(layer: AtlasIslandDescriptor): AtlasBounds {
    const measured = ATLAS_ART_BOUNDS[layer.world] ?? { left: 0, top: 0, right: 1, bottom: 1 };
    const bounds = { ...measured, ...layer.metadata.artBounds };
    const overlay = layer.overlay;
    if (overlay && [overlay.left, overlay.top, overlay.widthInMap, overlay.heightInMap].every(Number.isFinite) &&
        overlay.widthInMap > 0 && overlay.heightInMap > 0) {
        bounds.left = Math.min(bounds.left, overlay.left); bounds.top = Math.min(bounds.top, overlay.top);
        bounds.right = Math.max(bounds.right, overlay.left + overlay.widthInMap);
        bounds.bottom = Math.max(bounds.bottom, overlay.top + overlay.heightInMap);
    }
    for (const approach of layer.approachBounds ?? []) {
        if (![approach.left, approach.top, approach.right, approach.bottom].every(Number.isFinite) ||
            approach.left >= approach.right || approach.top >= approach.bottom) continue;
        bounds.left = Math.min(bounds.left, approach.left); bounds.top = Math.min(bounds.top, approach.top);
        bounds.right = Math.max(bounds.right, approach.right); bounds.bottom = Math.max(bounds.bottom, approach.bottom);
    }
    const topLeft = localToAtlas({ x: bounds.left, y: bounds.top }, layer.placement);
    const bottomRight = localToAtlas({ x: bounds.right, y: bounds.bottom }, layer.placement);
    return { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y };
}
/** Use the same painter for an island without modifying its local image or routes. */
export function atlasIslandCamera(camera: MapCamera, placement: AtlasPlacement): MapCamera {
    return { ...camera, center: atlasToLocal(camera.center, placement), zoom: camera.zoom * scaleOf(placement) };
}

/** A connected window of the authored water path near the boat, for phone cameras.
 * maxSpan is an arc length in normalized horizontal map units. The two cut points
 * interpolate existing segments; the route and island placements never change.
 */
export function atlasTravelWindow(path: readonly MapPoint[], focus: MapPoint, maxSpan = .36): MapPoint[] {
    if (!path.length || path.some(point => !validPoint(point))) return validPoint(focus) ? [{ ...focus }] : [];
    if (path.length === 1) return [{ ...path[0] }];
    const cumulative = [0];
    for (let index = 1; index < path.length; index++) cumulative.push(cumulative[index - 1] +
        Math.hypot((path[index].x - path[index - 1].x) * ASPECT, path[index].y - path[index - 1].y));
    const total = cumulative[cumulative.length - 1];
    if (total <= 1e-10) return [{ ...path[0] }];
    const span = Math.max(.01, finite(maxSpan, .36)) * ASPECT;
    if (span >= total) return path.map(point => ({ ...point }));
    let nearest = Infinity, along = 0;
    const target = validPoint(focus) ? focus : path[0];
    for (let index = 1; index < path.length; index++) {
        const a = path[index - 1], b = path[index], dx = (b.x - a.x) * ASPECT, dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) continue;
        const t = Math.max(0, Math.min(1, (((target.x - a.x) * ASPECT) * dx + (target.y - a.y) * dy) / lengthSquared));
        const distanceSquared = ((target.x - a.x) * ASPECT - dx * t) ** 2 + (target.y - a.y - dy * t) ** 2;
        if (distanceSquared < nearest) { nearest = distanceSquared; along = cumulative[index - 1] + Math.sqrt(lengthSquared) * t; }
    }
    const start = Math.max(0, Math.min(total - span, along - span / 2)), end = start + span;
    return [samplePath(path, start / total), ...path.filter((_, index) => cumulative[index] > start + 1e-10 && cumulative[index] < end - 1e-10)
        .map(point => ({ ...point })), samplePath(path, end / total)];
}

export interface AtlasCameraOptions {
    mode: 'island' | 'channel' | 'overview';
    activeWorld: number;
    layers: readonly AtlasIslandDescriptor[];
    width: number;
    height: number;
    /** Measured CSS overlap with the drawing surface; no implicit toolbar/footer. */
    insets?: Partial<AtlasInsets>;
    focus?: MapPoint;
    /** The actual authored dock/water route, already in atlas coordinates. */
    travelPoints?: readonly MapPoint[];
    /** World-space bounds of moving art such as a boat, including its anchor. */
    focusBounds?: readonly AtlasBounds[];
    /** Full connection art is fitted in panorama only, not a nearby island view. */
    connectionBounds?: readonly AtlasBounds[];
    showPins?: boolean;
    /** Optional ceiling; fitting can always shrink further on a small surface. */
    maxZoom?: number;
}
interface FitPoint { point: MapPoint; clearance: number }
function corners(bounds: AtlasBounds): MapPoint[] {
    return [{ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.bottom }];
}

/** Fit only the subject of the camera: an island, both silhouettes, or the crossing.
 * Portrait crossings intentionally crop distant land while keeping both docks and
 * the boat readable. Geography is never rearranged to satisfy a viewport.
 */
export function getAtlasCamera(options: AtlasCameraOptions): MapCamera {
    const width = Math.max(1, Math.min(16384, finite(options.width, 1)));
    const height = Math.max(1, Math.min(16384, finite(options.height, 1)));
    const inset = (key: keyof AtlasInsets, dimension: number) => Math.max(0, Math.min(dimension * .45, finite(options.insets?.[key] ?? 0, 0)));
    const left = inset('left', width), right = width - inset('right', width);
    const top = inset('top', height), bottom = height - inset('bottom', height);
    const base = Math.min(width / ASPECT, height);
    const active = options.layers.find(layer => layer.world === options.activeWorld) ?? options.layers[0];
    const layers = options.mode === 'overview' ? options.layers : active ? [active] : [];
    const points: FitPoint[] = [];
    const add = (point: MapPoint, clearance: number) => { if (validPoint(point)) points.push({ point, clearance }); };
    const addBounds = (bounds: AtlasBounds, clearance: number) => corners(bounds).forEach(point => add(point, clearance));
    const travel = options.travelPoints?.filter(validPoint) ?? [];
    if (options.mode === 'channel' && travel.length) {
        travel.forEach(point => add(point, ATLAS_FOCUS_CLEARANCE));
    } else {
        for (const layer of layers) {
            addBounds(atlasIslandBounds(layer), 12);
            if (options.showPins ?? options.mode === 'island')
                Object.values(layer.metadata.nodes).forEach(point => add(localToAtlas(point, layer.placement), ATLAS_FOCUS_CLEARANCE));
        }
    }
    if (options.focus) add(options.focus, ATLAS_FOCUS_CLEARANCE);
    options.focusBounds?.forEach(bounds => addBounds(bounds, 12));
    if (options.mode === 'overview') options.connectionBounds?.forEach(bounds => {
        if ([bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite) &&
            bounds.left < bounds.right && bounds.top < bounds.bottom) addBounds(bounds, 12);
    });
    if (!points.length) add({ x: .5, y: .5 }, 12);
    // On a pathological tiny surface, keep the geometry finite while preserving
    // as much of the measured safe rectangle as can physically be represented.
    const clearanceLimit = Math.max(0, Math.min(right - left, bottom - top) / 2 - .5);
    for (const point of points) point.clearance = Math.min(point.clearance, clearanceLimit);
    const extents = (zoom: number) => ({
        left: Math.min(...points.map(({ point, clearance }) => point.x * base * ASPECT * zoom - clearance)),
        right: Math.max(...points.map(({ point, clearance }) => point.x * base * ASPECT * zoom + clearance)),
        top: Math.min(...points.map(({ point, clearance }) => point.y * base * zoom - clearance)),
        bottom: Math.max(...points.map(({ point, clearance }) => point.y * base * zoom + clearance)),
    });
    const maxZoom = Math.max(.001, finite(options.maxZoom ?? (options.mode === 'channel' ? 1.8 : 1.3), 1.3));
    let low = 0, high = maxZoom;
    for (let step = 0; step < 48; step++) {
        const zoom = (low + high) / 2, box = extents(zoom);
        if (box.right - box.left <= right - left && box.bottom - box.top <= bottom - top) low = zoom;
        else high = zoom;
    }
    const zoom = Math.max(Number.EPSILON, low), box = extents(zoom);
    return { width, height, zoom, center: {
        x: ((box.left + box.right) / 2 - (left + right - width) / 2) / (base * ASPECT * zoom),
        y: ((box.top + box.bottom) / 2 - (top + bottom - height) / 2) / (base * zoom),
    } };
}
