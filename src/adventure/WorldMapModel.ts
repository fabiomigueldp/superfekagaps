import { isUnlocked } from './progress';
import type { AdventureSave } from './types';

/** Positions are normalized against the authored 1920 × 1200 map. */
export interface MapPoint { x: number; y: number }
export interface MapCamera {
    center: MapPoint;
    zoom: number;
    width: number;
    height: number;
}
export interface MapStageState { unlocked: boolean; completed: boolean; seals: number; secret: boolean }
const MAP_ASPECT = 1.6;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, Number.isNaN(n) ? low : n));
const unit = (n: number) => clamp(n, 0, 1);
const copy = (point: MapPoint): MapPoint => ({ x: point.x, y: point.y });
const distance = (a: MapPoint, b: MapPoint) => Math.hypot((b.x - a.x) * MAP_ASPECT, b.y - a.y);

export function mapStageState(stageId: string, save: AdventureSave): MapStageState {
    if (!/^[1-6]-[1-5]$/.test(stageId))
        return { unlocked: false, completed: false, seals: 0, secret: false };
    return {
        unlocked: isUnlocked(stageId, save),
        completed: save.completed.includes(stageId),
        seals: stageId.endsWith('-5') ? 0 : [1, 2, 3].filter(n => save.seals.includes(`${stageId}:s${n}`)).length,
        secret: stageId.endsWith('-3') && save.secrets.includes(stageId),
    };
}

/** Selection is always a zero-based campaign index, including locked stages. */
export const clampMapSelection = (selection: number): number => Math.trunc(clamp(selection, 0, 29));

export function moveMapSelection(current: number, key: string): number {
    const deltas: Record<string, number> = { arrowleft: -1, a: -1, arrowright: 1, d: 1, arrowup: -5, w: -5, arrowdown: 5, s: 5 };
    const delta = deltas[key.toLowerCase()];
    return clampMapSelection(clampMapSelection(current) + (typeof delta === 'number' ? delta : 0));
}

/** World IDs are one-based. Keep a remembered selection only within that world. */
export function stageIndexForWorld(world: number, current?: number): number {
    const first = (Math.trunc(clamp(world, 1, 6)) - 1) * 5;
    return current !== undefined && Number.isFinite(current) && current >= first && current < first + 5
        ? clampMapSelection(current) : first;
}

export function getMapCamera(selection: number, options: { overview: boolean }, width: number, height: number): MapCamera {
    const costa = clampMapSelection(selection) < 5;
    return {
        center: { x: .5, y: costa ? .52 : .5 },
        zoom: options.overview || !costa ? .82 : 1.14,
        width: clamp(width, 1, 16384),
        height: clamp(height, 1, 16384),
    };
}

/** Fit the 8:5 artwork without stretching, then apply the camera's zoom/center. */
export function mapToScreen(point: MapPoint, camera: MapCamera): MapPoint {
    const scale = Math.min(camera.width / MAP_ASPECT, camera.height) * camera.zoom;
    return { x: (point.x - camera.center.x) * scale * MAP_ASPECT + camera.width / 2,
        y: (point.y - camera.center.y) * scale + camera.height / 2 };
}

export function screenToMap(point: MapPoint, camera: MapCamera): MapPoint {
    const scale = Math.min(camera.width / MAP_ASPECT, camera.height) * camera.zoom;
    return { x: (point.x - camera.width / 2) / (scale * MAP_ASPECT) + camera.center.x,
        y: (point.y - camera.height / 2) / scale + camera.center.y };
}

export function sampleCubic(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint, progress: number): MapPoint {
    const t = unit(progress), u = 1 - t;
    return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
        y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
}

/** Samples authored polylines by distance; a single point is an instant relocation. */
export function samplePath(path: readonly MapPoint[], progress: number): MapPoint {
    if (!path.length) return { x: .5, y: .5 };
    const lengths = path.slice(1).map((point, index) => distance(path[index], point));
    let remaining = lengths.reduce((total, length) => total + length, 0) * unit(progress);
    for (let index = 0; index < lengths.length; index++) {
        const length = lengths[index];
        if (length > 0 && remaining < length) {
            const a = path[index], b = path[index + 1], t = remaining / length;
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
        remaining -= length;
    }
    return copy(path[path.length - 1]);
}

/** Reduced motion skips travel/camera interpolation altogether. Delta is seconds. */
export function easeMapMotion(progress: number, reducedMotion = false): number {
    const t = unit(progress);
    return reducedMotion ? 1 : t * t * (3 - 2 * t);
}
export const stableMapDelta = (seconds: number): number => clamp(seconds, 0, .05);

/**
 * Edge keys use zero-based indices, e.g. "0:1"; their points run from key start to end.
 * Only authored adjacent edges and the open local 3→5 shortcut may be walked.
 * Missing routes and island changes relocate to the destination instead of crossing water.
 */
export function buildTravelPath(previous: number, next: number, nodePoints: Record<number, MapPoint>,
    normalRoutes: Record<string, MapPoint[]> = {}, secretOpen = false, secretRoute: MapPoint[] = []): MapPoint[] {
    const start = clampMapSelection(previous), end = clampMapSelection(next), destination = nodePoints[end];
    if (!destination) return [];
    const relocate = () => [copy(destination)];
    if (start === end || !nodePoints[start] || Math.floor(start / 5) !== Math.floor(end / 5)) return relocate();
    const first = Math.floor(start / 5) * 5;
    const edges = new Map<string, MapPoint[]>();
    const addEdge = (from: number, to: number, points: MapPoint[]) => {
        if (!nodePoints[from] || !nodePoints[to] || !points.length) return;
        const path = [nodePoints[from], ...points, nodePoints[to]]
            .filter((point, index, all) => index === 0 || distance(all[index - 1], point) > 1e-9).map(copy);
        edges.set(`${from}:${to}`, path);
        edges.set(`${to}:${from}`, [...path].reverse());
    };
    for (let from = first; from < first + 4; from++) {
        const forward = normalRoutes[`${from}:${from + 1}`], backward = normalRoutes[`${from + 1}:${from}`];
        if (forward) addEdge(from, from + 1, forward);
        else if (backward) addEdge(from, from + 1, [...backward].reverse());
    }
    if (secretOpen) addEdge(first + 2, first + 4, secretRoute);
    const queue: number[][] = [[start]], visited = new Set([start]);
    while (queue.length) {
        const nodes = queue.shift()!, current = nodes[nodes.length - 1];
        if (current === end) {
            const path: MapPoint[] = [];
            for (let index = 1; index < nodes.length; index++) {
                const edge = edges.get(`${nodes[index - 1]}:${nodes[index]}`)!;
                path.push(...(index === 1 ? edge : edge.slice(1)).map(copy));
            }
            return path;
        }
        for (let neighbor = first; neighbor < first + 5; neighbor++)
            if (!visited.has(neighbor) && edges.has(`${current}:${neighbor}`)) {
                visited.add(neighbor);
                queue.push([...nodes, neighbor]);
            }
    }
    return relocate();
}

/** Retarget an in-flight walk without drawing a new straight line through terrain.
 * Reverse the already-walked section when the requested node is behind Feka;
 * otherwise finish the current authored edge before taking the next route.
 */
export function retargetMapTravel(active: readonly MapPoint[], progress: number, requested: readonly MapPoint[], history: readonly MapPoint[] = []): MapPoint[] {
    if (active.length < 2 || requested.length < 2 || progress >= 1) return requested.map(copy);
    const current = samplePath(active, progress), destination = requested[requested.length - 1];
    const lengths = active.slice(1).map((point, i) => distance(active[i], point));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) * unit(progress), segment = 0;
    while (segment < lengths.length - 1 && remaining >= lengths[segment]) { remaining -= lengths[segment]; segment++; }
    const targetIndex = active.findIndex(point => distance(point, destination) < 1e-7);
    let result = targetIndex >= 0
        ? targetIndex <= segment
            ? [current, ...active.slice(targetIndex, segment + 1).reverse()]
            : [current, ...active.slice(segment + 1, targetIndex + 1)]
        : [current, ...active.slice(segment + 1), ...requested.slice(1)];
    const length = (path: readonly MapPoint[]) => path.slice(1).reduce((sum, point, i) => sum + distance(path[i], point), 0);
    // A reversal may re-enter an authored route that already contains Feka's
    // current edge. Join there instead of visiting the abandoned target first.
    const activeA = active[segment], activeB = active[segment + 1];
    const ax = (activeB.x - activeA.x) * MAP_ASPECT, ay = activeB.y - activeA.y;
    for (let i = 0; i < requested.length - 1; i++) {
        const a = requested[i], b = requested[i + 1], dx = (b.x - a.x) * MAP_ASPECT, dy = b.y - a.y;
        const squared = dx * dx + dy * dy; if (squared < 1e-12) continue;
        const t = (((current.x - a.x) * MAP_ASPECT) * dx + (current.y - a.y) * dy) / squared;
        if (t < -1e-7 || t > 1 + 1e-7) continue;
        const projection = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const sameEdge = Math.abs(ax * dy - ay * dx) <= 1e-7 * Math.sqrt(squared * (ax * ax + ay * ay));
        if (distance(current, projection) > 1e-7 || (!sameEdge && t > 1e-7 && t < 1 - 1e-7)) continue;
        const joined = [current, ...requested.slice(i + 1)];
        if (length(joined) < length(result)) result = joined;
    }
    const past = recordMapTravel(history, active, progress);
    let pastTarget = -1;
    for (let i = 0; i < past.length; i++) if (distance(past[i], destination) < 1e-7) pastTarget = i;
    if (pastTarget >= 0) {
        const reverse = past.slice(pastTarget).reverse();
        if (length(reverse) < length(result)) result = reverse;
    }
    return result.filter((point, i) => !i || distance(result[i - 1], point) > 1e-9).map(copy);
}

/** Preserve walked waypoints until Feka reaches a node, including repeated retargets. */
export function recordMapTravel(history: readonly MapPoint[], active: readonly MapPoint[], progress: number): MapPoint[] {
    if (!active.length) return history.map(copy);
    const lengths = active.slice(1).map((point, i) => distance(active[i], point));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) * unit(progress), segment = 0;
    while (segment < lengths.length && remaining >= lengths[segment]) { remaining -= lengths[segment]; segment++; }
    const points = [...history, ...active.slice(0, segment + 1), samplePath(active, progress)];
    return points.filter((point, i) => !i || distance(points[i - 1], point) > 1e-9).map(copy);
}
