import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localToAtlas, WORLD_ATLAS_PLACEMENTS } from '../src/adventure/WorldAtlasModel';
import { cableCarAt, cableEdgeDirections, createCablePair, updateCablePairAfterTravel } from '../src/adventure/WorldCableModel';
import { advanceJourney, canEnterJourney, createJourney, journeySaveSelection, selectJourney, skipJourney } from '../src/adventure/WorldJourneyModel';
import { buildJourneyNetwork, parseJourneyBridge, parseJourneyConnection, type JourneyIsland } from '../src/adventure/WorldJourneyNetwork';
import { fallbackMapMetadata, parseMapMetadata, type MapArtMetadata } from '../src/adventure/WorldMapArt';
import { FACTORY_SERRA_LINK_EDGE, SERRA_CABLE_PAIR, SERRA_CABLE_STATIONS, SERRA_LINK_NODES,
    buildSerraJourney, matchesSerraAssetSize, parseFactorySerraLink, parseSerraMaintenanceCable } from '../src/adventure/WorldSerraJourney';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
const coast = parseMapMetadata(read('costa-diorama'), 1)!;
const port = parseMapMetadata(read('porto-diorama'), 2)!;
const factory = parseMapMetadata(read('fabrica-diorama'), 3)!;
const placements = { 3: WORLD_ATLAS_PLACEMENTS[3], 4: { origin: { x: 2.78, y: -.65 }, scale: 1 } };
const ferry = parseJourneyConnection(read('coast-port-journey'), coast, port)!;
const bridge = parseJourneyBridge(read('port-factory-bridge'), port, factory, WORLD_ATLAS_PLACEMENTS)!;
const point = (x: number, y: number) => ({ x, y });

/** Synthetic Serra route and cabin coordinates, independent of final art. */
function fixture() {
    const serra: MapArtMetadata = { world: 4,
        nodes: { '4-1': point(.12, .6), '4-2': point(.24, .4), '4-3': point(.4, .65), '4-4': point(.7, .75), '4-5': point(.8, .3) },
        routes: {}, secretRoute: [], secretTransport: 'maintenance-cable',
        routeDurationsSeconds: { '0:1': 2, '1:2': 2.5, '2:3': 2.5, '3:4': 3 },
    };
    for (let n = 1; n <= 4; n++) serra.routes[`${n - 1}:${n}`] = [serra.nodes[`4-${n}`], serra.nodes[`4-${n + 1}`]];
    const fLanding = point(.9, .55), sLanding = point(.06, .6);
    const rawLink = { version: 1, connection: FACTORY_SERRA_LINK_EDGE,
        placements: { fabrica: placements[3], serra: placements[4] },
        islands: {
            fabrica: { version: 1, island: 'fabrica', size: { width: 1920, height: 1200 },
                join: { ...factory.nodes['3-5'], node: '3-5' }, landing: fLanding,
                approachDurationSeconds: 2.7,
                junctionToLanding: [factory.nodes['3-5'], point(.8, .52), fLanding],
                approachBounds: { left: .65, top: .45, right: .95, bottom: .6 } },
            serra: { version: 1, island: 'serra', size: { width: 1920, height: 1200 },
                join: { ...serra.nodes['4-1'], node: '4-1' }, landing: sLanding,
                approachDurationSeconds: .72,
                junctionToLanding: [serra.nodes['4-1'], sLanding],
                approachBounds: { left: .02, top: .55, right: .17, bottom: .65 } },
        },
        walkRoute: { coordinateSystem: 'atlas', durationSeconds: 6.2,
            points: [localToAtlas(fLanding, placements[3]), point(2.9, .2), localToAtlas(sLanding, placements[4])] },
        overlays: {
            open: { path: '/assets/world/map/synthetic-link-open.webp', width: 1920, height: 1440,
                left: 2.5, top: -.5, widthInMap: 1, heightInMap: 1.2 },
            closed: { path: '/assets/world/map/synthetic-link-closed.webp', width: 1920, height: 1440,
                left: 2.5, top: -.5, widthInMap: 1, heightInMap: 1.2 },
        },
    };
    const lower = point(.43, .58), upper = point(.75, .37);
    const berth = (platform: typeof lower, foot: typeof lower, seconds: number) => ({ foot,
        boardingRoute: [platform, foot], boardingDurationSeconds: seconds, aboardProgress: .65 });
    const rawCable = { version: 1, world: 4, coordinateSystem: 'island-local',
        stations: {
            lower: { stage: '4-3', platform: lower, stageToPlatform: [serra.nodes['4-3'], lower], approachDurationSeconds: .3 },
            upper: { stage: '4-5', platform: upper, stageToPlatform: [serra.nodes['4-5'], upper], approachDurationSeconds: .3 },
        },
        lanes: {
            a: { lower: berth(lower, point(.45, .55), .4), upper: berth(upper, point(.7, .33), .4),
                pathPoints: [point(.45, .55), point(.55, .45), point(.7, .33)] },
            b: { lower: berth(lower, point(.49, .61), .5), upper: berth(upper, point(.74, .39), .5),
                pathPoints: [point(.49, .61), point(.59, .51), point(.74, .39)] },
        },
        rideDurationSeconds: 1.5, paintOrder: ['a', 'b'],
        atlas: { path: '/assets/world/map/synthetic-cable.webp', width: 400, height: 200 },
        frame: { width: 200, height: 200, widthInMap: .14, passengerPixelScale: 3, passengerFoot: point(100, 150),
            rear: { x: 0, y: 0, w: 200, h: 200 }, foreground: { x: 200, y: 0, w: 200, h: 200 } },
    };
    const link = parseFactorySerraLink(rawLink, factory, serra, placements);
    const cable = parseSerraMaintenanceCable(rawCable, serra);
    assert.ok(link); assert.ok(cable);
    const islands: JourneyIsland[] = Array.from({ length: 6 }, (_, index) => ({ world: index + 1, ready: true,
        metadata: [coast, port, factory, serra][index] ?? fallbackMapMetadata(index + 1),
        placement: index === 3 ? placements[4] : WORLD_ATLAS_PLACEMENTS[index + 1] ?? { origin: point(0, 0), scale: 1 },
    }));
    const options = { islands, secrets: ['4-3'], connection: ferry, connectionReady: true, bridge, bridgeReady: true, bridgeOpen: true,
        factorySerraLink: link, factorySerraLinkReady: true, factorySerraLinkOpen: true,
        maintenanceCable: cable, maintenanceCableReady: true };
    const capabilities = { availableStages: islands.flatMap(island => Object.keys(island.metadata.nodes)) };
    return { serra, rawLink, rawCable, link, cable, islands, options, capabilities };
}

test('Serra parsers preserve checked geometry, shared ride timing, doorway thresholds and isolated source copies', () => {
    const f = fixture(), originals = structuredClone({ link: f.rawLink, cable: f.rawCable });
    assert.equal(f.link.landings[3].join.node, '3-5'); assert.equal(f.link.landings[4].join.node, '4-1');
    assert.deepEqual(f.link.walkRoute, f.rawLink.walkRoute.points);
    assert.equal(f.cable.rideDurationSeconds, 1.5); assert.equal(f.cable.lanes.b.upper.aboardProgress, .65);
    assert.deepEqual(f.cable.frame, f.rawCable.frame);
    f.link.landings[3].junctionToLanding[0].x += .01; f.cable.lanes.a.lower.boardingRoute[0].y += .01;
    assert.deepEqual({ link: f.rawLink, cable: f.rawCable }, originals);
});

test('supported-link parser rejects mismatched islands, joins, placements, routes, crops and durations', () => {
    const f = fixture();
    const mutations: Array<(raw: typeof f.rawLink) => void> = [
        raw => { raw.version = 2; }, raw => { raw.connection = 'other'; },
        raw => { raw.islands.fabrica.join.node = '3-4'; }, raw => { raw.islands.serra.join.node = '4-2'; },
        raw => { raw.islands.serra.join.x += .01; }, raw => { raw.islands.fabrica.size.width = 960; },
        raw => { raw.islands.serra.junctionToLanding[0].y += .1; }, raw => { raw.islands.fabrica.landing.x += .1; },
        raw => { raw.islands.serra.approachBounds.right = 0; }, raw => { raw.islands.fabrica.approachBounds.bottom = NaN; },
        raw => { raw.islands.fabrica.approachDurationSeconds = 0; }, raw => { raw.islands.serra.approachDurationSeconds = Infinity; },
        raw => { raw.placements.fabrica.origin.x += .1; }, raw => { raw.placements.serra.scale = 2; },
        raw => { raw.walkRoute.coordinateSystem = 'island-local'; }, raw => { raw.walkRoute.points[0].x += .01; },
        raw => { raw.walkRoute.points[1].y = Infinity; }, raw => { raw.walkRoute.durationSeconds = 0; },
        raw => { raw.walkRoute.durationSeconds = 121; }, raw => { raw.overlays.open.path = 'https://invalid.example/a.webp'; },
        raw => { raw.overlays.closed.path = '/assets/world/map/../a.webp'; }, raw => { raw.overlays.open.width += 1; },
        raw => { raw.overlays.closed.heightInMap = NaN; }, raw => { raw.overlays.open.width = 0; },
    ];
    for (const mutate of mutations) { const raw = structuredClone(f.rawLink); mutate(raw); assert.equal(parseFactorySerraLink(raw, factory, f.serra, placements), null); }
    assert.equal(parseFactorySerraLink(f.rawLink, port, f.serra, placements), null);
});

test('maintenance paint order requires each car exactly once and copies both physical orders', () => {
    const f = fixture();
    for (const paintOrder of [['a', 'b'], ['b', 'a']]) {
        const parsed = parseSerraMaintenanceCable({ ...f.rawCable, paintOrder }, f.serra);
        assert.ok(parsed); assert.deepEqual(parsed.paintOrder, paintOrder);
        paintOrder.reverse();
        assert.notDeepEqual(parsed.paintOrder, paintOrder, 'Parsed order must not alias the exporter input.');
    }
    for (const paintOrder of [undefined, null, 'ab', [], ['a'], ['a', 'a'], ['b', 'b'], ['a', 'c'], ['a', 'b', 'a'], { 0: 'a', 1: 'b', length: 2 }])
        assert.equal(parseSerraMaintenanceCable({ ...f.rawCable, paintOrder }, f.serra), null);
});

test('maintenance parser rejects incomplete stations, unsafe art, invalid footsteps, thresholds and inconsistent frame crops', () => {
    const f = fixture();
    const mutations: Array<(raw: typeof f.rawCable) => void> = [
        raw => { raw.version = 2; }, raw => { raw.world = 3; }, raw => { raw.coordinateSystem = 'atlas'; },
        raw => { raw.stations.lower.stage = '4-4'; }, raw => { raw.stations.upper.stageToPlatform[0].y += .01; },
        raw => { raw.stations.lower.platform.x = NaN; }, raw => { raw.stations.upper.approachDurationSeconds = -1; },
        raw => { raw.lanes.a.lower.boardingRoute = []; }, raw => { raw.lanes.b.upper.boardingRoute[0] = point(.76, .37); },
        raw => { raw.lanes.a.upper.foot.x += .1; }, raw => { raw.lanes.b.pathPoints.reverse(); },
        raw => { raw.lanes.a.pathPoints[1].x = 1.01; }, raw => { raw.lanes.b.upper.boardingDurationSeconds = 0; },
        raw => { raw.lanes.a.lower.aboardProgress = -.1; }, raw => { raw.lanes.b.upper.aboardProgress = 1.1; },
        raw => { raw.lanes.a.upper.aboardProgress = NaN; }, raw => { raw.rideDurationSeconds = Infinity; },
        raw => { raw.rideDurationSeconds = 121; }, raw => { raw.atlas.path = '//invalid.example/cabin.webp'; },
        raw => { raw.atlas.path = '/assets/world/map/../cabin.webp'; }, raw => { raw.atlas.width = 8193; },
        raw => { raw.atlas.height = 100; }, raw => { raw.frame.foreground.x += 1; }, raw => { raw.frame.rear.w -= 1; },
        raw => { raw.frame.passengerFoot.y = 201; }, raw => { raw.frame.passengerPixelScale = 0; },
        raw => { raw.frame.widthInMap = 2; },
    ];
    for (const mutate of mutations) { const raw = structuredClone(f.rawCable); mutate(raw); assert.equal(parseSerraMaintenanceCable(raw, f.serra), null); }
    assert.equal(parseSerraMaintenanceCable(f.rawCable, { ...f.serra, secretTransport: undefined }), null);
    assert.equal(parseSerraMaintenanceCable(f.rawCable, { ...f.serra, secretRoute: [point(.4, .65), point(.8, .3)] }), null);
    assert.equal(parseSerraMaintenanceCable(f.rawCable, factory), null);
});

test('asset readiness requires exact bitmap dimensions independently for each link state and cabin atlas', () => {
    const f = fixture();
    for (const expected of [f.link.overlays.open, f.link.overlays.closed, f.cable.atlas]) {
        assert.equal(matchesSerraAssetSize(null, expected), false);
        assert.equal(matchesSerraAssetSize({ naturalWidth: expected.width, naturalHeight: expected.height }, expected), true);
        assert.equal(matchesSerraAssetSize({ naturalWidth: expected.width / 2, naturalHeight: expected.height }, expected), false);
        assert.equal(matchesSerraAssetSize({ naturalWidth: expected.width, naturalHeight: expected.height + 1 }, expected), false);
    }
});

test('authored link approach timings are required and honored without an implicit fallback pace', () => {
    const f = fixture(), additions = buildSerraJourney(f.options);
    assert.equal(additions.edges.find(edge => edge.id === SERRA_LINK_NODES[3].approach)!.duration, 2.7);
    assert.equal(additions.edges.find(edge => edge.id === SERRA_LINK_NODES[4].approach)!.duration, .72);
    Reflect.deleteProperty(f.rawLink.islands.fabrica, 'approachDurationSeconds');
    assert.equal(parseFactorySerraLink(f.rawLink, factory, f.serra, placements), null);
});

test('both shipped Factory–Serra overlay bitmaps match their native-resolution declared dimensions', () => {
    const raw = read('factory-serra-link');
    for (const state of ['open', 'closed']) {
        const overlay = raw.overlays[state];
        assert.match(overlay.path, /^\/assets\/world\/map\/factory-serra-link-(open|closed)\.webp$/);
        const bytes = readFileSync(new URL(`../public${overlay.path}`, import.meta.url));
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
        assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
        assert.ok(bytes[20] & 0x10, 'The link layers retain alpha for the continuous atlas.');
        assert.equal(matchesSerraAssetSize({ naturalWidth: 1 + bytes.readUIntLE(24, 3), naturalHeight: 1 + bytes.readUIntLE(27, 3) }, overlay), true);
        assert.ok(Math.abs(overlay.widthInMap * 1920 - overlay.width) < .01);
        assert.ok(Math.abs(overlay.heightInMap * 1200 - overlay.height) < .01);
    }
});

test('unready, closed or stale Factory–Serra links leave the entire released graph unchanged', () => {
    const f = fixture(), base = { ...f.options, maintenanceCableReady: false };
    const cases = [
        { ...base, factorySerraLink: null }, { ...base, factorySerraLinkReady: false }, { ...base, factorySerraLinkOpen: false },
        { ...base, islands: f.islands.map(island => ({ ...island, ready: island.world !== 4 })) },
        { ...base, islands: f.islands.map(island => island.world === 4 ? { ...island, placement: { origin: point(4, 1), scale: 1 } } : island) },
        { ...base, islands: f.islands.map(island => island.world === 3 ? { ...island, metadata: fallbackMapMetadata(3) } : island) },
        { ...base, islands: f.islands.map(island => island.world === 4 ? { ...island, metadata: { ...f.serra, world: 3 } } : island) },
    ];
    for (const options of cases) {
        const baseline = buildJourneyNetwork({ ...options, factorySerraLink: null });
        assert.deepEqual(buildJourneyNetwork(options), baseline);
        assert.equal(baseline.edges.filter(edge => edge.id === 'coast-port-sail').length, 1);
    }
});

test('missing or undiscovered cabin leaves the supported Serra paths and independent Factory connection intact', () => {
    const f = fixture();
    const cases = [{ ...f.options, maintenanceCable: null }, { ...f.options, maintenanceCableReady: false }, { ...f.options, secrets: [] },
        { ...f.options, islands: f.islands.map(island => island.world === 4 ? { ...island, metadata: { ...f.serra,
            nodes: { ...f.serra.nodes, '4-3': point(.41, .65) } } } : island) }];
    for (const options of cases) {
        const graph = buildJourneyNetwork(options);
        assert.ok(graph.edges.some(edge => edge.id === FACTORY_SERRA_LINK_EDGE));
        assert.ok(!graph.edges.some(edge => edge.mode === 'cable' || edge.mode === 'cable-board' || edge.id === '4-secret'));
        assert.deepEqual(graph.edges.filter(edge => /^4-[1-5]:4-[1-5]$/.test(edge.id)).map(edge => edge.duration), [2, 2.5, 2.5, 3]);
        assert.equal(advanceJourney(selectJourney(createJourney('4-3', graph, f.capabilities), '4-5', graph, f.capabilities), 100).arrived, '4-5');
    }
    const noLink = buildJourneyNetwork({ ...f.options, factorySerraLinkReady: false, bridgeReady: false, connectionReady: false });
    assert.equal(noLink.edges.filter(edge => edge.mode === 'cable').length, 2, 'Cabins depend on Serra, not any inter-region transport.');
});

test('Serra additions preserve all prior edge geometry and create only two platform nodes and four distinct cable berths', () => {
    const f = fixture(), original = structuredClone(f.options);
    const baseline = buildJourneyNetwork({ ...f.options, factorySerraLink: null, maintenanceCable: null });
    const graph = buildJourneyNetwork(f.options), additions = buildSerraJourney(f.options);
    assert.deepEqual(graph.edges.slice(0, baseline.edges.length), baseline.edges);
    for (const [id, point] of Object.entries(baseline.nodes)) assert.deepEqual(graph.nodes[id], point);
    assert.equal(Object.keys(additions.nodes).length, 8, 'Two link landings plus two platforms and four berths.');
    assert.equal(additions.edges.length, 11, 'Three supported-link legs and eight cable/approach legs.');
    assert.equal(graph.edges.filter(edge => edge.mode === 'sail').length, 1);
    assert.equal(graph.edges.filter(edge => edge.mode === 'board').length, 2);
    assert.equal(graph.edges.filter(edge => edge.mode === 'cable').length, 2);
    assert.equal(graph.edges.filter(edge => edge.mode === 'cable-board').length, 4);
    assert.equal(new Set(graph.edges.map(edge => edge.id)).size, graph.edges.length);
    assert.deepEqual(f.options, original);
    assert.equal(graph.edges.find(edge => edge.id === SERRA_CABLE_PAIR.lanes.a.rideEdge)!.duration,
        graph.edges.find(edge => edge.id === SERRA_CABLE_PAIR.lanes.b.rideEdge)!.duration);
    assert.deepEqual(graph.nodes[SERRA_CABLE_STATIONS.lower.platform], localToAtlas(f.cable.stations.lower.platform, placements[4]));
});

test('mixed Costa→Serra travel uses the existing ferry/bridge and new walk link, without intermediate saved arrivals', () => {
    const f = fixture(), graph = buildJourneyNetwork(f.options), cap = { ...f.capabilities,
        edgeDirections: cableEdgeDirections(createCablePair(), SERRA_CABLE_PAIR, true) };
    let state = selectJourney(createJourney('1-5', graph, cap), '4-1', graph, cap);
    const ids = state.legs.map(leg => leg.id);
    assert.ok(ids.indexOf('coast-port-sail') < ids.indexOf('port-factory-bridge'));
    assert.ok(ids.indexOf('port-factory-bridge') < ids.indexOf(FACTORY_SERRA_LINK_EDGE));
    const newLink = state.legs.findIndex(leg => leg.id === FACTORY_SERRA_LINK_EDGE);
    state = advanceJourney(state, state.legs.slice(0, newLink).reduce((sum, leg) => sum + leg.duration, 0) + 2);
    assert.equal(state.legs[0].id, FACTORY_SERRA_LINK_EDGE); assert.equal(journeySaveSelection(state), '1-5');
    assert.equal(canEnterJourney(state, cap), false);
    const feet = state.point; state = selectJourney(state, '3-5', graph, cap);
    assert.deepEqual(state.point, feet); assert.equal(state.legs[0].direction, -1);
    assert.equal(skipJourney(state).arrived, '3-5');
    const reverse = selectJourney(createJourney('4-1', graph, cap), '1-1', graph, cap);
    assert.equal(reverse.legs.find(leg => leg.id === FACTORY_SERRA_LINK_EDGE)!.direction, -1);
    assert.equal(advanceJourney(reverse, 100).arrived, '1-1');
});

test('both pair phases and directions choose the discovered cabin through valid destination disembark edges', () => {
    const f = fixture(), graph = buildJourneyNetwork(f.options);
    for (const aAt of ['lower', 'upper'] as const) for (const from of ['4-3', '4-5']) {
        const pair = { aAt }, cap = { ...f.capabilities, edgeDirections: cableEdgeDirections(pair, SERRA_CABLE_PAIR, true) };
        const to = from === '4-3' ? '4-5' : '4-3', trip = selectJourney(createJourney(from, graph, cap), to, graph, cap);
        assert.equal(trip.blocked, null);
        assert.equal(trip.legs.filter(leg => leg.mode === 'cable').length, 1);
        assert.equal(trip.legs.filter(leg => leg.mode === 'cable-board').length, 2);
        assert.equal(trip.legs.filter(leg => leg.mode === 'cable-board').at(-1)!.direction, -1);
        assert.ok(trip.legs.reduce((sum, leg) => sum + leg.duration, 0) < 5.5);
        const after = skipJourney(trip), settled = updateCablePairAfterTravel(pair, SERRA_CABLE_PAIR, trip, after);
        assert.notEqual(settled.aAt, pair.aAt); assert.equal(after.arrived, to); assert.equal(after.entered, null);
    }
});

function shipped() {
    const f = fixture(), serra = parseMapMetadata(read('serra-diorama'), 4);
    assert.ok(serra, 'The shipped Serra camera needs all five supported routes and the explicit cable discriminator.');
    const cable = parseSerraMaintenanceCable(read('serra-maintenance-cable'), serra);
    const link = parseFactorySerraLink(read('factory-serra-link'), factory, serra, placements);
    assert.ok(cable, 'The real stations, lane feet, doorway thresholds and atlas must form one valid cabin contract.');
    assert.ok(link, 'The real supported link must join the released Factory and accepted Serra anchors.');
    const options = { ...f.options, islands: f.islands.map(island => island.world === 4 ? { ...island, metadata: serra } : island),
        factorySerraLink: link, maintenanceCable: cable };
    return { ...f, options, serra, cable, link, graph: buildJourneyNetwork(options) };
}

test('shipped Serra contracts preserve the accepted placement, exact lane feet and Feka pixel scale', () => {
    const f = shipped();
    assert.deepEqual(f.cable.paintOrder, ['a', 'b'], 'The authored A lane remains physically behind B throughout travel.');
    assert.deepEqual(f.link.placements[3], WORLD_ATLAS_PLACEMENTS[3]);
    assert.deepEqual(f.link.placements[4], WORLD_ATLAS_PLACEMENTS[4]);
    const boat = read('journey-boat'), cablePixel = f.cable.frame.widthInMap * f.cable.frame.passengerPixelScale / f.cable.frame.width;
    const boatPixel = boat.frame.widthInMap * boat.passengerPixelScale / boat.frame.width;
    assert.ok(Math.abs(cablePixel - boatPixel) < 1e-9, 'Boarding must not resize the original Feka sprite.');
    for (const car of ['a', 'b'] as const) for (const terminal of ['lower', 'upper'] as const) {
        const lane = f.cable.lanes[car], berth = lane[terminal], ids = SERRA_CABLE_PAIR.lanes[car];
        assert.deepEqual(f.graph.nodes[ids.berths[terminal]], localToAtlas(berth.foot, placements[4]));
        assert.ok(berth.aboardProgress > 0 && berth.aboardProgress < 1);
        assert.equal(berth.aboardProgress, read('serra-maintenance-cable').lanes[car][terminal].aboardProgress);
    }
    for (const expected of [f.cable.atlas, { path: '/assets/world/map/serra-diorama.webp', width: 1920, height: 1200 }]) {
        const bytes = readFileSync(new URL(`../public${expected.path}`, import.meta.url));
        assert.equal(bytes.toString('ascii', 12, 16), 'VP8X'); assert.ok(bytes[20] & 0x10);
        assert.equal(matchesSerraAssetSize({ naturalWidth: 1 + bytes.readUIntLE(24, 3), naturalHeight: 1 + bytes.readUIntLE(27, 3) }, expected), true);
    }
});

test('real authored cabin timing naturally beats the supported detour for both cars in either direction', () => {
    const f = shipped(), main = ['4-3:4-4', '4-4:4-5'].reduce((sum, id) => sum + f.graph.edges.find(edge => edge.id === id)!.duration, 0);
    for (const aAt of ['lower', 'upper'] as const) for (const from of ['4-3', '4-5']) {
        const pair = { aAt }, terminal = from === '4-3' ? 'lower' : 'upper', to = from === '4-3' ? '4-5' : '4-3';
        const cap = { ...f.capabilities, edgeDirections: cableEdgeDirections(pair, SERRA_CABLE_PAIR, true) };
        const trip = selectJourney(createJourney(from, f.graph, cap), to, f.graph, cap), car = cableCarAt(pair, terminal);
        const rides = trip.legs.filter(leg => leg.mode === 'cable');
        assert.deepEqual(rides.map(leg => leg.id), [SERRA_CABLE_PAIR.lanes[car].rideEdge]);
        assert.equal(rides[0].duration, f.cable.rideDurationSeconds);
        assert.ok(trip.legs.reduce((sum, leg) => sum + leg.duration, 0) < main, `${car} must be a real time-saving shortcut.`);
        const finished = advanceJourney(trip, 100);
        assert.equal(finished.arrived, to); assert.equal(finished.entered, null);
        assert.notEqual(updateCablePairAfterTravel(pair, SERRA_CABLE_PAIR, trip, finished).aAt, pair.aAt);
    }
});

test('the shipped Costa→Serra graph uses each released crossing once and never fabricates a walking cable', () => {
    const f = shipped(), cap = { ...f.capabilities, edgeDirections: cableEdgeDirections(createCablePair(), SERRA_CABLE_PAIR, true) };
    const trip = selectJourney(createJourney('1-5', f.graph, cap), '4-5', f.graph, cap);
    for (const id of ['coast-port-sail', 'port-factory-bridge', FACTORY_SERRA_LINK_EDGE])
        assert.equal(trip.legs.filter(leg => leg.id === id).length, 1);
    assert.equal(trip.legs.filter(leg => leg.mode === 'cable').length, 1);
    assert.equal(f.graph.edges.some(edge => edge.id === '4-secret'), false);
    assert.equal(journeySaveSelection(trip), '1-5');
    assert.equal(skipJourney(trip).arrived, '4-5');
});
