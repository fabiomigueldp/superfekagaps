import { localToAtlas, type AtlasBounds, type AtlasPlacement } from './WorldAtlasModel';
import type { CableAtlasFrame } from './WorldCableArt';
import type { CableCar, CablePairDefinition, CableTerminal } from './WorldCableModel';
import type { JourneyEdge, JourneyNetwork } from './WorldJourneyModel';
import type { JourneyBridgeOverlay, JourneyIsland } from './WorldJourneyNetwork';
import type { MapArtMetadata } from './WorldMapArt';
import type { MapPoint } from './WorldMapModel';

export const FACTORY_SERRA_LINK_EDGE = 'factory-serra-link';
export const SERRA_LINK_NODES = {
    3: { join: '3-5', landing: '3-serra-landing', approach: '3-serra-approach' },
    4: { join: '4-1', landing: '4-factory-landing', approach: '4-factory-approach' },
} as const;
export const SERRA_CABLE_STATIONS = {
    lower: { stage: '4-3', platform: '4-cable-lower-platform', approach: '4-cable-lower-approach' },
    upper: { stage: '4-5', platform: '4-cable-upper-platform', approach: '4-cable-upper-approach' },
} as const;
export const SERRA_CABLE_PAIR: CablePairDefinition = { lanes: {
    a: { rideEdge: 'serra-maintenance-cable-a',
        boardingEdges: { lower: '4-cable-a-lower-board', upper: '4-cable-a-upper-board' },
        berths: { lower: '4-cable-a-lower-berth', upper: '4-cable-a-upper-berth' } },
    b: { rideEdge: 'serra-maintenance-cable-b',
        boardingEdges: { lower: '4-cable-b-lower-board', upper: '4-cable-b-upper-board' },
        berths: { lower: '4-cable-b-lower-berth', upper: '4-cable-b-upper-berth' } },
} };

export interface FactorySerraLanding {
    join: MapPoint & { node: string };
    landing: MapPoint;
    junctionToLanding: MapPoint[];
    approachBounds: AtlasBounds;
    approachDurationSeconds: number;
}
export interface FactorySerraLink {
    placements: Record<3 | 4, AtlasPlacement>;
    landings: Record<3 | 4, FactorySerraLanding>;
    walkRoute: MapPoint[];
    walkDuration: number;
    overlays: Record<'open' | 'closed', JourneyBridgeOverlay>;
}
export interface SerraCableStation {
    stage: string;
    platform: MapPoint;
    stageToPlatform: MapPoint[];
    approachDurationSeconds: number;
}
export interface SerraCableBerth {
    foot: MapPoint;
    boardingRoute: MapPoint[];
    boardingDurationSeconds: number;
    /** Doorway position along the canonical platform → passenger-foot path. */
    aboardProgress: number;
}
export interface SerraCableLane {
    lower: SerraCableBerth;
    upper: SerraCableBerth;
    pathPoints: MapPoint[];
}
export interface SerraMaintenanceCable {
    stations: Record<CableTerminal, SerraCableStation>;
    lanes: Record<CableCar, SerraCableLane>;
    /** Whole-car compositing order, from the physically rear lane to the front. */
    paintOrder: readonly ['a', 'b'] | readonly ['b', 'a'];
    rideDurationSeconds: number;
    atlas: { path: string; width: number; height: number };
    frame: CableAtlasFrame;
}
export interface SerraJourneyOptions {
    /** Historical metadata input only; no direct Factory–Serra route is built. */
    factorySerraLink?: FactorySerraLink | null;
    factorySerraLinkReady?: boolean;
    /** Historical compatibility input; does not authorize a connection. */
    factorySerraLinkOpen?: boolean;
    maintenanceCable?: SerraMaintenanceCable | null;
    maintenanceCableReady?: boolean;
}

const worlds = [3, 4] as const, terminals = ['lower', 'upper'] as const, cars = ['a', 'b'] as const;
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const integer = (value: unknown): value is number => finite(value) && Number.isInteger(value) && value >= 0;
const dimension = (value: unknown): value is number => integer(value) && value > 0 && value <= 8192;
const duration = (value: unknown): value is number => positive(value) && value <= 120;
const asset = (value: unknown): value is string => typeof value === 'string' && /^\/assets\/world\/map\/[a-z0-9][a-z0-9._-]*\.webp$/.test(value);
const near = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y) <= 1e-5;
function point(value: unknown, local = false): MapPoint | null {
    const data = object(value);
    return data && finite(data.x) && finite(data.y) && (!local || (data.x >= 0 && data.x <= 1 && data.y >= 0 && data.y <= 1))
        ? { x: data.x, y: data.y } : null;
}
function path(value: unknown, local = false): MapPoint[] | null {
    if (!Array.isArray(value) || value.length < 2 || value.length > 512) return null;
    const result = value.map(value => point(value, local));
    return result.every((entry): entry is MapPoint => entry !== null) ? result : null;
}
const joined = (path: readonly MapPoint[], from: MapPoint, to: MapPoint) => path.length > 1 && near(path[0], from) && near(path[path.length - 1], to);
const matchingPlacement = (a: AtlasPlacement, b: AtlasPlacement) => positive(a.scale) && positive(b.scale) && a.scale === b.scale && near(a.origin, b.origin);

/** Used after image load; readiness cannot be inferred from JSON alone. */
export function matchesSerraAssetSize(image: { naturalWidth: number; naturalHeight: number } | null,
    expected: { width: number; height: number }): boolean {
    return !!image && dimension(expected.width) && dimension(expected.height) &&
        image.naturalWidth === expected.width && image.naturalHeight === expected.height;
}

function parseLinkLanding(value: unknown, metadata: MapArtMetadata, world: 3 | 4): FactorySerraLanding | null {
    const data = object(value), rawJoin = object(data?.join), size = object(data?.size), rawBounds = object(data?.approachBounds);
    const join = point(rawJoin), landing = point(data?.landing), approach = path(data?.junctionToLanding), stage = SERRA_LINK_NODES[world].join;
    const approachDurationSeconds = data?.approachDurationSeconds;
    if (!data || data.version !== 1 || data.island !== (world === 3 ? 'fabrica' : 'serra') || metadata.world !== world ||
        size?.width !== 1920 || size.height !== 1200 || !join || !landing || !approach || rawJoin?.node !== stage ||
        !metadata.nodes[stage] || !near(join, metadata.nodes[stage]) || !joined(approach, join, landing) || !duration(approachDurationSeconds) ||
        !rawBounds || !finite(rawBounds.left) || !finite(rawBounds.top) || !finite(rawBounds.right) || !finite(rawBounds.bottom) ||
        rawBounds.left >= rawBounds.right || rawBounds.top >= rawBounds.bottom) return null;
    const approachBounds = { left: rawBounds.left, top: rawBounds.top, right: rawBounds.right, bottom: rawBounds.bottom };
    if (approach.some(point => point.x < approachBounds.left - 1e-5 || point.x > approachBounds.right + 1e-5 ||
        point.y < approachBounds.top - 1e-5 || point.y > approachBounds.bottom + 1e-5)) return null;
    return { join: { ...join, node: stage }, landing, junctionToLanding: approach, approachBounds, approachDurationSeconds };
}
function parseLinkOverlay(value: unknown): JourneyBridgeOverlay | null {
    const data = object(value);
    if (!data || !asset(data.path) || !dimension(data.width) || !dimension(data.height) || !finite(data.left) || !finite(data.top) ||
        !positive(data.widthInMap) || !positive(data.heightInMap) ||
        Math.abs(data.widthInMap * 1920 - data.width) > .01 || Math.abs(data.heightInMap * 1200 - data.height) > .01) return null;
    return { path: data.path, width: data.width, height: data.height, left: data.left, top: data.top,
        widthInMap: data.widthInMap, heightInMap: data.heightInMap };
}

/** Validate the new supported link independently against the accepted island
 * snapshots and caller-owned placements; it never changes the released bridge.
 */
export function parseFactorySerraLink(value: unknown, factory: MapArtMetadata, serra: MapArtMetadata,
    expectedPlacements: Readonly<Record<3 | 4, AtlasPlacement>>): FactorySerraLink | null {
    const data = object(value), islands = object(data?.islands), rawPlacements = object(data?.placements);
    const route = object(data?.walkRoute), rawOverlays = object(data?.overlays);
    const factoryLanding = parseLinkLanding(islands?.fabrica, factory, 3), serraLanding = parseLinkLanding(islands?.serra, serra, 4);
    const walkRoute = path(route?.points), open = parseLinkOverlay(rawOverlays?.open), closed = parseLinkOverlay(rawOverlays?.closed);
    if (!data || data.version !== 1 || data.connection !== FACTORY_SERRA_LINK_EDGE || route?.coordinateSystem !== 'atlas' ||
        !duration(route.durationSeconds) || !walkRoute || !factoryLanding || !serraLanding || !open || !closed) return null;
    const placements = {} as FactorySerraLink['placements'];
    for (const world of worlds) {
        const raw = object(rawPlacements?.[world === 3 ? 'fabrica' : 'serra']), origin = point(raw?.origin);
        if (!origin || !positive(raw?.scale) || !expectedPlacements[world] ||
            !matchingPlacement({ origin, scale: raw.scale }, expectedPlacements[world])) return null;
        placements[world] = { origin, scale: raw.scale };
    }
    if (!joined(walkRoute, localToAtlas(factoryLanding.landing, placements[3]), localToAtlas(serraLanding.landing, placements[4]))) return null;
    return { placements, landings: { 3: factoryLanding, 4: serraLanding }, walkRoute,
        walkDuration: route.durationSeconds, overlays: { open, closed } };
}

function parseCableStation(value: unknown, metadata: MapArtMetadata, terminal: CableTerminal): SerraCableStation | null {
    const data = object(value), platform = point(data?.platform, true), approach = path(data?.stageToPlatform, true);
    const stage = SERRA_CABLE_STATIONS[terminal].stage;
    if (!data || data.stage !== stage || !platform || !approach || !duration(data.approachDurationSeconds) ||
        !metadata.nodes[stage] || !joined(approach, metadata.nodes[stage], platform)) return null;
    return { stage, platform, stageToPlatform: approach, approachDurationSeconds: data.approachDurationSeconds };
}
function parseCableBerth(value: unknown, platform: MapPoint): SerraCableBerth | null {
    const data = object(value), foot = point(data?.foot, true), boardingRoute = path(data?.boardingRoute, true);
    if (!data || !foot || !boardingRoute || !duration(data.boardingDurationSeconds) || !finite(data.aboardProgress) ||
        data.aboardProgress < 0 || data.aboardProgress > 1 || !joined(boardingRoute, platform, foot)) return null;
    return { foot, boardingRoute, boardingDurationSeconds: data.boardingDurationSeconds, aboardProgress: data.aboardProgress };
}
function parseCableFrame(value: unknown, atlas: { width: number; height: number }): CableAtlasFrame | null {
    const data = object(value), passengerFoot = point(data?.passengerFoot);
    if (!data || !dimension(data.width) || !dimension(data.height) || !positive(data.widthInMap) || data.widthInMap > 1 ||
        !positive(data.passengerPixelScale) || data.passengerPixelScale > 16 || !passengerFoot ||
        passengerFoot.x < 0 || passengerFoot.x > data.width || passengerFoot.y < 0 || passengerFoot.y > data.height) return null;
    const crops = {} as Pick<CableAtlasFrame, 'rear' | 'foreground'>;
    for (const kind of ['rear', 'foreground'] as const) {
        const crop = object(data[kind]);
        if (!crop || !integer(crop.x) || !integer(crop.y) || crop.w !== data.width || crop.h !== data.height ||
            crop.x + crop.w > atlas.width || crop.y + crop.h > atlas.height) return null;
        crops[kind] = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
    }
    return { width: data.width, height: data.height, widthInMap: data.widthInMap,
        passengerFoot, passengerPixelScale: data.passengerPixelScale, ...crops };
}

/** The optional vehicle has its own complete contract; an absent cabin cannot
 * turn the aerial route into a secret walk or prevent supported Serra travel.
 */
export function parseSerraMaintenanceCable(value: unknown, metadata: MapArtMetadata): SerraMaintenanceCable | null {
    const data = object(value), rawStations = object(data?.stations), rawLanes = object(data?.lanes), atlas = object(data?.atlas);
    const paintOrder = data?.paintOrder;
    if (!data || data.version !== 1 || data.world !== 4 || data.coordinateSystem !== 'island-local' || metadata.world !== 4 ||
        metadata.secretTransport !== 'maintenance-cable' || metadata.secretRoute.length !== 0 || !duration(data.rideDurationSeconds) ||
        !Array.isArray(paintOrder) || paintOrder.length !== 2 ||
        !((paintOrder[0] === 'a' && paintOrder[1] === 'b') || (paintOrder[0] === 'b' && paintOrder[1] === 'a')) ||
        !atlas || !asset(atlas.path) || !dimension(atlas.width) || !dimension(atlas.height)) return null;
    const frame = parseCableFrame(data.frame, { width: atlas.width, height: atlas.height });
    const lower = parseCableStation(rawStations?.lower, metadata, 'lower'), upper = parseCableStation(rawStations?.upper, metadata, 'upper');
    if (!frame || !lower || !upper) return null;
    const lanes = {} as SerraMaintenanceCable['lanes'];
    for (const car of cars) {
        const raw = object(rawLanes?.[car]), from = parseCableBerth(raw?.lower, lower.platform), to = parseCableBerth(raw?.upper, upper.platform);
        const pathPoints = path(raw?.pathPoints, true);
        if (!from || !to || !pathPoints || !joined(pathPoints, from.foot, to.foot)) return null;
        lanes[car] = { lower: from, upper: to, pathPoints };
    }
    return { stations: { lower, upper }, lanes, rideDurationSeconds: data.rideDurationSeconds,
        paintOrder: paintOrder[0] === 'a' ? ['a', 'b'] : ['b', 'a'],
        atlas: { path: atlas.path, width: atlas.width, height: atlas.height }, frame };
}

/** Build the local Serra maintenance cable only. Fábrica connects via Guaíra.
 * Cabin direction permissions are separately derived from the session pair state.
 */
export function buildSerraJourney(options: SerraJourneyOptions & { islands: readonly JourneyIsland[]; secrets: readonly string[] }): JourneyNetwork {
    const nodes: Record<string, MapPoint> = {}, edges: JourneyEdge[] = [];
    // Fábrica and Serra connect only through Guaíra flights, including legacy saves.
    const serra = options.islands.find(island => island.world === 4);
    const cable = options.maintenanceCable;
    if (cable && options.maintenanceCableReady && serra?.ready && serra.metadata.world === 4 && options.secrets.includes('4-3') &&
        serra.metadata.secretTransport === 'maintenance-cable' && serra.metadata.secretRoute.length === 0 && terminals.every(terminal => {
            const station = cable.stations[terminal], stage = SERRA_CABLE_STATIONS[terminal].stage;
            return station.stage === stage && !!serra.metadata.nodes[stage] && joined(station.stageToPlatform, serra.metadata.nodes[stage], station.platform);
        })) {
        const transform = (point: MapPoint) => localToAtlas(point, serra.placement);
        for (const terminal of terminals) {
            const station = cable.stations[terminal], ids = SERRA_CABLE_STATIONS[terminal];
            nodes[ids.platform] = transform(station.platform);
            edges.push({ id: ids.approach, from: ids.stage, to: ids.platform, mode: 'walk', duration: station.approachDurationSeconds,
                points: station.stageToPlatform.map(transform) });
        }
        for (const car of cars) {
            const lane = cable.lanes[car], ids = SERRA_CABLE_PAIR.lanes[car];
            for (const terminal of terminals) {
                const berth = lane[terminal]; nodes[ids.berths[terminal]] = transform(berth.foot);
                edges.push({ id: ids.boardingEdges[terminal], from: SERRA_CABLE_STATIONS[terminal].platform, to: ids.berths[terminal],
                    mode: 'cable-board', duration: berth.boardingDurationSeconds, points: berth.boardingRoute.map(transform) });
            }
            edges.push({ id: ids.rideEdge, from: ids.berths.lower, to: ids.berths.upper, mode: 'cable',
                duration: cable.rideDurationSeconds, points: lane.pathPoints.map(transform) });
        }
    }
    return { nodes, edges };
}
