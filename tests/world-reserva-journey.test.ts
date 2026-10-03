import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localToAtlas, WORLD_ATLAS_PLACEMENTS } from '../src/adventure/WorldAtlasModel';
import { cableEdgeDirections, createCablePair } from '../src/adventure/WorldCableModel';
import { advanceJourney, canEnterJourney, createJourney, enterJourney, selectJourney } from '../src/adventure/WorldJourneyModel';
import { buildJourneyNetwork, parseJourneyBridge, parseJourneyConnection, type JourneyIsland } from '../src/adventure/WorldJourneyNetwork';
import { fallbackMapMetadata, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { samplePath } from '../src/adventure/WorldMapModel';
import { buildReservaJourney, matchesReservaAssetSize, parseReservaPassengerCable,
    PASSENGER_CABLE_PAIR, PASSENGER_CABLE_STATIONS, RESERVA_PASSENGER_CONNECTION } from '../src/adventure/WorldReservaJourney';
import { parseFactorySerraLink, parseSerraMaintenanceCable, SERRA_CABLE_PAIR } from '../src/adventure/WorldSerraJourney';
import { freshSave, isUnlocked } from '../src/adventure/progress';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
const coast = parseMapMetadata(read('costa-diorama'), 1)!, port = parseMapMetadata(read('porto-diorama'), 2)!;
const factory = parseMapMetadata(read('fabrica-diorama'), 3)!, serra = parseMapMetadata(read('serra-diorama'), 4)!;
const placements = { 4: WORLD_ATLAS_PLACEMENTS[4], 5: { origin: { x: 2.7, y: -1.8 }, scale: 1 } };
const point = (x: number, y: number) => ({ x, y });
const rectangle = (left: number, top: number, right: number, bottom: number) =>
    [point(left, top), point(right, top), point(right, bottom), point(left, bottom)];

/** Deliberately synthetic supports/berths: these tests do not approve final art. */
function fixture() {
    const reserva = fallbackMapMetadata(5);
    reserva.nodes['5-1'] = point(.664306, .776122);
    reserva.routes['0:1'] = [reserva.nodes['5-1'], reserva.nodes['5-2']];
    reserva.routeDurationsSeconds = { '0:1': 2.6, '1:2': 3.2, '2:3': 2.1, '3:4': 2.8 };
    reserva.secretRoute = [reserva.nodes['5-3'], reserva.nodes['5-5']]; reserva.secretDurationSeconds = 4.6;
    const station = (world: 4 | 5, stage: string, platform: ReturnType<typeof point>) => ({ world, stage, platform,
        stageToPlatform: [(world === 4 ? serra : reserva).nodes[stage], platform], approachDurationSeconds: world === 4 ? 2.8 : .7,
        support: { bounds: { left: .3, top: .2, right: 1.2, bottom: .9 }, polygons: [rectangle(.3, .2, 1.2, .9)] },
        artBounds: { left: .2, top: .1, right: 1.3, bottom: 1 },
    });
    // The outboard Serra platform demonstrates that island-local is a coordinate
    // system, not an instruction to clamp additions to the old bitmap rectangle.
    const lower = station(4, '4-5', point(1.05, .35)), upper = station(5, '5-1', point(.73, .74));
    const berth = (platform: ReturnType<typeof point>, foot: ReturnType<typeof point>, boardingDurationSeconds: number) => {
        const boardingRoute = [platform, point(platform.x, foot.y), foot], aboardProgress = .65;
        return { foot, boardingRoute, boardingDurationSeconds, aboardProgress, doorway: samplePath(boardingRoute, aboardProgress) };
    };
    const lane = (offset: number) => {
        const from = berth(lower.platform, point(1.10, .32 + offset), .6), to = berth(upper.platform, point(.79, .70 + offset), .8);
        return { lower: from, upper: to, pathPoints: [localToAtlas(from.foot, placements[4]), point(3.7, -.6 + offset), localToAtlas(to.foot, placements[5])] };
    };
    const lanes = { a: lane(0), b: lane(.045) };
    const raw = { version: 1, connection: RESERVA_PASSENGER_CONNECTION, coordinateSystem: 'atlas',
        placements: { serra: placements[4], reserva: placements[5] }, stations: { lower, upper },
        lanes, rideDurationSeconds: 8.3, paintOrder: ['b', 'a'],
        cablePolylines: Object.values(lanes).map(lane => lane.pathPoints.map(p => point(p.x + .01, p.y - .14))),
        atlas: { path: '/assets/world/map/synthetic-passenger.webp', width: 400, height: 300 },
        frame: { width: 200, height: 300, widthInMap: 200 / 1920, passengerFoot: point(100, 240),
            passengerPixelScale: (4.15 / 20.6) * 3 / 384 * 1920,
            rear: { x: 0, y: 0, w: 200, h: 300 }, foreground: { x: 200, y: 0, w: 200, h: 300 } },
        overlays: [{ path: '/assets/world/map/synthetic-passenger-support.webp', width: 576, height: 480,
            left: 3.6, top: -.5, widthInMap: .3, heightInMap: .4 }],
    };
    const cable = parseReservaPassengerCable(raw, serra, reserva, placements)!; assert.ok(cable);
    const islands: JourneyIsland[] = [coast, port, factory, serra, reserva, fallbackMapMetadata(6)].map((metadata, i) => ({
        world: i + 1, metadata, ready: true, placement: i === 4 ? placements[5] : WORLD_ATLAS_PLACEMENTS[i + 1] ?? { origin: point(0, 0), scale: 1 },
    }));
    const options = { islands, secrets: ['4-3'],
        connection: parseJourneyConnection(read('coast-port-journey'), coast, port), connectionReady: true,
        bridge: parseJourneyBridge(read('port-factory-bridge'), port, factory, WORLD_ATLAS_PLACEMENTS), bridgeReady: true, bridgeOpen: true,
        factorySerraLink: parseFactorySerraLink(read('factory-serra-link'), factory, serra, WORLD_ATLAS_PLACEMENTS),
        factorySerraLinkReady: true, factorySerraLinkOpen: true,
        maintenanceCable: parseSerraMaintenanceCable(read('serra-maintenance-cable'), serra), maintenanceCableReady: true,
        passengerCable: cable, passengerCableReady: true, passengerCableOpen: true,
    };
    return { raw, cable, reserva, islands, options };
}

test('passenger parser preserves atlas rides, measured doors, native Feka scale and independent copies', () => {
    const f = fixture(), before = structuredClone(f.raw);
    assert.equal(f.cable.stations.lower.world, 4); assert.equal(f.cable.stations.upper.world, 5);
    assert.equal(f.cable.stations.lower.platform.x, 1.05);
    assert.deepEqual(f.cable.lanes.a.pathPoints, f.raw.lanes.a.pathPoints);
    assert.deepEqual(f.cable.paintOrder, ['b', 'a']); assert.deepEqual(f.cable.frame, f.raw.frame);
    assert.deepEqual(f.cable.cablePolylines, f.raw.cablePolylines);
    assert.deepEqual(f.cable.lanes.b.upper.doorway, samplePath(f.cable.lanes.b.upper.boardingRoute, .65));
    f.cable.stations.lower.stageToPlatform[0].x += .01; f.cable.lanes.a.lower.boardingRoute[0].y += .01;
    f.cable.stations.upper.support.polygons[0][0].x += .1; f.cable.placements[4].origin.x += .1;
    f.cable.overlays[0].left += .1; f.cable.lanes.b.pathPoints[0].x += .1;
    f.cable.cablePolylines[0][0].y += .1;
    assert.deepEqual(f.raw, before);
});

test('passenger parser rejects mismatched snapshots, placements, anchors, foot paths and durations', () => {
    const f = fixture();
    const mutations: Array<(raw: typeof f.raw) => void> = [
        raw => { raw.version = 2; }, raw => { raw.connection = 'other'; }, raw => { raw.coordinateSystem = 'island-local'; },
        raw => { raw.placements.serra.origin.x += .01; }, raw => { raw.placements.reserva.scale = 2; },
        raw => { raw.stations.lower.world = 5; }, raw => { raw.stations.upper.stage = '5-2'; },
        raw => { raw.stations.lower.stageToPlatform[0].x += .01; }, raw => { raw.stations.upper.platform.x += .01; },
        raw => { raw.stations.lower.stageToPlatform = []; }, raw => { raw.stations.upper.approachDurationSeconds = 0; },
        raw => { raw.stations.lower.artBounds.top = .3; }, raw => { raw.stations.upper.artBounds.right = .78; },
        raw => { raw.stations.upper.artBounds.left = Infinity; },
        raw => { raw.lanes.a.lower.foot.y += .01; }, raw => { raw.lanes.b.upper.boardingRoute[0].x += .01; },
        raw => { raw.lanes.a.pathPoints.reverse(); }, raw => { raw.lanes.b.pathPoints[0].x += .01; },
        raw => { raw.lanes.a.pathPoints[1].y = Infinity; }, raw => { raw.lanes.b.upper.boardingDurationSeconds = -1; },
        raw => { raw.lanes.b = structuredClone(raw.lanes.a); }, raw => { raw.rideDurationSeconds = 0; },
        raw => { raw.rideDurationSeconds = 121; }, raw => { raw.rideDurationSeconds = NaN; },
        raw => { raw.lanes.a.pathPoints = Array.from({ length: 513 }, () => point(0, 0)); },
    ];
    for (const mutate of mutations) {
        const raw = structuredClone(f.raw); mutate(raw);
        assert.equal(parseReservaPassengerCable(raw, serra, f.reserva, placements), null, mutate.toString());
    }
    for (const bad of [null, [], {}, undefined]) assert.equal(parseReservaPassengerCable(bad, serra, f.reserva, placements), null);
    assert.equal(parseReservaPassengerCable(f.raw, factory, f.reserva, placements), null);
    assert.equal(parseReservaPassengerCable(f.raw, serra, { ...f.reserva, world: 4 }, placements), null);
    assert.equal(parseReservaPassengerCable(f.raw, serra, { ...f.reserva, nodes: { ...f.reserva.nodes, '5-1': point(.6, .7) } }, placements), null);
});

test('support polygons cover complete local walks and reject an unsupported gap between valid endpoints', () => {
    const f = fixture(), parse = () => parseReservaPassengerCable(f.raw, serra, f.reserva, placements);
    f.raw.stations.lower.support.polygons = [rectangle(.3, .2, .85, .9), rectangle(.9, .2, 1.2, .9)];
    assert.equal(parse(), null, 'An approach crosses the gap although its two endpoints are supported.');
    f.raw.stations.lower.support.polygons[0] = rectangle(.3, .2, .9, .9);
    assert.ok(parse(), 'Touching convex supports form a continuous walk.');
    f.raw.stations.lower.support.polygons[1].reverse(); assert.ok(parse(), 'Either polygon winding is accepted.');
    f.raw.stations.lower.support.polygons = [[point(.3, .2), point(1.2, .2), point(.5, .4), point(1.2, .9), point(.3, .9)]];
    assert.equal(parse(), null, 'Concave exports need an explicit convex decomposition.');
    f.raw.stations.lower.support.polygons = [[point(.3, .2), point(1.2, .9), point(1.2, .2), point(.3, .9)]];
    assert.equal(parse(), null);
    f.raw.stations.lower.support.polygons = []; assert.equal(parse(), null);
    f.raw.stations.lower.support.polygons = [rectangle(.3, .2, 1.2, .9)];
    f.raw.stations.lower.support.bounds.right = 1; assert.equal(parse(), null);
    f.raw.stations.lower.support.bounds.right = Infinity; assert.equal(parse(), null);
});

test('doorway thresholds must match the actual platform→foot route using the map distance metric', () => {
    const f = fixture();
    for (const terminal of ['lower', 'upper'] as const) for (const car of ['a', 'b'] as const) {
        for (const aboardProgress of [-.01, 1.01, NaN, .2]) {
            const raw = structuredClone(f.raw); raw.lanes[car][terminal].aboardProgress = aboardProgress;
            assert.equal(parseReservaPassengerCable(raw, serra, f.reserva, placements), null);
        }
        const raw = structuredClone(f.raw); raw.lanes[car][terminal].doorway.x += .001;
        assert.equal(parseReservaPassengerCable(raw, serra, f.reserva, placements), null);
    }
});

test('vector span cables retain a fixed projected grip above each corresponding ride foot', () => {
    const f = fixture();
    const mutations: Array<(raw: typeof f.raw) => void> = [
        raw => { raw.cablePolylines.pop(); }, raw => { raw.cablePolylines[0].pop(); },
        raw => { raw.cablePolylines[1].reverse(); }, raw => { raw.cablePolylines[0][1].y += .01; },
        raw => { raw.cablePolylines[0][0].x = NaN; },
        raw => { raw.cablePolylines[1] = raw.cablePolylines[1].map(p => point(p.x + .001, p.y)); },
        raw => { raw.cablePolylines = Object.values(raw.lanes).map(lane => lane.pathPoints.map(p => point(p.x, p.y + .1))); },
        raw => { raw.cablePolylines = Object.values(raw.lanes).map(lane => lane.pathPoints.map(p => point(p.x, p.y - 1))); },
    ];
    for (const mutate of mutations) {
        const raw = structuredClone(f.raw); mutate(raw);
        assert.equal(parseReservaPassengerCable(raw, serra, f.reserva, placements), null, mutate.toString());
    }
    assert.deepEqual(parseReservaPassengerCable({ ...f.raw, cablePolylines: undefined }, serra, f.reserva, placements)!.cablePolylines, []);
});

test('cabin crops, source-pixel ratio, ordered lanes and native overlay dimensions are required', () => {
    const f = fixture();
    const mutations: Array<(raw: typeof f.raw) => void> = [
        raw => { raw.atlas.path = 'https://invalid.example/cabin.webp'; }, raw => { raw.atlas.path = '/assets/world/map/../cabin.webp'; },
        raw => { raw.atlas.width = 8193; }, raw => { raw.atlas.height = 0; }, raw => { raw.frame.width = 200.5; },
        raw => { raw.frame.foreground.x++; }, raw => { raw.frame.foreground.x = 100; }, raw => { raw.frame.rear.w--; },
        raw => { raw.frame.passengerFoot.y = 301; }, raw => { raw.frame.passengerPixelScale *= .9; },
        raw => { raw.frame.widthInMap = NaN; }, raw => { raw.paintOrder = ['a', 'a']; }, raw => { raw.paintOrder = ['b']; },
        raw => { raw.overlays[0].width++; }, raw => { raw.overlays[0].heightInMap *= 2; },
        raw => { raw.overlays[0].path = '/assets/world/map/../support.webp'; }, raw => { raw.overlays[0].left = NaN; },
    ];
    for (const mutate of mutations) {
        const raw = structuredClone(f.raw); mutate(raw);
        assert.equal(parseReservaPassengerCable(raw, serra, f.reserva, placements), null, mutate.toString());
    }
    const raw = structuredClone(f.raw);
    raw.atlas.width *= 2; raw.atlas.height *= 2; raw.frame.width *= 2; raw.frame.height *= 2;
    raw.frame.passengerFoot.x *= 2; raw.frame.passengerFoot.y *= 2; raw.frame.passengerPixelScale *= 2;
    for (const crop of [raw.frame.rear, raw.frame.foreground]) { crop.x *= 2; crop.y *= 2; crop.w *= 2; crop.h *= 2; }
    assert.ok(parseReservaPassengerCable(raw, serra, f.reserva, placements), 'Supersampling preserves the original Feka size.');
    for (const expected of [f.cable.atlas, ...f.cable.overlays]) {
        assert.equal(matchesReservaAssetSize(null, expected), false);
        assert.equal(matchesReservaAssetSize({ naturalWidth: expected.width, naturalHeight: expected.height }, expected), true);
        assert.equal(matchesReservaAssetSize({ naturalWidth: expected.width, naturalHeight: expected.height + 1 }, expected), false);
    }
});

test('absent, failed, late, closed or stale passenger assets leave the full released graph intact', () => {
    const f = fixture();
    const cases = [
        { ...f.options, passengerCable: null }, { ...f.options, passengerCableReady: false }, { ...f.options, passengerCableOpen: false },
        ...([4, 5] as const).flatMap(world => [
            { ...f.options, islands: f.islands.map(island => island.world === world ? { ...island, ready: false } : island) },
            { ...f.options, islands: f.islands.map(island => island.world === world ? { ...island, placement: { origin: point(9, 9), scale: 1 } } : island) },
            { ...f.options, islands: f.islands.map(island => island.world === world ? { ...island, metadata: fallbackMapMetadata(world) } : island) },
        ]),
    ];
    for (const options of cases) assert.deepEqual(buildJourneyNetwork(options), buildJourneyNetwork({ ...options, passengerCable: null }));
    const late = buildJourneyNetwork({ ...f.options, passengerCableReady: false });
    assert.deepEqual(late, buildJourneyNetwork({ ...f.options, passengerCable: null }));
    const ready = buildJourneyNetwork(f.options);
    assert.deepEqual(ready.edges.slice(0, late.edges.length), late.edges);
    assert.equal(ready.edges.length, late.edges.length + 8);
});

test('small gate overlays explicitly declare open or closed while common layers omit the condition', () => {
    const f = fixture(), parse = (overlays: unknown) => parseReservaPassengerCable({ ...f.raw, overlays }, serra, f.reserva, placements);
    for (const when of ['open', 'closed'] as const) {
        const overlays = [{ ...f.raw.overlays[0], when }], cable = parse(overlays);
        assert.ok(cable); assert.equal(cable.overlays[0].when, when);
    }
    assert.equal(parse(f.raw.overlays)!.overlays[0].when, undefined);
    assert.deepEqual(parse(undefined)!.overlays, []);
    for (const when of ['locked', true, null, 0]) assert.equal(parse([{ ...f.raw.overlays[0], when }]), null);
    assert.equal(parse(null), null);
    assert.equal(parse(Array.from({ length: 17 }, () => f.raw.overlays[0])), null);
});

test('passenger gate follows5-1 unlock independently of the4-3 maintenance secret', () => {
    const f = fixture();
    for (const secret of [false, true]) for (const completedB2 of [false, true]) {
        const save = freshSave(); save.secrets = secret ? ['4-3'] : []; save.completed = completedB2 ? ['4-5'] : [];
        const graph = buildJourneyNetwork({ ...f.options, secrets: save.secrets, passengerCableOpen: isUnlocked('5-1', save) });
        assert.equal(graph.edges.some(edge => edge.id === PASSENGER_CABLE_PAIR.lanes.a.rideEdge), completedB2);
        assert.equal(graph.edges.some(edge => edge.id === SERRA_CABLE_PAIR.lanes.a.rideEdge), secret);
    }
});

test('passenger graph is append-only, retains all released timing and gives every cabin a distinct world-prefixed berth', () => {
    const f = fixture(), before = structuredClone(f.options), baseline = buildJourneyNetwork({ ...f.options, passengerCable: null });
    const graph = buildJourneyNetwork(f.options), additions = buildReservaJourney(f.options);
    assert.deepEqual(graph.edges.slice(0, baseline.edges.length), baseline.edges);
    for (const [id, point] of Object.entries(baseline.nodes)) assert.deepEqual(graph.nodes[id], point);
    assert.equal(Object.keys(additions.nodes).length, 6); assert.equal(additions.edges.length, 8);
    assert.ok(Object.keys(additions.nodes).every(id => /^[45]-/.test(id)));
    assert.equal(new Set(graph.edges.map(edge => edge.id)).size, graph.edges.length);
    assert.equal(graph.edges.filter(edge => edge.mode === 'cable').length, 4);
    assert.equal(graph.edges.filter(edge => edge.mode === 'sail').length, 1);
    assert.deepEqual(graph.nodes[PASSENGER_CABLE_STATIONS.lower.platform], localToAtlas(f.cable.stations.lower.platform, placements[4]));
    assert.equal(additions.edges.find(edge => edge.id === PASSENGER_CABLE_STATIONS.lower.approach)!.duration, 2.8);
    for (const car of ['a', 'b'] as const) {
        const edge = additions.edges.find(edge => edge.id === PASSENGER_CABLE_PAIR.lanes[car].rideEdge)!;
        assert.deepEqual(edge.points, f.cable.lanes[car].pathPoints); assert.equal(edge.duration, 8.3);
    }
    assert.deepEqual(f.options, before);
});

test('physical passenger travel uses both supported approaches, boards and disembarks, then awaits explicit gameplay entry', () => {
    const f = fixture(), graph = buildJourneyNetwork({ ...f.options, secrets: [] });
    const capabilities = { availableStages: ['4-5', '5-1'], edgeDirections: cableEdgeDirections(createCablePair(), PASSENGER_CABLE_PAIR, true) };
    for (const [from, to, car] of [['4-5', '5-1', 'a'], ['5-1', '4-5', 'b']] as const) {
        let journey = selectJourney(createJourney(from, graph, capabilities), to, graph, capabilities);
        assert.equal(journey.blocked, null);
        assert.deepEqual(journey.legs.map(leg => leg.mode), ['walk', 'cable-board', 'cable', 'cable-board', 'walk']);
        assert.equal(journey.legs[2].id, PASSENGER_CABLE_PAIR.lanes[car].rideEdge);
        assert.equal(canEnterJourney(journey, capabilities), false);
        journey = advanceJourney(journey, 100); assert.equal(journey.arrived, to); assert.equal(journey.entered, null);
        assert.deepEqual(journey.point, graph.nodes[to]); assert.equal(enterJourney(journey, capabilities).entered, to);
    }
});

test('passenger and maintenance lines connect Serra and Reserva without reopening Factory–Serra', () => {
    const f = fixture(), graph = buildJourneyNetwork(f.options);
    const capabilities = { availableStages: f.islands.flatMap(island => Object.keys(island.metadata.nodes)),
        edgeDirections: { ...cableEdgeDirections(createCablePair(), SERRA_CABLE_PAIR, true),
            ...cableEdgeDirections(createCablePair(), PASSENGER_CABLE_PAIR, true) } };
    for (const [from, to] of [['4-3', '5-1'], ['5-1', '4-3']]) {
        const trip = selectJourney(createJourney(from, graph, capabilities), to, graph, capabilities);
        assert.equal(trip.blocked, null); assert.equal(trip.legs.filter(leg => leg.mode === 'cable').length, 2);
        assert.equal(advanceJourney(trip, 100).arrived, to);
    }
    for (const [from, to] of [['3-5', '5-1'], ['5-1', '3-5']]) {
        const trip = selectJourney(createJourney(from, graph, capabilities), to, graph, capabilities);
        assert.equal(trip.blocked, 'no-route'); assert.deepEqual(trip.legs, []);
        assert.equal(advanceJourney(trip, 100).arrived, from);
    }
    assert.ok(!graph.edges.some(edge => edge.id === 'factory-serra-link'));
    assert.ok(graph.edges.some(edge => edge.id === 'coast-port-sail'));
    assert.ok(graph.edges.some(edge => edge.id === 'port-factory-bridge'));
});

test('authored Reserva walking durations apply while released Serra timing and Costa–Factory cadences stay unchanged', () => {
    const f = fixture();
    const islands = f.islands.map(island => island.world === 4 || island.world === 5 ? island : { ...island,
        metadata: { ...island.metadata, routeDurationsSeconds: { '0:1': 17 }, secretDurationSeconds: 17,
            secretRoute: [island.metadata.nodes[`${island.world}-3`], island.metadata.nodes[`${island.world}-5`]] },
    });
    const graph = buildJourneyNetwork({ ...f.options, islands, secrets: ['1-3', '2-3', '3-3', '4-3', '5-3', '6-3'] });
    for (const world of [1, 2, 3]) {
        assert.equal(graph.edges.find(edge => edge.id === `${world}-1:${world}-2`)!.duration, .78);
        assert.equal(graph.edges.find(edge => edge.id === `${world}-secret`)!.duration, 1.1);
    }
    assert.equal(graph.edges.find(edge => edge.id === '6-1:6-2')!.duration, 17);
    assert.equal(graph.edges.find(edge => edge.id === '6-secret')!.duration, 17);
    assert.equal(graph.edges.find(edge => edge.id === '5-secret')!.duration, 4.6);
    assert.equal(graph.edges.some(edge => edge.id === '4-secret'), false);
    for (const world of [4, 5]) for (let n = 1; n < 5; n++) {
        const metadata = islands.find(island => island.world === world)!.metadata;
        assert.equal(graph.edges.find(edge => edge.id === `${world}-${n}:${world}-${n + 1}`)!.duration,
            metadata.routeDurationsSeconds![`${n - 1}:${n}`]);
    }
    const noTiming = buildJourneyNetwork({ ...f.options, secrets: ['5-3'], islands: f.islands.map(island => island.world === 5 ? { ...island,
        metadata: { ...island.metadata, routeDurationsSeconds: undefined, secretDurationSeconds: undefined } } : island) });
    assert.equal(noTiming.edges.find(edge => edge.id === '5-1:5-2')!.duration, .78);
    assert.equal(noTiming.edges.find(edge => edge.id === '5-secret')!.duration, 1.1);
});

test('installed passenger export matches accepted islands, native cabin layers and every compact terminal overlay', () => {
    const reserva = parseMapMetadata(read('reserva-diorama'), 5)!; assert.ok(reserva);
    const cable = parseReservaPassengerCable(read('serra-reserva-link'), serra, reserva, placements); assert.ok(cable);
    assert.equal(cable.cablePolylines.length, 2);
    assert.ok(cable.overlays.some(overlay => overlay.when === undefined));
    assert.ok(cable.overlays.some(overlay => overlay.when === 'closed'));
    for (const expected of [cable.atlas, ...cable.overlays]) {
        const bytes = readFileSync(new URL(`../public${expected.path}`, import.meta.url));
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
        let naturalWidth: number, naturalHeight: number;
        if (bytes.toString('ascii', 12, 16) === 'VP8X') {
            assert.ok(bytes[20] & 0x10, 'Extended WebP layers retain alpha for atlas compositing.');
            naturalWidth = 1 + bytes.readUIntLE(24, 3); naturalHeight = 1 + bytes.readUIntLE(27, 3);
        } else {
            assert.equal(bytes.toString('ascii', 12, 16), 'VP8L'); assert.equal(bytes[20], 0x2f);
            const dimensions = bytes.readUInt32LE(21);
            assert.ok(dimensions & 0x10000000, 'Lossless WebP layers retain alpha for atlas compositing.');
            naturalWidth = 1 + (dimensions & 0x3fff); naturalHeight = 1 + ((dimensions >>> 14) & 0x3fff);
        }
        assert.equal(matchesReservaAssetSize({ naturalWidth, naturalHeight }, expected), true, expected.path);
    }
    const graph = buildReservaJourney({ passengerCable: cable, passengerCableReady: true, passengerCableOpen: true,
        islands: [{ world: 4, metadata: serra, placement: placements[4], ready: true },
            { world: 5, metadata: reserva, placement: placements[5], ready: true }] });
    assert.equal(Object.keys(graph.nodes).length, 6); assert.equal(graph.edges.length, 8);
});
