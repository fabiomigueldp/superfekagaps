import { localToAtlas, type AtlasBounds, type AtlasPlacement } from './WorldAtlasModel';
import type { CableAtlasFrame } from './WorldCableArt';
import type { CableCar, CablePairDefinition, CableTerminal } from './WorldCableModel';
import type { JourneyEdge, JourneyNetwork } from './WorldJourneyModel';
import type { JourneyBridgeOverlay, JourneyIsland } from './WorldJourneyNetwork';
import type { MapArtMetadata } from './WorldMapArt';
import { samplePath, type MapPoint } from './WorldMapModel';

export const RESERVA_PASSENGER_CONNECTION = 'serra-reserva-passenger';
/** Lower/upper name canonical pair endpoints, not either island's elevation. */
export const PASSENGER_CABLE_STATIONS = {
    lower: { world: 4, stage: '4-5', platform: '4-passenger-platform', approach: '4-passenger-approach' },
    upper: { world: 5, stage: '5-1', platform: '5-passenger-platform', approach: '5-passenger-approach' },
} as const;
/** Each rendered vehicle uses its globally unique rideEdge, never just a/b. */
export const PASSENGER_CABLE_PAIR: CablePairDefinition = { lanes: {
    a: { rideEdge: 'serra-reserva-passenger-a',
        boardingEdges: { lower: '4-passenger-a-board', upper: '5-passenger-a-board' },
        berths: { lower: '4-passenger-a-berth', upper: '5-passenger-a-berth' } },
    b: { rideEdge: 'serra-reserva-passenger-b',
        boardingEdges: { lower: '4-passenger-b-board', upper: '5-passenger-b-board' },
        berths: { lower: '4-passenger-b-berth', upper: '5-passenger-b-berth' } },
} };

export interface PassengerCableSupport {
    bounds: AtlasBounds;
    /** Island-local convex deck/trail footprints. Their union supports every
     * entire walking segment; isolated supported vertices are insufficient. */
    polygons: MapPoint[][];
}
export interface PassengerCableStation {
    world: 4 | 5;
    stage: string;
    platform: MapPoint;
    stageToPlatform: MapPoint[];
    approachDurationSeconds: number;
    support: PassengerCableSupport;
    /** Local framing envelope, including terminal structures and parked cabins.
     * Kept separate from the physical deck support polygons. */
    artBounds: AtlasBounds;
}
export interface PassengerCableBerth {
    foot: MapPoint;
    boardingRoute: MapPoint[];
    boardingDurationSeconds: number;
    doorway: MapPoint;
    /** Distance along the platform→foot path, measured with the map's 8:5 metric. */
    aboardProgress: number;
}
export interface PassengerCableLane {
    lower: PassengerCableBerth;
    upper: PassengerCableBerth;
    /** Atlas coordinates, always Serra→Reserva, including exact berth feet. */
    pathPoints: MapPoint[];
}
export interface PassengerCableOverlay extends JourneyBridgeOverlay {
    /** Omitted layers are common to both gate states. */
    when?: 'open' | 'closed';
}
export interface ReservaPassengerCable {
    placements: Record<4 | 5, AtlasPlacement>;
    stations: Record<CableTerminal, PassengerCableStation>;
    lanes: Record<CableCar, PassengerCableLane>;
    /** Whole-car rear→front compositing order, independent of occupied car. */
    paintOrder: readonly ['a', 'b'] | readonly ['b', 'a'];
    rideDurationSeconds: number;
    atlas: { path: string; width: number; height: number };
    frame: CableAtlasFrame;
    /** Optional vector span art, in a/b order. Every knot is the corresponding
     * ride-foot knot translated to the cabin's fixed projected cable grip. */
    cablePolylines: MapPoint[][];
    /** Native-resolution atlas-space terminal/support/cable artwork. */
    overlays: PassengerCableOverlay[];
}
export interface ReservaJourneyOptions {
    passengerCable?: ReservaPassengerCable | null;
    /** Set only after both island snapshots, cabin layers and all overlays load
     * at their declared dimensions. The controller defers late readiness until
     * a safe stage arrival, just as for the older connections. */
    passengerCableReady?: boolean;
    /** Derived by the controller from isUnlocked('5-1', save), never a secret. */
    passengerCableOpen?: boolean;
}

const worlds = [4, 5] as const, terminals = ['lower', 'upper'] as const, cars = ['a', 'b'] as const;
const EPS = 1e-5;
// The accepted islands and additive supports are comfortably inside this bound;
// cap exports as well as path lengths before geometric arithmetic or rendering.
const MAX_COORDINATE = 16;
const FEKA_PIXEL_MAP_WIDTH = (4.15 / 20.6) * 3 / 384;
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const integer = (value: unknown): value is number => finite(value) && Number.isInteger(value) && value >= 0;
const dimension = (value: unknown): value is number => integer(value) && value > 0 && value <= 8192;
const duration = (value: unknown): value is number => positive(value) && value <= 120;
const asset = (value: unknown): value is string => typeof value === 'string' && /^\/assets\/world\/map\/[a-z0-9][a-z0-9._-]*\.webp$/.test(value);
const near = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y) <= EPS;
const cross = (a: MapPoint, b: MapPoint, p: MapPoint) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const insideBounds = (p: MapPoint, b: AtlasBounds) => p.x >= b.left - EPS && p.x <= b.right + EPS && p.y >= b.top - EPS && p.y <= b.bottom + EPS;
const matchingPlacement = (a: AtlasPlacement, b: AtlasPlacement) => positive(a.scale) && positive(b.scale) && a.scale === b.scale && near(a.origin, b.origin);
function point(value: unknown): MapPoint | null {
    const data = object(value);
    return data && finite(data.x) && finite(data.y) && Math.abs(data.x) <= MAX_COORDINATE && Math.abs(data.y) <= MAX_COORDINATE
        ? { x: data.x, y: data.y } : null;
}
function path(value: unknown): MapPoint[] | null {
    if (!Array.isArray(value) || value.length < 2 || value.length > 512) return null;
    const points = value.map(point);
    return points.every((p): p is MapPoint => p !== null) && points.some(p => !near(p, points[0])) ? points : null;
}
const joined = (points: readonly MapPoint[], from: MapPoint, to: MapPoint) => points.length > 1 && near(points[0], from) && near(points[points.length - 1], to);
const winding = (polygon: readonly MapPoint[]) => Math.sign(polygon.reduce((area, p, i) => {
    const q = polygon[(i + 1) % polygon.length]; return area + p.x * q.y - p.y * q.x;
}, 0));

function parseBounds(value: unknown): AtlasBounds | null {
    const bounds = object(value);
    if (!bounds || !finite(bounds.left) || !finite(bounds.top) || !finite(bounds.right) || !finite(bounds.bottom) ||
        [bounds.left, bounds.top, bounds.right, bounds.bottom].some(value => Math.abs(value) > MAX_COORDINATE) ||
        bounds.left >= bounds.right || bounds.top >= bounds.bottom) return null;
    return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
}
function parseSupport(value: unknown): PassengerCableSupport | null {
    const data = object(value), bounds = parseBounds(data?.bounds);
    if (!bounds || !Array.isArray(data?.polygons) || data.polygons.length < 1 || data.polygons.length > 64) return null;
    const polygons: MapPoint[][] = [];
    for (const raw of data.polygons) {
        const polygon = path(raw);
        if (!polygon || polygon.length < 3 || polygon.length > 64 || polygon.some(p => !insideBounds(p, bounds))) return null;
        const direction = winding(polygon);
        // Every vertex must be on the interior side of every edge. This rejects
        // concave/self-crossing exports as well as zero-area or repeated edges.
        if (!direction || polygon.some((a, i) => {
            const b = polygon[(i + 1) % polygon.length];
            return near(a, b) || polygon.some(p => direction * cross(a, b, p) < -1e-10);
        })) return null;
        polygons.push(polygon);
    }
    return { bounds, polygons };
}

/** Clip a walking segment to each convex support polygon, then require the
 * union of intervals to cover [0,1]. A gap between decks cannot become a walk. */
function supported(points: readonly MapPoint[], support: PassengerCableSupport): boolean {
    if (points.some(p => !insideBounds(p, support.bounds))) return false;
    return points.slice(1).every((to, index) => {
        const from = points[index], intervals: Array<[number, number]> = [];
        for (const polygon of support.polygons) {
            const direction = winding(polygon);
            let low = 0, high = 1;
            for (let i = 0; i < polygon.length && low <= high; i++) {
                const a = polygon[i], b = polygon[(i + 1) % polygon.length];
                const edgeLength = Math.hypot(b.x - a.x, b.y - a.y);
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

function parseStation(value: unknown, metadata: MapArtMetadata, terminal: CableTerminal): PassengerCableStation | null {
    const data = object(value), ids = PASSENGER_CABLE_STATIONS[terminal];
    const platform = point(data?.platform), approach = path(data?.stageToPlatform), support = parseSupport(data?.support);
    const artBounds = parseBounds(data?.artBounds);
    if (!data || data.world !== ids.world || metadata.world !== ids.world || data.stage !== ids.stage || !platform || !approach || !support || !artBounds ||
        !duration(data.approachDurationSeconds) || !metadata.nodes[ids.stage] || !joined(approach, metadata.nodes[ids.stage], platform) ||
        !supported(approach, support) || approach.some(p => !insideBounds(p, artBounds))) return null;
    return { world: ids.world, stage: ids.stage, platform, stageToPlatform: approach, support, artBounds,
        approachDurationSeconds: data.approachDurationSeconds };
}
function parseBerth(value: unknown, station: PassengerCableStation): PassengerCableBerth | null {
    const data = object(value), foot = point(data?.foot), boardingRoute = path(data?.boardingRoute), doorway = point(data?.doorway);
    if (!data || !foot || !boardingRoute || !doorway || !duration(data.boardingDurationSeconds) || !finite(data.aboardProgress) ||
        data.aboardProgress < 0 || data.aboardProgress > 1 || !joined(boardingRoute, station.platform, foot) ||
        !supported(boardingRoute, station.support) || boardingRoute.some(p => !insideBounds(p, station.artBounds)) ||
        !near(doorway, samplePath(boardingRoute, data.aboardProgress))) return null;
    return { foot, boardingRoute, doorway, boardingDurationSeconds: data.boardingDurationSeconds, aboardProgress: data.aboardProgress };
}
function parseFrame(value: unknown, atlas: { width: number; height: number }): CableAtlasFrame | null {
    const data = object(value), rawFoot = object(data?.passengerFoot);
    const passengerFoot = rawFoot && finite(rawFoot.x) && finite(rawFoot.y) ? { x: rawFoot.x, y: rawFoot.y } : null;
    if (!data || !dimension(data.width) || !dimension(data.height) || !positive(data.widthInMap) || data.widthInMap > 1 ||
        !positive(data.passengerPixelScale) || data.passengerPixelScale > 16 || !passengerFoot ||
        passengerFoot.x < 0 || passengerFoot.x > data.width || passengerFoot.y < 0 || passengerFoot.y > data.height ||
        Math.abs(data.widthInMap * data.passengerPixelScale / data.width - FEKA_PIXEL_MAP_WIDTH) > 1e-9) return null;
    const crops = {} as Pick<CableAtlasFrame, 'rear' | 'foreground'>;
    for (const kind of ['rear', 'foreground'] as const) {
        const crop = object(data[kind]);
        if (!crop || !integer(crop.x) || !integer(crop.y) || crop.w !== data.width || crop.h !== data.height ||
            crop.x + crop.w > atlas.width || crop.y + crop.h > atlas.height) return null;
        crops[kind] = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
    }
    const a = crops.rear, b = crops.foreground;
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return null;
    return { width: data.width, height: data.height, widthInMap: data.widthInMap,
        passengerFoot, passengerPixelScale: data.passengerPixelScale, ...crops };
}
function parseOverlay(value: unknown): PassengerCableOverlay | null {
    const data = object(value);
    if (!data || !asset(data.path) || !dimension(data.width) || !dimension(data.height) || !finite(data.left) || !finite(data.top) ||
        Math.abs(data.left) > MAX_COORDINATE || Math.abs(data.top) > MAX_COORDINATE ||
        (data.when !== undefined && data.when !== 'open' && data.when !== 'closed') || !positive(data.widthInMap) || !positive(data.heightInMap) ||
        Math.abs(data.widthInMap * 1920 - data.width) > .01 || Math.abs(data.heightInMap * 1200 - data.height) > .01) return null;
    return { path: data.path, width: data.width, height: data.height, left: data.left, top: data.top,
        widthInMap: data.widthInMap, heightInMap: data.heightInMap, ...(data.when === undefined ? {} : { when: data.when }) };
}

/** Validate against accepted island snapshots and caller-owned fixed placements.
 * Geometry cannot unlock travel, and no released route or save field is changed. */
export function parseReservaPassengerCable(value: unknown, serra: MapArtMetadata, reserva: MapArtMetadata,
    expectedPlacements: Readonly<Record<4 | 5, AtlasPlacement>>): ReservaPassengerCable | null {
    const data = object(value), rawPlacements = object(data?.placements), rawStations = object(data?.stations), rawLanes = object(data?.lanes);
    const atlas = object(data?.atlas), paintOrder = data?.paintOrder;
    if (!data || data.version !== 1 || data.connection !== RESERVA_PASSENGER_CONNECTION || data.coordinateSystem !== 'atlas' ||
        !duration(data.rideDurationSeconds) || !Array.isArray(paintOrder) || paintOrder.length !== 2 ||
        !((paintOrder[0] === 'a' && paintOrder[1] === 'b') || (paintOrder[0] === 'b' && paintOrder[1] === 'a')) ||
        !atlas || !asset(atlas.path) || !dimension(atlas.width) || !dimension(atlas.height)) return null;
    const placements = {} as ReservaPassengerCable['placements'];
    for (const world of worlds) {
        const raw = object(rawPlacements?.[world === 4 ? 'serra' : 'reserva']), origin = point(raw?.origin);
        if (!origin || !positive(raw?.scale) || !expectedPlacements[world] ||
            !matchingPlacement({ origin, scale: raw.scale }, expectedPlacements[world])) return null;
        placements[world] = { origin, scale: raw.scale };
    }
    const lower = parseStation(rawStations?.lower, serra, 'lower'), upper = parseStation(rawStations?.upper, reserva, 'upper');
    const frame = parseFrame(data.frame, { width: atlas.width, height: atlas.height });
    if (!lower || !upper || !frame) return null;
    const lanes = {} as ReservaPassengerCable['lanes'];
    for (const car of cars) {
        const raw = object(rawLanes?.[car]), from = parseBerth(raw?.lower, lower), to = parseBerth(raw?.upper, upper), pathPoints = path(raw?.pathPoints);
        if (!from || !to || !pathPoints || !joined(pathPoints, localToAtlas(from.foot, placements[4]), localToAtlas(to.foot, placements[5]))) return null;
        lanes[car] = { lower: from, upper: to, pathPoints };
    }
    if (terminals.some(terminal => near(lanes.a[terminal].foot, lanes.b[terminal].foot))) return null;
    for (const terminal of terminals) {
        const station = terminal === 'lower' ? lower : upper, pixelX = frame.widthInMap / frame.width / placements[station.world].scale;
        const pixelY = pixelX * 1.6;
        if (cars.some(car => {
            const foot = lanes[car][terminal].foot;
            return !insideBounds({ x: foot.x - frame.passengerFoot.x * pixelX, y: foot.y - frame.passengerFoot.y * pixelY }, station.artBounds) ||
                !insideBounds({ x: foot.x + (frame.width - frame.passengerFoot.x) * pixelX,
                    y: foot.y + (frame.height - frame.passengerFoot.y) * pixelY }, station.artBounds);
        })) return null;
    }
    const rawCables = data.cablePolylines === undefined ? [] : data.cablePolylines;
    if (!Array.isArray(rawCables) || (rawCables.length !== 0 && rawCables.length !== 2)) return null;
    const cablePolylines: MapPoint[][] = [];
    let gripOffset: MapPoint | null = null;
    for (const [index, raw] of rawCables.entries()) {
        const points = path(raw), feet = lanes[cars[index]].pathPoints;
        if (!points || points.length !== feet.length) return null;
        const offset = { x: points[0].x - feet[0].x, y: points[0].y - feet[0].y };
        const pixelX = frame.widthInMap / frame.width, grip = {
            x: frame.passengerFoot.x + offset.x / pixelX, y: frame.passengerFoot.y + offset.y / (pixelX * 1.6),
        };
        if ((gripOffset && !near(gripOffset, offset)) || grip.x < 0 || grip.x > frame.width || grip.y < 0 || grip.y >= frame.passengerFoot.y ||
            points.some((p, i) => !near(p, { x: feet[i].x + offset.x, y: feet[i].y + offset.y }))) return null;
        gripOffset = offset; cablePolylines.push(points);
    }
    const rawOverlays = data.overlays === undefined ? [] : data.overlays;
    if (!Array.isArray(rawOverlays) || rawOverlays.length > 16) return null;
    const overlays = rawOverlays.map(parseOverlay);
    if (!overlays.every((overlay): overlay is PassengerCableOverlay => overlay !== null)) return null;
    return { placements, stations: { lower, upper }, lanes, frame, atlas: { path: atlas.path, width: atlas.width, height: atlas.height },
        rideDurationSeconds: data.rideDurationSeconds, paintOrder: paintOrder[0] === 'a' ? ['a', 'b'] : ['b', 'a'], cablePolylines, overlays };
}

/** Exact loaded bitmap sizes are checked independently of the JSON contract. */
export function matchesReservaAssetSize(image: { naturalWidth: number; naturalHeight: number } | null,
    expected: { width: number; height: number }): boolean {
    return !!image && dimension(expected.width) && dimension(expected.height) &&
        image.naturalWidth === expected.width && image.naturalHeight === expected.height;
}

/** Pure append-only graph contribution. An absent, stale, locked or unready line
 * leaves every released ferry, bridge, maintenance and local walking edge intact. */
export function buildReservaJourney(options: ReservaJourneyOptions & { islands: readonly JourneyIsland[] }): JourneyNetwork {
    const nodes: Record<string, MapPoint> = {}, edges: JourneyEdge[] = [], cable = options.passengerCable;
    if (!cable || !options.passengerCableReady || !options.passengerCableOpen) return { nodes, edges };
    const serra = options.islands.find(island => island.world === 4), reserva = options.islands.find(island => island.world === 5);
    if (!serra?.ready || !reserva?.ready || !terminals.every(terminal => {
        const station = cable.stations[terminal], ids = PASSENGER_CABLE_STATIONS[terminal], island = terminal === 'lower' ? serra : reserva;
        return station.world === ids.world && island.metadata.world === ids.world && station.stage === ids.stage &&
            !!island.metadata.nodes[ids.stage] && matchingPlacement(cable.placements[ids.world], island.placement) &&
            joined(station.stageToPlatform, island.metadata.nodes[ids.stage], station.platform);
    }) || cars.some(car => !joined(cable.lanes[car].pathPoints,
        localToAtlas(cable.lanes[car].lower.foot, serra.placement), localToAtlas(cable.lanes[car].upper.foot, reserva.placement)))) return { nodes, edges };
    const transform = (terminal: CableTerminal, point: MapPoint) => localToAtlas(point, terminal === 'lower' ? serra.placement : reserva.placement);
    for (const terminal of terminals) {
        const station = cable.stations[terminal], ids = PASSENGER_CABLE_STATIONS[terminal];
        nodes[ids.platform] = transform(terminal, station.platform);
        edges.push({ id: ids.approach, from: ids.stage, to: ids.platform, mode: 'walk', duration: station.approachDurationSeconds,
            points: station.stageToPlatform.map(point => transform(terminal, point)) });
    }
    for (const car of cars) {
        const lane = cable.lanes[car], ids = PASSENGER_CABLE_PAIR.lanes[car];
        for (const terminal of terminals) {
            const berth = lane[terminal]; nodes[ids.berths[terminal]] = transform(terminal, berth.foot);
            edges.push({ id: ids.boardingEdges[terminal], from: PASSENGER_CABLE_STATIONS[terminal].platform, to: ids.berths[terminal],
                mode: 'cable-board', duration: berth.boardingDurationSeconds, points: berth.boardingRoute.map(point => transform(terminal, point)) });
        }
        edges.push({ id: ids.rideEdge, from: ids.berths.lower, to: ids.berths.upper, mode: 'cable',
            duration: cable.rideDurationSeconds, points: lane.pathPoints.map(point => ({ ...point })) });
    }
    return { nodes, edges };
}
