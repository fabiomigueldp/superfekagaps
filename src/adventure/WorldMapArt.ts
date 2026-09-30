import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../assets/playerSpriteSpec';
import { drawIsland } from './WorldStageArt';
import { ISLANDS } from './campaign';
import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';

export interface MapArtMetadata {
    nodes: Record<string, MapPoint>;
    routes: Record<string, MapPoint[]>;
    secretRoute: MapPoint[];
}
export interface MapArtAssets {
    island: CanvasImageSource | null;
    shadow: CanvasImageSource | null;
    port: CanvasImageSource | null;
}
/** Normalized vertical silhouette bounds, excluding the separate soft shadow. */
export interface MapArtBounds { top: number; bottom: number }
/** Alpha bounds of the shipped 1920 × 1200 Costa layer: lighthouse tip through dock. */
export const COSTA_ART_BOUNDS: MapArtBounds = { top: 96 / 1200, bottom: 1166 / 1200 };
export const FALLBACK_POINTS: MapPoint[] = [
    { x: .28, y: .70 }, { x: .34, y: .48 }, { x: .51, y: .72 },
    { x: .66, y: .53 }, { x: .70, y: .36 }
];
export const fallbackMapMetadata = (): MapArtMetadata => ({
    nodes: Object.fromEntries(FALLBACK_POINTS.map((p, i) => [`1-${i + 1}`, p])),
    routes: {}, secretRoute: []
});
/** Data comes from the same camera used to render the terrain. Reject incomplete exports. */
export function parseMapMetadata(value: unknown): MapArtMetadata | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as MapArtMetadata;
    const point = (v: unknown): v is MapPoint => !!v && typeof v === 'object' &&
        ['x', 'y'].every(k => typeof (v as Record<string, unknown>)[k] === 'number' &&
            Number.isFinite((v as Record<string, number>)[k]) && (v as Record<string, number>)[k] >= 0 && (v as Record<string, number>)[k] <= 1);
    if (!data.nodes || ![1, 2, 3, 4, 5].every(n => point(data.nodes[`1-${n}`]))) return null;
    const routes: Record<string, MapPoint[]> = {};
    if (data.routes && typeof data.routes === 'object') for (const [key, points] of Object.entries(data.routes)) {
        if (/^[0-4]:[0-4]$/.test(key) && Array.isArray(points) && points.length > 1 && points.every(point)) routes[key] = points;
    }
    return { nodes: data.nodes, routes, secretRoute: Array.isArray(data.secretRoute) && data.secretRoute.every(point) ? data.secretRoute : [] };
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
export function paintWorldMap(c: CanvasRenderingContext2D, state: MapPaintState): void {
    const { camera, assets, world, metadata } = state;
    const { width: w, height: h } = camera, t = state.reducedMotion ? 0 : state.time;
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
    // The port moves more slowly than the foreground for restrained layered parallax.
    if (assets.port && world === 1 && w > 600) {
        const pw = Math.min(330, w * .26, h * .65), ph = pw / 1.6;
        c.save(); c.globalAlpha = .50; c.drawImage(assets.port, w * .81 - pw / 2 - (camera.center.x - .5) * w * .25, h * .06, pw, ph); c.restore();
    }
    // A faint navigational compass is scenery, never a clickable target.
    c.save(); c.translate(w - 60, h - 60); c.strokeStyle = '#cef4df38'; c.fillStyle = '#d3ead45a'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); c.moveTo(-33, 0); c.lineTo(33, 0); c.moveTo(0, -33); c.lineTo(0, 33); c.stroke();
    c.beginPath(); c.moveTo(0, -23); c.lineTo(5, 0); c.lineTo(0, 23); c.lineTo(-5, 0); c.closePath(); c.fill(); c.restore();
    const top = mapToScreen({ x: 0, y: 0 }, camera), bottom = mapToScreen({ x: 1, y: 1 }, camera);
    if (world === 1 && assets.island) {
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
    if (world === 1 && assets.island) {
        // Warm small trail studs are planted in the authored ground route.
        for (const [edge, path] of Object.entries(metadata.routes)) {
            const from = Number(edge.split(':')[0]) + 1;
            c.save(); c.setLineDash([1, 11]); c.lineCap = 'round'; c.lineWidth = 3;
            c.strokeStyle = state.completed.includes(`1-${from}`) ? '#fff4b6c4' : '#f1e4b658';
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
    // Small passing gulls sit in front of the terrain and behind the map controls.
    c.save(); c.strokeStyle = '#f9f2dcb8'; c.lineWidth = 1.7; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
        const x = w * (.28 + i * .045) + Math.sin(t / 5700 + i) * 24, y = h * .20 + i % 2 * 10;
        const flap = state.reducedMotion ? -2 : Math.sin(t / 360 + i) * 3;
        c.beginPath(); c.moveTo(x - 7, y + flap); c.quadraticCurveTo(x - 3, y - 4, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 7, y + flap); c.stroke();
    }
    c.restore();
    const p = mapToScreen(state.marker, camera);
    const scale = mapActorScale(camera);
    const walking = state.walking && !state.reducedMotion;
    const frame = walking ? PLAYER_WALK[Math.floor(t / 95) % PLAYER_WALK.length] : PLAYER_SPRITES.idle;
    const x = p.x - 8 * scale, y = p.y - frame.length * scale;
    ellipse(c, x + 8 * scale, p.y - 1, 9 * scale, 3.2 * scale, '#233c405b');
    // Keep Feka's recognizable pixel silhouette; only the surrounding world changes medium.
    for (let row = 0; row < frame.length; row++) for (let col = 0; col < frame[row].length; col++) {
        const color = PLAYER_PALETTE[frame[row][col]]; if (!color) continue;
        c.fillStyle = color; c.fillRect(Math.round(x + (state.facingLeft ? 15 - col : col) * scale), Math.round(y + row * scale), Math.ceil(scale), Math.ceil(scale));
    }
    const vignette = c.createLinearGradient(0, h - 70, 0, h);
    vignette.addColorStop(0, '#102c4100'); vignette.addColorStop(1, '#102c4166'); c.fillStyle = vignette; c.fillRect(0, h - 70, w, 70);
}

/** Fit pins/focus rings and, when supplied, the artwork between top tools and footer. */
export function frameMapPins(camera: MapCamera, points: Record<number, MapPoint>, selected: number, compact: boolean, artBounds?: MapArtBounds): MapCamera {
    const result = { ...camera, center: { ...camera.center } };
    const topLimit = Math.min(compact ? 132 : 12, Math.max(8, camera.height * .35));
    const bottomLimit = camera.height - 12, pinHeight = compact ? 54 : 58;
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
            const artTopLimit = compact ? 135 : 80;
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
