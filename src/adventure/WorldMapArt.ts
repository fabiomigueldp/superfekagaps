import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../assets/playerSpriteSpec';
import { drawIsland } from './WorldStageArt';
import { ISLANDS } from './campaign';
import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';

export interface MapArtMetadata {
    world: number;
    nodes: Record<string, MapPoint>;
    routes: Record<string, MapPoint[]>;
    secretRoute: MapPoint[];
    /** Serra's maintenance shortcut is a vehicle, never an airborne walk path. */
    secretTransport?: 'maintenance-cable';
    /** Authored mountain/cold-store paths; older regions keep their released pace. */
    routeDurationsSeconds?: Record<string, number>;
    /** Reserva's supported shipping shortcut uses its measured walking time. */
    secretDurationSeconds?: number;
    artBounds?: MapArtBounds;
}
export interface MapArtAssets {
    island: CanvasImageSource | null;
    shadow: CanvasImageSource | null;
    port: CanvasImageSource | null;
}
/** Normalized silhouette bounds, excluding the separate soft shadow. */
export interface MapArtBounds { top: number; bottom: number; left?: number; right?: number }
/** Alpha bounds of the shipped 1920 × 1200 Costa layer: lighthouse tip through dock. */
export const COSTA_ART_BOUNDS: MapArtBounds = { top: 96 / 1200, bottom: 1166 / 1200 };
export const FALLBACK_POINTS: MapPoint[] = [
    { x: .28, y: .70 }, { x: .34, y: .48 }, { x: .51, y: .72 },
    { x: .66, y: .53 }, { x: .70, y: .36 }
];
export const fallbackMapMetadata = (world = 1): MapArtMetadata => ({
    world,
    nodes: Object.fromEntries(FALLBACK_POINTS.map((p, i) => [`${world}-${i + 1}`, p])),
    routes: {}, secretRoute: []
});
/** Data comes from the same camera used to render the terrain. Reject incomplete exports. */
export function parseMapMetadata(value: unknown, world = 1): MapArtMetadata | null {
    if (!value || typeof value !== 'object' || !Number.isInteger(world) || world < 1 || world > 6) return null;
    const data = value as MapArtMetadata;
    if (data.world !== undefined && data.world !== world) return null;
    const point = (v: unknown): v is MapPoint => !!v && typeof v === 'object' &&
        ['x', 'y'].every(k => typeof (v as Record<string, unknown>)[k] === 'number' &&
            Number.isFinite((v as Record<string, number>)[k]) && (v as Record<string, number>)[k] >= 0 && (v as Record<string, number>)[k] <= 1);
    if (!data.nodes || ![1, 2, 3, 4, 5].every(n => point(data.nodes[`${world}-${n}`]))) return null;
    const bounds = data.artBounds;
    if (bounds !== undefined && (!bounds || typeof bounds !== 'object' || !Number.isFinite(bounds.top) ||
        !Number.isFinite(bounds.bottom) || bounds.top < 0 || bounds.bottom > 1 || bounds.top >= bounds.bottom ||
        (bounds.left !== undefined && (!Number.isFinite(bounds.left) || bounds.left < 0 || bounds.left > 1)) ||
        (bounds.right !== undefined && (!Number.isFinite(bounds.right) || bounds.right < 0 || bounds.right > 1)) ||
        (bounds.left !== undefined && bounds.right !== undefined && bounds.left >= bounds.right))) return null;
    const matches = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y) <= 1e-5;
    const path = (value: unknown, from: number, to: number): value is MapPoint[] => Array.isArray(value) && value.length > 1 &&
        value.every(point) && matches(value[0], data.nodes[`${world}-${from}`]) && matches(value[value.length - 1], data.nodes[`${world}-${to}`]);
    if (!data.routes || typeof data.routes !== 'object') return null;
    const routes: Record<string, MapPoint[]> = {};
    for (let from = 0; from < 4; from++) {
        const key = `${from}:${from + 1}`, points = data.routes[key];
        if (!path(points, from + 1, from + 2)) return null;
        routes[key] = points;
    }
    let routeDurationsSeconds: Record<string, number> | undefined;
    if (data.routeDurationsSeconds !== undefined) {
        const timings = data.routeDurationsSeconds;
        if ((world < 4 || world > 6) || !timings || typeof timings !== 'object' || Array.isArray(timings) ||
            Object.keys(timings).length !== 4 || Object.keys(routes).some(key => !Number.isFinite(timings[key]) ||
                timings[key] <= 0 || timings[key] > 120)) return null;
        routeDurationsSeconds = Object.fromEntries(Object.keys(routes).map(key => [key, timings[key]]));
    }
    if (data.secretTransport !== undefined && (world !== 4 || data.secretTransport !== 'maintenance-cable')) return null;
    if (data.secretDurationSeconds !== undefined && ((world !== 5 && world !== 6) || !Number.isFinite(data.secretDurationSeconds) ||
        data.secretDurationSeconds <= 0 || data.secretDurationSeconds > 120)) return null;
    if (data.secretTransport === 'maintenance-cable') {
        if (!Array.isArray(data.secretRoute) || data.secretRoute.length !== 0) return null;
    } else if (!path(data.secretRoute, 3, 5)) return null;
    return { world, nodes: Object.fromEntries([1, 2, 3, 4, 5].map(n => [`${world}-${n}`, data.nodes[`${world}-${n}`]])),
        routes, secretRoute: data.secretRoute,
        ...(data.secretTransport ? { secretTransport: data.secretTransport } : {}),
        ...(routeDurationsSeconds ? { routeDurationsSeconds } : {}),
        ...(data.secretDurationSeconds !== undefined ? { secretDurationSeconds: data.secretDurationSeconds } : {}),
        ...(bounds ? { artBounds: { top: bounds.top, bottom: bounds.bottom,
            ...(bounds.left === undefined ? {} : { left: bounds.left }),
            ...(bounds.right === undefined ? {} : { right: bounds.right }) } } : {}) };
}

export interface MapPaintState {
    camera: MapCamera;
    world: number;
    time: number;
    reducedMotion: boolean;
    metadata: MapArtMetadata;
    assets: MapArtAssets;
    secret: boolean;
    completed: readonly string[];
    marker: MapPoint;
    walking: boolean;
    facingLeft: boolean;
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill();
}
function linePath(c: CanvasRenderingContext2D, points: MapPoint[], camera: MapCamera) {
    c.beginPath(); points.forEach((p, i) => { const q = mapToScreen(p, camera); if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); });
}
/** The painter has no event listeners, RAF or DOM dependencies. The game owns its clock. */
export function mapActorScale(camera: MapCamera): number {
    return Math.max(camera.height < 320 ? .85 : 1.15, Math.min(2.2, Math.min(camera.width / 900, camera.height / 380) * camera.zoom));
}
/** A single ocean layer shared by the connected atlas and the legacy island map. */
export function paintMapSea(c: CanvasRenderingContext2D, camera: MapCamera, time: number, reducedMotion: boolean): void {
    const { width: w, height: h } = camera, t = reducedMotion ? 0 : time;
    c.clearRect(0, 0, w, h);
    const sea = c.createLinearGradient(0, 0, w * .3, h);
    sea.addColorStop(0, '#173e59'); sea.addColorStop(.42, '#237d91'); sea.addColorStop(1, '#3ca6aa');
    c.fillStyle = sea; c.fillRect(0, 0, w, h);
    const sun = c.createRadialGradient(w * .65, h * .46, 0, w * .65, h * .46, w * .65);
    sun.addColorStop(0, '#91eee028'); sun.addColorStop(1, '#0a345700'); c.fillStyle = sun; c.fillRect(0, 0, w, h);
    // Long, low-contrast ocean swells. Deterministic placement, no per-frame randomness.
    c.lineWidth = 1.2;
    for (let i = 0; i < 72; i++) {
        const x = ((i * 197.3 + Math.sin(t / 4800 + i) * 8) % (w + 180)) - 90;
        const y = 45 + ((i * 83.7) % Math.max(1, h - 65));
        const length = 18 + i % 7 * 9;
        c.strokeStyle = i % 3 === 0 ? '#bde8d52a' : '#7cd6cf1a';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + length * .5, y - 3, x + length, y); c.stroke();
    }
}

export type MapIslandPaintState = Pick<MapPaintState, 'camera' | 'assets' | 'world' | 'metadata' | 'time' | 'reducedMotion' | 'completed' | 'secret'>;
/** The camera may be expressed in an island's local space to place it in an atlas. */
export function paintMapIsland(c: CanvasRenderingContext2D, state: MapIslandPaintState): void {
    const { camera, assets, world, metadata } = state;
    const { width: w, height: h } = camera, t = state.reducedMotion ? 0 : state.time;
    const top = mapToScreen({ x: 0, y: 0 }, camera), bottom = mapToScreen({ x: 1, y: 1 }, camera);
    if (assets.island) {
        if (assets.shadow) c.drawImage(assets.shadow, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
        c.drawImage(assets.island, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    } else {
        // Existing islands remain fully playable while their hand-authored dioramas expand.
        const anchor = mapToScreen({ x: .50, y: .57 }, camera);
        const scale = Math.min(w / 430, h / 190) * camera.zoom;
        c.save(); c.translate(anchor.x, anchor.y); c.scale(scale, scale);
        drawIsland(c, { ...ISLANDS[world - 1], map: [0, 0] }, false, t); c.restore();
        const pts = FALLBACK_POINTS.map(p => mapToScreen(p, camera));
        c.save(); c.setLineDash([4, 8]); c.strokeStyle = '#dce4c9aa'; c.lineWidth = 2;
        c.beginPath(); pts.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.stroke(); c.restore();
    }
    if (assets.island) {
        // Warm small trail studs are planted in the authored ground route.
        for (const [edge, path] of Object.entries(metadata.routes)) {
            const from = Number(edge.split(':')[0]) + 1;
            c.save(); c.setLineDash([1, 11]); c.lineCap = 'round'; c.lineWidth = 3;
            c.strokeStyle = state.completed.includes(`${world}-${from}`) ? '#fff4b6c4' : '#f1e4b658';
            linePath(c, path, camera); c.stroke(); c.restore();
        }
        if (metadata.secretRoute.length > 1) {
            c.save(); c.setLineDash(state.secret ? [4, 7] : [2, 12]); c.lineCap = 'round';
            c.strokeStyle = state.secret ? '#e9b5ff' : '#dcbbd969'; c.lineWidth = state.secret ? 3.5 : 2;
            if (state.secret) { c.shadowColor = '#b775ed'; c.shadowBlur = 7; }
            linePath(c, metadata.secretRoute, camera); c.stroke(); c.restore();
            const midpoint = metadata.secretRoute[Math.floor(metadata.secretRoute.length / 2)];
            const q = mapToScreen(midpoint, camera);
            ellipse(c, q.x, q.y, 10, 10, state.secret ? '#704c89' : '#334d60cc');
            c.fillStyle = '#ffe8fa'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(state.secret ? '✦' : '?', q.x, q.y);
        }
    }
}

export type MapActorPaintState = Pick<MapPaintState, 'camera' | 'marker' | 'time' | 'reducedMotion' | 'walking' | 'facingLeft'> & { scale?: number; shadow?: boolean };
/** Draw the original 16×26 Feka pixels with the supplied point anchored at his feet. */
export function paintMapActor(c: CanvasRenderingContext2D, state: MapActorPaintState): void {
    const { camera } = state, t = state.reducedMotion ? 0 : state.time;
    const p = mapToScreen(state.marker, camera);
    const scale = state.scale ?? mapActorScale(camera);
    const walking = state.walking && !state.reducedMotion;
    const frame = walking ? PLAYER_WALK[Math.floor(t / 95) % PLAYER_WALK.length] : PLAYER_SPRITES.idle;
    const x = p.x - 8 * scale, y = p.y - frame.length * scale;
    if (state.shadow !== false) ellipse(c, x + 8 * scale, p.y - 1, 9 * scale, 3.2 * scale, '#233c405b');
    // Keep Feka's recognizable pixel silhouette; only the surrounding world changes medium.
    for (let row = 0; row < frame.length; row++) for (let col = 0; col < frame[row].length; col++) {
        const color = PLAYER_PALETTE[frame[row][col]]; if (!color) continue;
        c.fillStyle = color; c.fillRect(Math.round(x + (state.facingLeft ? 15 - col : col) * scale), Math.round(y + row * scale), Math.ceil(scale), Math.ceil(scale));
    }
}

export function paintWorldMap(c: CanvasRenderingContext2D, state: MapPaintState): void {
    const { camera, assets, world } = state;
    const { width: w, height: h } = camera, t = state.reducedMotion ? 0 : state.time;
    paintMapSea(c, camera, state.time, state.reducedMotion);
    // The port moves more slowly than the foreground for restrained layered parallax.
    if (assets.port && world === 1 && w > 600) {
        const pw = Math.min(330, w * .26, h * .65), ph = pw / 1.6;
        c.save(); c.globalAlpha = .50; c.drawImage(assets.port, w * .81 - pw / 2 - (camera.center.x - .5) * w * .25, h * .06, pw, ph); c.restore();
    }
    // A faint navigational compass is scenery, never a clickable target.
    c.save(); c.translate(w - 60, h - 60); c.strokeStyle = '#cef4df38'; c.fillStyle = '#d3ead45a'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); c.moveTo(-33, 0); c.lineTo(33, 0); c.moveTo(0, -33); c.lineTo(0, 33); c.stroke();
    c.beginPath(); c.moveTo(0, -23); c.lineTo(5, 0); c.lineTo(0, 23); c.lineTo(-5, 0); c.closePath(); c.fill(); c.restore();
    paintMapIsland(c, state);
    // Small passing gulls sit in front of the terrain and behind the map controls.
    c.save(); c.strokeStyle = '#f9f2dcb8'; c.lineWidth = 1.7; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
        const x = w * (.28 + i * .045) + Math.sin(t / 5700 + i) * 24, y = h * .20 + i % 2 * 10;
        const flap = state.reducedMotion ? -2 : Math.sin(t / 360 + i) * 3;
        c.beginPath(); c.moveTo(x - 7, y + flap); c.quadraticCurveTo(x - 3, y - 4, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 7, y + flap); c.stroke();
    }
    c.restore();
    paintMapActor(c, state);
    const vignette = c.createLinearGradient(0, h - 70, 0, h);
    vignette.addColorStop(0, '#102c4100'); vignette.addColorStop(1, '#102c4166'); c.fillStyle = vignette; c.fillRect(0, h - 70, w, 70);
}

/** Fit pins/focus rings and, when supplied, the artwork between top tools and footer. */
export function frameMapPins(camera: MapCamera, points: Record<number, MapPoint>, selected: number, compact: boolean, artBounds?: MapArtBounds, hud?: { top: number; bottom: number }): MapCamera {
    const result = { ...camera, center: { ...camera.center } };
    const topLimit = Math.min(compact ? hud?.top ?? 132 : 12, Math.max(8, camera.height * .35));
    const bottomLimit = camera.height - (hud?.bottom ?? 12), pinHeight = compact ? 54 : 58;
    const bounds = () => {
        const tops: number[] = [], bottoms: number[] = [];
        for (const [index, point] of Object.entries(points)) {
            const p = mapToScreen(point, result);
            tops.push(p.y - pinHeight - (Number(index) === selected ? mapActorScale(result) * 26 + 4 : 0) - 8);
            bottoms.push(p.y + 8);
        }
        if (artBounds) {
            // Artwork needs room below the tools, while pins retain their existing
            // smaller inset. Sharing one inset would over-shrink short landscapes.
            const artTopLimit = hud?.top ?? (compact ? 135 : 80);
            tops.push(mapToScreen({ x: .5, y: artBounds.top }, result).y - (artTopLimit - topLimit));
            bottoms.push(mapToScreen({ x: .5, y: artBounds.bottom }, result).y);
        }
        return { top: Math.min(...tops), bottom: Math.max(...bottoms) };
    };
    let box = bounds();
    if (box.bottom - box.top > bottomLimit - topLimit) {
        let low = .06, high = result.zoom;
        for (let i = 0; i < 16; i++) {
            result.zoom = (low + high) / 2; box = bounds();
            if (box.bottom - box.top <= bottomLimit - topLimit) low = result.zoom; else high = result.zoom;
        }
        result.zoom = low; box = bounds();
    }
    const shift = box.top < topLimit ? topLimit - box.top : box.bottom > bottomLimit ? bottomLimit - box.bottom : 0;
    result.center.y -= shift / (Math.min(result.width / 1.6, result.height) * result.zoom);
    return result;
}
export function mapAssetPrefix(base = '/'): string {
    return `${base.endsWith('/') ? base : base + '/'}assets/world/map/`;
}
