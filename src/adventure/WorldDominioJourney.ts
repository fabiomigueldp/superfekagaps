import { localToAtlas, type AtlasBounds, type AtlasPlacement } from './WorldAtlasModel';
import type { FerryDefinition } from './WorldFerryModel';
import type { JourneyEdge, JourneyNetwork } from './WorldJourneyModel';
import type { JourneyBridgeOverlay, JourneyDock, JourneyIsland } from './WorldJourneyNetwork';
import type { MapArtMetadata } from './WorldMapArt';
import type { MapPoint } from './WorldMapModel';

export const RESERVA_DOMINIO_CONNECTION = 'reserva-dominio-ferry';
export const DOMINIO_FERRY: FerryDefinition = {
    id: 'reserva-dominio-sail', sailEdge: 'reserva-dominio-sail', worlds: [5, 6],
    boardingEdges: { 5: '5-board', 6: '6-board' }, berths: { 5: '5-berth', 6: '6-berth' },
};
export const DOMINIO_DOCK_NODES = {
    5: { join: '5-5', dock: '5-dock', berth: '5-berth' },
    6: { join: '6-1', dock: '6-dock', berth: '6-berth' },
} as const;
export interface DominioDockSupport { bounds: AtlasBounds; polygons: MapPoint[][] }
export interface DominioJourneyDock extends Omit<JourneyDock, 'overlay' | 'join'> {
    join: MapPoint & { node: string };
    approachDurationSeconds: number;
    boardingDurationSeconds: number;
    /** Canonical dock→passenger progress at the measured hull-side doorway. */
    aboardProgress: number;
    /** Local convex floor footprints, including supported portions of the hull. */
    support: DominioDockSupport;
    /** Local close-up framing bounds, independent of floor and bitmap crops. */
    approachBounds: AtlasBounds;
    artBounds: AtlasBounds;
}
export interface DominioJourneyOverlay extends JourneyBridgeOverlay { when?: 'open' | 'closed' }
export interface DominioJourneyConnection {
    boatMetadata: string;
    docks: Record<5 | 6, DominioJourneyDock>;
    placements: Record<5 | 6, AtlasPlacement>;
    /** Atlas passenger-foot path; canonical direction is Reserva → Domínio. */
    sailRoute: MapPoint[];
    sailDuration: number;
    segmentHeadings: number[];
    reverseSegmentHeadings: number[];
    /** Cropped additive layers in atlas coordinates, independently of floor. */
    overlays: DominioJourneyOverlay[];
}
export interface DominioJourneyOptions {
    dominioConnection?: DominioJourneyConnection | null;
    /** Both accepted island images, shared boat and all dock overlays loaded. */
    dominioConnectionReady?: boolean;
    /** Derived only from isUnlocked('6-1', save), never metadata or a secret. */
    dominioConnectionOpen?: boolean;
}

const worlds = [5, 6] as const, EPS = 1e-5, MAX_COORDINATE = 16;
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const dimension = (value: unknown): value is number => positive(value) && Number.isInteger(value) && value <= 8192;
const duration = (value: unknown): value is number => positive(value) && value <= 120;
const heading = (value: unknown): value is number => finite(value) && Number.isInteger(value) && value >= 0 && value <= 7;
const near = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y) <= EPS;
const inside = (p: MapPoint, b: AtlasBounds) => p.x >= b.left - EPS && p.x <= b.right + EPS && p.y >= b.top - EPS && p.y <= b.bottom + EPS;
const cross = (a: MapPoint, b: MapPoint, p: MapPoint) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const winding = (polygon: readonly MapPoint[]) => Math.sign(polygon.reduce((area, p, i) => {
    const q = polygon[(i + 1) % polygon.length]; return area + p.x * q.y - p.y * q.x;
}, 0));
const joined = (points: readonly MapPoint[], from: MapPoint, to: MapPoint) => points.length > 1 && near(points[0], from) && near(points[points.length - 1], to);
const matchingPlacement = (a: AtlasPlacement, b: AtlasPlacement) => positive(a.scale) && positive(b.scale) && a.scale === b.scale && near(a.origin, b.origin);

function point(value: unknown): MapPoint | null {
    const data = object(value);
    return data && finite(data.x) && finite(data.y) && Math.abs(data.x) <= MAX_COORDINATE && Math.abs(data.y) <= MAX_COORDINATE
        ? { x: data.x, y: data.y } : null;
}
function path(value: unknown): MapPoint[] | null {
    if (!Array.isArray(value) || value.length < 2 || value.length > 512) return null;
    const points = value.map(point);
    return points.every((p): p is MapPoint => p !== null) && points.every((p, i) => !i || !near(p, points[i - 1])) ? points : null;
}
function bounds(value: unknown): AtlasBounds | null {
    const data = object(value);
    if (!data || !finite(data.left) || !finite(data.top) || !finite(data.right) || !finite(data.bottom) ||
        [data.left, data.top, data.right, data.bottom].some(value => Math.abs(value) > MAX_COORDINATE) ||
        data.left >= data.right || data.top >= data.bottom) return null;
    return { left: data.left, top: data.top, right: data.right, bottom: data.bottom };
}
function parseSupport(value: unknown): DominioDockSupport | null {
    const data = object(value), envelope = bounds(data?.bounds);
    if (!envelope || !Array.isArray(data?.polygons) || data.polygons.length < 1 || data.polygons.length > 64) return null;
    const polygons: MapPoint[][] = [];
    for (const raw of data.polygons) {
        const polygon = path(raw);
        if (!polygon || polygon.length < 3 || polygon.length > 64 || polygon.some(p => !inside(p, envelope))) return null;
        const direction = winding(polygon);
        if (!direction || polygon.some((a, i) => {
            const b = polygon[(i + 1) % polygon.length];
            return near(a, b) || polygon.some(p => direction * cross(a, b, p) < -1e-10);
        })) return null;
        polygons.push(polygon);
    }
    return { bounds: envelope, polygons };
}
/** Clip to each convex deck, then require its interval union to cover every
 * complete walking segment. Supported endpoints alone cannot bridge a gap. */
function supported(points: readonly MapPoint[], support: DominioDockSupport): boolean {
    if (points.some(p => !inside(p, support.bounds))) return false;
    return points.slice(1).every((to, index) => {
        const from = points[index], intervals: Array<[number, number]> = [];
        for (const polygon of support.polygons) {
            const direction = winding(polygon);
            let low = 0, high = 1;
            for (let i = 0; i < polygon.length && low <= high; i++) {
                const a = polygon[i], b = polygon[(i + 1) % polygon.length], edgeLength = Math.hypot(b.x - a.x, b.y - a.y);
                const start = direction * cross(a, b, from) / edgeLength;
                const delta = direction * (cross(a, b, to) - cross(a, b, from)) / edgeLength;
                if (Math.abs(delta) < 1e-12) { if (start < -EPS) high = -1; }
                else if (delta > 0) low = Math.max(low, (-EPS - start) / delta);
                else high = Math.min(high, (-EPS - start) / delta);
            }
            if (low <= high) intervals.push([low, high]);
        }
        intervals.sort((a, b) => a[0] - b[0]);
        let covered = 0;
        for (const [low, high] of intervals) {
            if (low > covered + 1e-9) break;
            covered = Math.max(covered, high);
        }
        return covered >= 1;
    });
}
function parseDock(value: unknown, metadata: MapArtMetadata, world: 5 | 6): DominioJourneyDock | null {
    const data = object(value), rawJoin = object(data?.join), rawBerth = object(data?.berth), size = object(data?.size);
    const join = point(rawJoin), dock = point(data?.dock), passenger = point(rawBerth?.passenger), waterline = point(rawBerth?.waterline);
    const approach = path(data?.junctionToDock), boardingRoute = path(data?.boardingRoute), support = parseSupport(data?.support);
    const approachBounds = bounds(data?.approachBounds), artBounds = bounds(data?.artBounds), stage = DOMINIO_DOCK_NODES[world].join;
    if (!data || data.version !== 1 || data.island !== (world === 5 ? 'reserva' : 'dominio') || metadata.world !== world ||
        size?.width !== 1920 || size.height !== 1200 || !join || rawJoin?.node !== stage || !metadata.nodes[stage] ||
        !near(join, metadata.nodes[stage]) || !dock || !passenger || !waterline || !approach || !boardingRoute ||
        !rawBerth || !heading(rawBerth.headingFrame) || !duration(data.approachDurationSeconds) || !duration(data.boardingDurationSeconds) ||
        !finite(data.aboardProgress) || data.aboardProgress <= 0 || data.aboardProgress >= 1 ||
        !joined(approach, join, dock) || !joined(boardingRoute, dock, passenger) || !support ||
        !supported(approach, support) || !supported(boardingRoute, support) || !approachBounds || !artBounds ||
        [...approach, ...boardingRoute].some(p => !inside(p, approachBounds) || !inside(p, artBounds)) || !inside(waterline, artBounds)) return null;
    return { join: { ...join, node: stage }, dock, junctionToDock: approach, boardingRoute,
        berth: { passenger, waterline, headingFrame: rawBerth.headingFrame },
        approachDurationSeconds: data.approachDurationSeconds, boardingDurationSeconds: data.boardingDurationSeconds,
        aboardProgress: data.aboardProgress, support, approachBounds, artBounds };
}
function parseOverlay(value: unknown): DominioJourneyOverlay | null {
    const data = object(value);
    if (!data || typeof data.path !== 'string' || !/^\/assets\/world\/map\/[a-z0-9][a-z0-9._-]*\.webp$/.test(data.path) ||
        !dimension(data.width) || !dimension(data.height) || !finite(data.left) || !finite(data.top) ||
        Math.abs(data.left) > MAX_COORDINATE || Math.abs(data.top) > MAX_COORDINATE ||
        (data.when !== undefined && data.when !== 'open' && data.when !== 'closed') || !positive(data.widthInMap) || !positive(data.heightInMap) ||
        Math.abs(data.widthInMap * 1920 - data.width) > .01 || Math.abs(data.heightInMap * 1200 - data.height) > .01) return null;
    return { path: data.path, width: data.width, height: data.height, left: data.left, top: data.top,
        widthInMap: data.widthInMap, heightInMap: data.heightInMap, ...(data.when === undefined ? {} : { when: data.when }) };
}

/** Accepted stage joins and caller-owned fixed placements anchor this addition.
 * It cannot change released geometry, select a new boat atlas, or unlock travel. */
export function parseDominioJourney(value: unknown, reserva: MapArtMetadata, dominio: MapArtMetadata,
    expectedPlacements: Readonly<Record<5 | 6, AtlasPlacement>>): DominioJourneyConnection | null {
    const data = object(value), rawPlacements = object(data?.placements), islands = object(data?.islands), sailing = object(data?.sailRoute);
    if (!data || data.version !== 1 || data.connection !== RESERVA_DOMINIO_CONNECTION ||
        data.boatMetadata !== '/assets/world/map/journey-boat.meta.json' || sailing?.coordinateSystem !== 'atlas' ||
        !duration(sailing.durationSeconds)) return null;
    const placements = {} as DominioJourneyConnection['placements'];
    for (const world of worlds) {
        const raw = object(rawPlacements?.[world === 5 ? 'reserva' : 'dominio']), origin = point(raw?.origin);
        if (!origin || !positive(raw?.scale) || !expectedPlacements[world] ||
            !matchingPlacement({ origin, scale: raw.scale }, expectedPlacements[world])) return null;
        placements[world] = { origin, scale: raw.scale };
    }
    const source = parseDock(islands?.reserva, reserva, 5), destination = parseDock(islands?.dominio, dominio, 6), sailRoute = path(sailing.points);
    if (!source || !destination || !sailRoute || !joined(sailRoute,
        localToAtlas(source.berth.passenger, placements[5]), localToAtlas(destination.berth.passenger, placements[6]))) return null;
    const headings = (value: unknown): value is number[] => Array.isArray(value) && value.length === sailRoute.length - 1 && value.every(heading);
    if (!headings(sailing.segmentHeadings) || !headings(sailing.reverseSegmentHeadings) ||
        !Array.isArray(data.overlays) || data.overlays.length < 1 || data.overlays.length > 16) return null;
    const overlays = data.overlays.map(parseOverlay);
    if (!overlays.every((overlay): overlay is DominioJourneyOverlay => overlay !== null)) return null;
    return { boatMetadata: data.boatMetadata, placements, docks: { 5: source, 6: destination }, sailRoute,
        sailDuration: sailing.durationSeconds, segmentHeadings: [...sailing.segmentHeadings], reverseSegmentHeadings: [...sailing.reverseSegmentHeadings], overlays };
}

export function matchesDominioAssetSize(image: { naturalWidth: number; naturalHeight: number } | null,
    expected: { width: number; height: number }): boolean {
    return !!image && dimension(expected.width) && dimension(expected.height) &&
        image.naturalWidth === expected.width && image.naturalHeight === expected.height;
}

/** Append only. Failure, stale geometry or a closed progression gate removes
 * this ferry's contribution without changing another crossing or local route. */
export function buildDominioJourney(options: DominioJourneyOptions & { islands: readonly JourneyIsland[] }): JourneyNetwork {
    const nodes: Record<string, MapPoint> = {}, edges: JourneyEdge[] = [], connection = options.dominioConnection;
    if (!connection || !options.dominioConnectionReady || !options.dominioConnectionOpen) return { nodes, edges };
    const islands = worlds.map(world => options.islands.find(island => island.world === world));
    if (islands.some((island, index) => {
        const world = worlds[index], dock = connection.docks[world], stage = DOMINIO_DOCK_NODES[world].join;
        return !island?.ready || island.metadata.world !== world || !island.metadata.nodes[stage] || dock.join.node !== stage ||
            !near(dock.join, island.metadata.nodes[stage]) || !matchingPlacement(connection.placements[world], island.placement) ||
            !joined(dock.junctionToDock, island.metadata.nodes[stage], dock.dock) || !joined(dock.boardingRoute, dock.dock, dock.berth.passenger);
    }) || !joined(connection.sailRoute, localToAtlas(connection.docks[5].berth.passenger, islands[0]!.placement),
        localToAtlas(connection.docks[6].berth.passenger, islands[1]!.placement))) return { nodes, edges };
    for (const [index, world] of worlds.entries()) {
        const dock = connection.docks[world], ids = DOMINIO_DOCK_NODES[world], transform = (p: MapPoint) => localToAtlas(p, islands[index]!.placement);
        nodes[ids.dock] = transform(dock.dock); nodes[ids.berth] = transform(dock.berth.passenger);
        edges.push({ id: `${world}-dock-approach`, from: ids.join, to: ids.dock, mode: 'walk', duration: dock.approachDurationSeconds,
            points: dock.junctionToDock.map(transform) });
        edges.push({ id: DOMINIO_FERRY.boardingEdges[world], from: ids.dock, to: ids.berth, mode: 'board', duration: dock.boardingDurationSeconds,
            points: dock.boardingRoute.map(transform) });
    }
    // Exports may round local and atlas coordinates independently. Anchor the
    // validated endpoints exactly, so JourneyModel cannot insert tiny extra
    // segments and shift the authored per-segment heading indices.
    const sailRoute = connection.sailRoute.map(p => ({ ...p }));
    sailRoute[0] = { ...nodes[DOMINIO_FERRY.berths[5]] };
    sailRoute[sailRoute.length - 1] = { ...nodes[DOMINIO_FERRY.berths[6]] };
    edges.push({ id: DOMINIO_FERRY.sailEdge, from: DOMINIO_FERRY.berths[5], to: DOMINIO_FERRY.berths[6], mode: 'sail',
        duration: connection.sailDuration, points: sailRoute });
    return { nodes, edges };
}
