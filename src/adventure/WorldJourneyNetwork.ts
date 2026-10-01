import { COAST_PORT_PLACEMENTS, localToAtlas, type AtlasBounds, type AtlasPlacement } from './WorldAtlasModel';
import type { BoatAtlasFrame } from './WorldAtlasArt';
import type { MapArtMetadata } from './WorldMapArt';
import type { MapPoint } from './WorldMapModel';
import type { JourneyEdge, JourneyNetwork } from './WorldJourneyModel';
import { buildSerraJourney, type SerraJourneyOptions } from './WorldSerraJourney';
import { buildReservaJourney, type ReservaJourneyOptions } from './WorldReservaJourney';
import { buildDominioJourney, type DominioJourneyOptions } from './WorldDominioJourney';

export interface JourneyDock {
    join: MapPoint & { route?: string; segment?: number; t?: number; node?: string };
    dock: MapPoint;
    junctionToDock: MapPoint[];
    boardingRoute: MapPoint[];
    berth: { passenger: MapPoint; waterline: MapPoint; headingFrame: number };
    overlay: { path: string; width: number; height: number; left: number; top: number; widthInMap: number; heightInMap: number };
}
export interface JourneyConnection {
    boatMetadata: string;
    docks: Record<1 | 2, JourneyDock>;
    /** Passenger foot positions in the fixed Costa/Porto atlas. */
    sailRoute: MapPoint[];
    sailDuration: number;
    /** Atlas frame indices per segment; reverse headings follow reversed path order. */
    segmentHeadings: number[];
    reverseSegmentHeadings: number[];
}
export const PORT_FACTORY_BRIDGE_EDGE = 'port-factory-bridge';
export const BRIDGE_NODES = {
    2: { join: '2-bridge-junction', landing: '2-bridge-landing' },
    3: { join: '3-1', landing: '3-bridge-landing' },
} as const;
export interface JourneyBridgeLanding {
    join: JourneyDock['join'];
    landing: MapPoint;
    junctionToLanding: MapPoint[];
    /** Local bounds of this approach only, excluding the inter-island span. */
    approachBounds: AtlasBounds;
}
/** Cropped bridge art uses atlas coordinates, including the gaps between islands. */
export interface JourneyBridgeOverlay {
    path: string;
    width: number;
    height: number;
    left: number;
    top: number;
    widthInMap: number;
    heightInMap: number;
}
export interface JourneyBridge {
    landings: Record<2 | 3, JourneyBridgeLanding>;
    placements: Record<2 | 3, AtlasPlacement>;
    bridgeRoute: MapPoint[];
    bridgeDuration: number;
    overlays: { open: JourneyBridgeOverlay; closed: JourneyBridgeOverlay };
}
export interface JourneyBoatMetadata {
    atlas: { path: string; width: number; height: number };
    frames: (BoatAtlasFrame & { index: number; screenHeadingRadians: number; worldHeadingRadians: number })[];
    headingProjection?: { xAxis: MapPoint; yAxis: MapPoint };
}
export interface JourneyIsland {
    world: number;
    metadata: MapArtMetadata;
    placement: AtlasPlacement;
    /** Accepted image and matching metadata have both loaded. */
    ready: boolean;
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const integer = (value: unknown): value is number => finite(value) && Number.isInteger(value) && value >= 0;
const positive = (value: unknown): value is number => finite(value) && value > 0;
const near = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y) <= 1e-5;
const asset = (value: unknown, extension: 'webp' | 'json'): value is string => typeof value === 'string' &&
    new RegExp(`^/assets/world/map/[a-z0-9][a-z0-9._-]*\\.${extension}$`).test(value);
function point(value: unknown): MapPoint | null {
    const data = object(value);
    return data && finite(data.x) && finite(data.y) ? { x: data.x, y: data.y } : null;
}
function path(value: unknown): MapPoint[] | null {
    if (!Array.isArray(value) || value.length < 2 || value.length > 512) return null;
    const points = value.map(point);
    return points.every((p): p is MapPoint => p !== null) ? points : null;
}
function joined(points: MapPoint[], from: MapPoint, to: MapPoint): boolean {
    return near(points[0], from) && near(points[points.length - 1], to);
}

/** Reject a mismatched camera export before attaching any new ground geometry. */
function parseDock(value: unknown, metadata: MapArtMetadata, world: 1 | 2): JourneyDock | null {
    const data = object(value), joinData = object(data?.join), berth = object(data?.berth), overlay = object(data?.overlay), size = object(data?.size);
    const join = point(joinData), dock = point(data?.dock), passenger = point(berth?.passenger), waterline = point(berth?.waterline);
    const approach = path(data?.junctionToDock), boardingRoute = path(data?.boardingRoute);
    if (data?.version !== 1 || data.island !== (world === 1 ? 'costa' : 'porto') || metadata.world !== world ||
        size?.width !== 1920 || size.height !== 1200 || !join || !joinData || !dock || !passenger || !waterline || !approach || !boardingRoute ||
        !joined(approach, join, dock) || !joined(boardingRoute, dock, passenger) || !berth || !integer(berth.headingFrame) || berth.headingFrame > 7 ||
        !overlay || !asset(overlay.path, 'webp') || !integer(overlay.width) || !integer(overlay.height) || overlay.width < 1 || overlay.height < 1 ||
        !finite(overlay.left) || !finite(overlay.top) || !positive(overlay.widthInMap) || !positive(overlay.heightInMap) ||
        overlay.left < 0 || overlay.top < 0 || overlay.left + overlay.widthInMap > 1.00001 || overlay.top + overlay.heightInMap > 1.00001 ||
        Math.abs(overlay.widthInMap * 1920 - overlay.width) > .01 || Math.abs(overlay.heightInMap * 1200 - overlay.height) > .01) return null;
    let validatedJoin: JourneyDock['join'];
    if (world === 1) {
        const route = metadata.routes['2:3'];
        if (joinData.route !== '2:3' || joinData.from !== '1-3' || joinData.to !== '1-4' || !route || !integer(joinData.segment) ||
            joinData.segment >= route.length - 1 || !finite(joinData.t) || joinData.t < 0 || joinData.t > 1) return null;
        const a = route[joinData.segment], b = route[joinData.segment + 1];
        if (!near(join, { x: a.x + (b.x - a.x) * joinData.t, y: a.y + (b.y - a.y) * joinData.t })) return null;
        validatedJoin = { ...join, route: '2:3', segment: joinData.segment, t: joinData.t };
    } else {
        if (joinData.node !== '2-1' || !metadata.nodes['2-1'] || !near(join, metadata.nodes['2-1'])) return null;
        validatedJoin = { ...join, node: '2-1' };
    }
    return { join: validatedJoin, dock, junctionToDock: approach, boardingRoute,
        berth: { passenger, waterline, headingFrame: berth.headingFrame },
        overlay: { path: overlay.path, width: overlay.width, height: overlay.height, left: overlay.left, top: overlay.top,
            widthInMap: overlay.widthInMap, heightInMap: overlay.heightInMap } };
}

/** Parse only fields consumed by the runtime; build tools/audits remain source data. */
export function parseJourneyConnection(value: unknown, costa: MapArtMetadata, porto: MapArtMetadata): JourneyConnection | null {
    const data = object(value), islands = object(data?.islands), sailing = object(data?.sailRoute), placements = object(data?.placements);
    const coast = parseDock(islands?.costa, costa, 1), port = parseDock(islands?.porto, porto, 2);
    const sailRoute = path(sailing?.points), duration = sailing?.durationSeconds;
    if (data?.version !== 1 || !asset(data.boatMetadata, 'json') || !coast || !port || !sailRoute || !positive(duration) || duration > 120 ||
        sailing?.coordinateSystem !== 'atlas') return null;
    const headings = (value: unknown): value is number[] => Array.isArray(value) && value.length === sailRoute.length - 1 &&
        value.every(index => integer(index) && index <= 7);
    if (!headings(sailing.segmentHeadings) || !headings(sailing.reverseSegmentHeadings)) return null;
    for (const [world, name] of [[1, 'costa'], [2, 'porto']] as const) {
        const placement = object(placements?.[name]), origin = point(placement?.origin), expected = COAST_PORT_PLACEMENTS[world];
        if (!origin || !near(origin, expected.origin) || placement?.scale !== expected.scale) return null;
    }
    if (!joined(sailRoute, localToAtlas(coast.berth.passenger, COAST_PORT_PLACEMENTS[1]),
        localToAtlas(port.berth.passenger, COAST_PORT_PLACEMENTS[2]))) return null;
    return { boatMetadata: data.boatMetadata, docks: { 1: coast, 2: port }, sailRoute, sailDuration: duration,
        segmentHeadings: [...sailing.segmentHeadings], reverseSegmentHeadings: [...sailing.reverseSegmentHeadings] };
}

function bridgeJoinMatches(join: JourneyDock['join'], metadata: MapArtMetadata, world: 2 | 3): boolean {
    if (metadata.world !== world) return false;
    if (world === 3) return join.node === '3-1' && !!metadata.nodes['3-1'] && near(join, metadata.nodes['3-1']);
    const route = metadata.routes['3:4'];
    if (join.route !== '3:4' || !route || !integer(join.segment) || join.segment >= route.length - 1 ||
        !finite(join.t) || join.t < 0 || join.t > 1) return false;
    const a = route[join.segment], b = route[join.segment + 1];
    return near(join, { x: a.x + (b.x - a.x) * join.t, y: a.y + (b.y - a.y) * join.t });
}
function parseBridgeLanding(value: unknown, metadata: MapArtMetadata, world: 2 | 3): JourneyBridgeLanding | null {
    const data = object(value), rawJoin = object(data?.join), size = object(data?.size);
    const join = point(rawJoin), landing = point(data?.landing), approach = path(data?.junctionToLanding);
    const bounds = object(data?.approachBounds);
    if (data?.version !== 1 || data.island !== (world === 2 ? 'porto' : 'fabrica') ||
        size?.width !== 1920 || size.height !== 1200 || !rawJoin || !join || !landing || !approach || !joined(approach, join, landing) ||
        !bounds || !finite(bounds.left) || !finite(bounds.top) || !finite(bounds.right) || !finite(bounds.bottom) ||
        bounds.left >= bounds.right || bounds.top >= bounds.bottom) return null;
    const approachBounds = { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
    if (approach.some(point => point.x < approachBounds.left - 1e-5 || point.x > approachBounds.right + 1e-5 ||
        point.y < approachBounds.top - 1e-5 || point.y > approachBounds.bottom + 1e-5)) return null;
    let validated: JourneyDock['join'];
    if (world === 2) {
        if (rawJoin.route !== '3:4' || rawJoin.from !== '2-4' || rawJoin.to !== '2-5' || !integer(rawJoin.segment) || !finite(rawJoin.t)) return null;
        validated = { ...join, route: '3:4', segment: rawJoin.segment, t: rawJoin.t };
    } else {
        if (rawJoin.node !== '3-1') return null;
        validated = { ...join, node: '3-1' };
    }
    return bridgeJoinMatches(validated, metadata, world) ? { join: validated, landing, junctionToLanding: approach,
        approachBounds } : null;
}
function parseBridgeOverlay(value: unknown): JourneyBridgeOverlay | null {
    const data = object(value);
    if (!data || !asset(data.path, 'webp') || !integer(data.width) || !integer(data.height) ||
        data.width < 1 || data.height < 1 || data.width > 8192 || data.height > 8192 ||
        !finite(data.left) || !finite(data.top) || !positive(data.widthInMap) || !positive(data.heightInMap) ||
        Math.abs(data.widthInMap * 1920 - data.width) > .01 || Math.abs(data.heightInMap * 1200 - data.height) > .01) return null;
    return { path: data.path, width: data.width, height: data.height, left: data.left, top: data.top,
        widthInMap: data.widthInMap, heightInMap: data.heightInMap };
}
const matchingPlacement = (a: AtlasPlacement, b: AtlasPlacement) => positive(a.scale) && positive(b.scale) &&
    near(a.origin, b.origin) && a.scale === b.scale;

/** Factory placement comes from the approved composition, never from the request's
 * untrusted export. Both bridge states must agree with the same island snapshots.
 */
export function parseJourneyBridge(value: unknown, porto: MapArtMetadata, fabrica: MapArtMetadata,
    expectedPlacements: Readonly<Record<2 | 3, AtlasPlacement>>): JourneyBridge | null {
    const data = object(value), islands = object(data?.islands), placements = object(data?.placements);
    const route = object(data?.bridgeRoute), overlays = object(data?.overlays);
    const port = parseBridgeLanding(islands?.porto, porto, 2), factory = parseBridgeLanding(islands?.fabrica, fabrica, 3);
    const bridgeRoute = path(route?.points), duration = route?.durationSeconds;
    const open = parseBridgeOverlay(overlays?.open), closed = parseBridgeOverlay(overlays?.closed);
    if (data?.version !== 1 || data.connection !== PORT_FACTORY_BRIDGE_EDGE || route?.coordinateSystem !== 'atlas' ||
        !port || !factory || !bridgeRoute || !positive(duration) || duration > 120 || !open || !closed) return null;
    const normalized = {} as JourneyBridge['placements'];
    for (const [world, name] of [[2, 'porto'], [3, 'fabrica']] as const) {
        const placement = object(placements?.[name]), origin = point(placement?.origin), scale = placement?.scale;
        if (!origin || !positive(scale) || !expectedPlacements[world] ||
            !matchingPlacement({ origin, scale }, expectedPlacements[world])) return null;
        normalized[world] = { origin, scale };
    }
    if (!joined(bridgeRoute, localToAtlas(port.landing, normalized[2]), localToAtlas(factory.landing, normalized[3]))) return null;
    return { landings: { 2: port, 3: factory }, placements: normalized, bridgeRoute, bridgeDuration: duration, overlays: { open, closed } };
}

/** Convert normalized export anchors and checked atlas crops into painter frames. */
export function parseJourneyBoat(value: unknown): JourneyBoatMetadata | null {
    const data = object(value), atlas = object(data?.atlas), frame = object(data?.frame);
    if (data?.version !== 1 || !atlas || !asset(atlas.path, 'webp') || !integer(atlas.width) || !integer(atlas.height) ||
        atlas.width < 1 || atlas.height < 1 || atlas.width > 8192 || atlas.height > 8192 || !frame || !integer(frame.width) ||
        !integer(frame.height) || frame.width < 1 || frame.height < 1 || !positive(frame.widthInMap) ||
        !positive(data.passengerPixelScale) || data.passengerPixelScale > 16 || !Array.isArray(data.frames) || ![8, 32, 48, 64].includes(data.frames.length)) return null;
    const frames: JourneyBoatMetadata['frames'] = [];
    for (let index = 0; index < data.frames.length; index++) {
        const entry = object(data.frames[index]), rects = object(entry?.sourceRects), foot = point(entry?.passengerFoot), pixels = point(entry?.passengerFootPixels);
        const water = point(entry?.waterlineAnchor), waterPixels = point(entry?.waterlineAnchorPixels);
        if (!entry || entry.index !== index || !finite(entry.screenHeadingRadians) || !finite(entry.worldHeadingRadians) ||
            Math.abs(entry.worldHeadingRadians - index * Math.PI * 2 / data.frames.length) > 1e-5 ||
            !positive(entry.widthInMap) || Math.abs(entry.widthInMap - frame.widthInMap) > 1e-8 || !foot || !pixels ||
            foot.x < 0 || foot.x > 1 || foot.y < 0 || foot.y > 1 ||
            Math.abs(foot.x * frame.width - pixels.x) > .01 || Math.abs(foot.y * frame.height - pixels.y) > .01 ||
            !water || !waterPixels || water.x < 0 || water.x > 1 || water.y < 0 || water.y > 1 ||
            Math.abs(water.x * frame.width - waterPixels.x) > .01 || Math.abs(water.y * frame.height - waterPixels.y) > .01) return null;
        const crops: BoatAtlasFrame['rear'][] = [];
        for (const kind of ['base', 'foreground']) {
            const rect = object(rects?.[kind]);
            if (!rect || !integer(rect.x) || !integer(rect.y) || rect.width !== frame.width || rect.height !== frame.height ||
                rect.x + frame.width > atlas.width || rect.y + frame.height > atlas.height) return null;
            crops.push({ x: rect.x, y: rect.y, w: frame.width, h: frame.height });
        }
        frames.push({ index, screenHeadingRadians: entry.screenHeadingRadians, worldHeadingRadians: entry.worldHeadingRadians,
            width: frame.width, height: frame.height, widthInMap: entry.widthInMap, passengerFoot: pixels, waterlineAnchor: waterPixels,
            passengerPixelScale: data.passengerPixelScale, rear: crops[0], foreground: crops[1] });
    }
    const projection = object(data.headingProjection), xAxis = point(projection?.xAxis), yAxis = point(projection?.yAxis);
    const determinant = xAxis && yAxis ? xAxis.x * yAxis.y - xAxis.y * yAxis.x : NaN;
    if ((data.frames.length > 8 || data.headingProjection !== undefined) &&
        (!xAxis || !yAxis || !Number.isFinite(determinant) || Math.abs(determinant) < 1e-8)) return null;
    return { atlas: { path: atlas.path, width: atlas.width, height: atlas.height }, frames,
        ...(xAxis && yAxis ? { headingProjection: { xAxis, yAxis } } : {}) };
}

export const JOURNEY_DOCK_NODES = { 1: { join: '1-junction', dock: '1-dock', berth: '1-berth' },
    2: { join: '2-1', dock: '2-dock', berth: '2-berth' } } as const;

/** Each crossing is enabled independently against its matching image snapshots.
 * A missing bridge cannot change the shipped ferry graph. Its open state comes
 * from the controller's existing progression rules, never from art metadata.
 */
export function buildJourneyNetwork(options: { islands: readonly JourneyIsland[]; secrets: readonly string[];
    connection: JourneyConnection | null; connectionReady: boolean;
    bridge?: JourneyBridge | null; bridgeReady?: boolean; bridgeOpen?: boolean } & SerraJourneyOptions & ReservaJourneyOptions & DominioJourneyOptions): JourneyNetwork {
    const nodes: Record<string, MapPoint> = {}, edges: JourneyEdge[] = [];
    const coast = options.islands.find(island => island.world === 1), port = options.islands.find(island => island.world === 2);
    const connection = options.connectionReady && coast?.ready && port?.ready ? options.connection : null;
    const join = connection?.docks[1].join, localRoute = coast?.metadata.routes['2:3'];
    const segmentA = localRoute?.[join?.segment ?? -1], segmentB = localRoute?.[(join?.segment ?? -2) + 1];
    const crossing = connection && join && segmentA && segmentB && near(join,
        { x: segmentA.x + (segmentB.x - segmentA.x) * join.t!, y: segmentA.y + (segmentB.y - segmentA.y) * join.t! }) &&
        port?.metadata.nodes['2-1'] && near(connection.docks[2].join, port.metadata.nodes['2-1']) &&
        joined(connection.sailRoute, localToAtlas(connection.docks[1].berth.passenger, coast!.placement),
            localToAtlas(connection.docks[2].berth.passenger, port.placement)) ? connection : null;
    const factory = options.islands.find(island => island.world === 3);
    const readyBridge = options.bridgeReady && options.bridgeOpen && port?.ready && factory?.ready ? options.bridge : null;
    const bridge = readyBridge && bridgeJoinMatches(readyBridge.landings[2].join, port!.metadata, 2) &&
        bridgeJoinMatches(readyBridge.landings[3].join, factory!.metadata, 3) &&
        matchingPlacement(readyBridge.placements[2], port!.placement) && matchingPlacement(readyBridge.placements[3], factory!.placement) &&
        joined(readyBridge.bridgeRoute, localToAtlas(readyBridge.landings[2].landing, port!.placement),
            localToAtlas(readyBridge.landings[3].landing, factory!.placement)) ? readyBridge : null;
    const add = (id: string, from: string, to: string, points: MapPoint[], duration: number, mode: JourneyEdge['mode'] = 'walk') =>
        edges.push({ id, from, to, points, duration, mode });
    for (const island of options.islands) {
        const { world, metadata, placement } = island, transform = (point: MapPoint) => localToAtlas(point, placement);
        for (const [id, point] of Object.entries(metadata.nodes)) nodes[id] = transform(point);
        for (let n = 1; n < 5; n++) {
            const from = `${world}-${n}`, to = `${world}-${n + 1}`, authored = metadata.routes[`${n - 1}:${n}`];
            const points = authored ?? [metadata.nodes[from], metadata.nodes[to]];
            if (world === 1 && n === 3 && crossing) {
                const join = crossing.docks[1].join, segment = join.segment!;
                nodes['1-junction'] = transform(join);
                add('1-3:1-junction', from, '1-junction', [...points.slice(0, segment + 1), join].map(transform), .5);
                add('1-junction:1-4', '1-junction', to, [join, ...points.slice(segment + 1)].map(transform), .5);
            } else if (world === 2 && n === 4 && bridge) {
                const join = bridge.landings[2].join, segment = join.segment!, junction = BRIDGE_NODES[2].join;
                nodes[junction] = transform(join);
                add(`2-4:${junction}`, from, junction, [...points.slice(0, segment + 1), join].map(transform), .39);
                add(`${junction}:2-5`, junction, to, [join, ...points.slice(segment + 1)].map(transform), .39);
            } else add(`${from}:${to}`, from, to, points.map(transform), world === 4 || world === 5 || world === 6 ? metadata.routeDurationsSeconds?.[`${n - 1}:${n}`] ?? .78 : .78);
        }
        if (options.secrets.includes(`${world}-3`) && metadata.secretRoute.length > 1)
            add(`${world}-secret`, `${world}-3`, `${world}-5`, metadata.secretRoute.map(transform), world === 5 || world === 6 ? metadata.secretDurationSeconds ?? 1.1 : 1.1);
        if (crossing && (world === 1 || world === 2)) {
            const dock = crossing.docks[world], ids = JOURNEY_DOCK_NODES[world];
            nodes[ids.dock] = transform(dock.dock); nodes[ids.berth] = transform(dock.berth.passenger);
            add(`${world}-dock-approach`, ids.join, ids.dock, dock.junctionToDock.map(transform), 1.25);
            add(`${world}-board`, ids.dock, ids.berth, dock.boardingRoute.map(transform), .85, 'board');
        }
        if (bridge && (world === 2 || world === 3)) {
            const landing = bridge.landings[world], ids = BRIDGE_NODES[world];
            nodes[ids.landing] = transform(landing.landing);
            add(`${world}-bridge-approach`, ids.join, ids.landing, landing.junctionToLanding.map(transform), 1.25);
        }
    }
    if (crossing) add('coast-port-sail', '1-berth', '2-berth', crossing.sailRoute.map(point => ({ ...point })), crossing.sailDuration, 'sail');
    if (bridge) add(PORT_FACTORY_BRIDGE_EDGE, BRIDGE_NODES[2].landing, BRIDGE_NODES[3].landing,
        bridge.bridgeRoute.map(point => ({ ...point })), bridge.bridgeDuration);
    const serra = buildSerraJourney(options);
    Object.assign(nodes, serra.nodes); edges.push(...serra.edges);
    const reserva = buildReservaJourney(options);
    Object.assign(nodes, reserva.nodes); edges.push(...reserva.edges);
    const dominio = buildDominioJourney(options);
    Object.assign(nodes, dominio.nodes); edges.push(...dominio.edges);
    return { nodes, edges };
}
