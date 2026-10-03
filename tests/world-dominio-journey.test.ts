import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localToAtlas, WORLD_ATLAS_PLACEMENTS } from '../src/adventure/WorldAtlasModel';
import { cableEdgeDirections, createCablePair } from '../src/adventure/WorldCableModel';
import { buildDominioJourney, DOMINIO_DOCK_NODES, DOMINIO_FERRY, matchesDominioAssetSize, parseDominioJourney,
    RESERVA_DOMINIO_CONNECTION } from '../src/adventure/WorldDominioJourney';
import { COAST_PORT_FERRY, createFerry, ferryEdgeDirections, sampleFerry, updateFerryAfterTravel } from '../src/adventure/WorldFerryModel';
import { advanceJourney, canEnterJourney, createJourney, selectJourney, skipJourney } from '../src/adventure/WorldJourneyModel';
import { buildJourneyNetwork, parseJourneyBridge, parseJourneyConnection, type JourneyIsland } from '../src/adventure/WorldJourneyNetwork';
import { fallbackMapMetadata, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { parseReservaPassengerCable, PASSENGER_CABLE_PAIR } from '../src/adventure/WorldReservaJourney';
import { parseFactorySerraLink, parseSerraMaintenanceCable, SERRA_CABLE_PAIR } from '../src/adventure/WorldSerraJourney';
import { freshSave, isUnlocked } from '../src/adventure/progress';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
const coast = parseMapMetadata(read('costa-diorama'), 1)!, port = parseMapMetadata(read('porto-diorama'), 2)!;
const factory = parseMapMetadata(read('fabrica-diorama'), 3)!, serra = parseMapMetadata(read('serra-diorama'), 4)!;
const reserva = parseMapMetadata(read('reserva-diorama'), 5)!;
const placements = { 5: WORLD_ATLAS_PLACEMENTS[5], 6: { origin: { x: 1.5, y: -1.8 }, scale: 1 } };
const point = (x: number, y: number) => ({ x, y });
const rectangle = (left: number, top: number, right: number, bottom: number) =>
    [point(left, top), point(right, top), point(right, bottom), point(left, bottom)];

/** Synthetic dock floor and sailing path: production rendering has its own QA. */
function fixture() {
    const dominio = fallbackMapMetadata(6);
    dominio.nodes['6-1'] = point(.75, .78);
    dominio.routeDurationsSeconds = { '0:1': 2.1, '1:2': 2.7, '2:3': 1.9, '3:4': 3.3 };
    dominio.secretDurationSeconds = 4.1; dominio.secretRoute = [dominio.nodes['6-3'], dominio.nodes['6-5']];
    const dock = (world: 5 | 6) => {
        const stage = DOMINIO_DOCK_NODES[world].join, join = (world === 5 ? reserva : dominio).nodes[stage];
        const dock = point(world === 5 ? .05 : .97, .7), passenger = point(world === 5 ? -.02 : 1.05, .75);
        return { version: 1, island: world === 5 ? 'reserva' : 'dominio', size: { width: 1920, height: 1200 },
            join: { ...join, node: stage as string }, dock, junctionToDock: [join, point(.5, .6), dock], boardingRoute: [dock, passenger],
            berth: { passenger, waterline: point(passenger.x, .8), headingFrame: 6 },
            approachDurationSeconds: world === 5 ? 4.3 : 1.6, boardingDurationSeconds: world === 5 ? .8 : .9,
            aboardProgress: .65,
            support: { bounds: { left: -.1, top: .1, right: 1.1, bottom: 1.1 }, polygons: [rectangle(-.1, .1, 1.1, 1.1)] },
            approachBounds: { left: -.1, top: .1, right: 1.1, bottom: 1.1 },
            artBounds: { left: -.2, top: 0, right: 1.2, bottom: 1.2 },
        };
    };
    const source = dock(5), destination = dock(6);
    const raw = { version: 1, connection: RESERVA_DOMINIO_CONNECTION,
        boatMetadata: '/assets/world/map/journey-boat.meta.json', placements: { reserva: placements[5], dominio: placements[6] },
        islands: { reserva: source, dominio: destination },
        sailRoute: { coordinateSystem: 'atlas', durationSeconds: 4.2,
            points: [localToAtlas(source.berth.passenger, placements[5]), point(2.6, -1.2), localToAtlas(destination.berth.passenger, placements[6])],
            segmentHeadings: [6, 6], reverseSegmentHeadings: [2, 2] },
        overlays: [
            { path: '/assets/world/map/synthetic-dominio-static.webp', width: 192, height: 240,
                left: 2.5, top: -1.1, widthInMap: .1, heightInMap: .2 },
            { path: '/assets/world/map/synthetic-dominio-gate.webp', width: 96, height: 120,
                left: 2.4, top: -1.2, widthInMap: .05, heightInMap: .1, when: 'closed' },
        ],
    };
    const connection = parseDominioJourney(raw, reserva, dominio, placements)!; assert.ok(connection);
    const islands: JourneyIsland[] = [coast, port, factory, serra, reserva, dominio].map((metadata, i) => ({
        world: i + 1, metadata, ready: true, placement: i === 5 ? placements[6] : WORLD_ATLAS_PLACEMENTS[i + 1],
    }));
    const options = { islands, secrets: ['4-3', '5-3', '6-3'],
        connection: parseJourneyConnection(read('coast-port-journey'), coast, port), connectionReady: true,
        bridge: parseJourneyBridge(read('port-factory-bridge'), port, factory, WORLD_ATLAS_PLACEMENTS), bridgeReady: true, bridgeOpen: true,
        factorySerraLink: parseFactorySerraLink(read('factory-serra-link'), factory, serra, WORLD_ATLAS_PLACEMENTS),
        factorySerraLinkReady: true, factorySerraLinkOpen: true,
        maintenanceCable: parseSerraMaintenanceCable(read('serra-maintenance-cable'), serra), maintenanceCableReady: true,
        passengerCable: parseReservaPassengerCable(read('serra-reserva-link'), serra, reserva, WORLD_ATLAS_PLACEMENTS), passengerCableReady: true, passengerCableOpen: true,
        dominioConnection: connection, dominioConnectionReady: true, dominioConnectionOpen: true,
    };
    assert.ok(options.passengerCable); return { raw, connection, dominio, islands, options };
}

test('parser preserves fixed joins, independent floor/framing/crop coordinates and exact shared boat identity', () => {
    const f = fixture(), original = structuredClone(f.raw);
    const connection = parseDominioJourney(f.raw, reserva, f.dominio, placements)!;
    assert.deepEqual(connection.sailRoute, f.raw.sailRoute.points); assert.equal(connection.docks[5].join.node, '5-5');
    assert.equal(connection.docks[6].join.node, '6-1'); assert.equal(connection.boatMetadata, '/assets/world/map/journey-boat.meta.json');
    assert.deepEqual(connection.docks[5].approachBounds, f.raw.islands.reserva.approachBounds);
    assert.deepEqual(connection.docks[6].artBounds, f.raw.islands.dominio.artBounds);
    assert.ok(connection.docks[5].berth.passenger.x < 0, 'Outboard local geometry is valid.');
    assert.ok(connection.docks[6].berth.passenger.x > 1, 'Local coordinates are not bitmap clamps.');
    assert.notEqual(connection.docks[5].support.polygons[0], f.raw.islands.reserva.support.polygons[0]);
    assert.notEqual(connection.placements[6].origin, f.raw.placements.dominio.origin);
    assert.deepEqual(f.raw, original);
});

test('parser rejects stale joins, placements, endpoints, timing, dimensions, unsafe asset paths and headings', () => {
    const f = fixture();
    const mutations: Array<(raw: typeof f.raw) => void> = [
        raw => { raw.version = 2; }, raw => { raw.connection = 'another-ferry'; },
        raw => { raw.boatMetadata = '/assets/world/map/another-boat.meta.json'; },
        raw => { raw.placements.reserva.origin.x += .1; }, raw => { raw.placements.dominio.scale = 2; },
        raw => { raw.islands.reserva.island = 'costa'; }, raw => { raw.islands.dominio.size.width = 1000; },
        raw => { raw.islands.reserva.join.node = '5-4'; }, raw => { raw.islands.dominio.join.x += .01; },
        raw => { raw.islands.reserva.junctionToDock[0].x += .01; }, raw => { raw.islands.reserva.junctionToDock[2].y += .01; },
        raw => { raw.islands.dominio.boardingRoute[0].x += .01; }, raw => { raw.islands.dominio.berth.passenger.y += .01; },
        raw => { raw.islands.reserva.berth.headingFrame = 8; }, raw => { raw.islands.reserva.berth.waterline.x = Infinity; },
        raw => { raw.islands.reserva.approachDurationSeconds = 0; }, raw => { raw.islands.dominio.boardingDurationSeconds = 121; },
        raw => { raw.islands.reserva.aboardProgress = 0; }, raw => { raw.islands.dominio.aboardProgress = 1; },
        raw => { raw.islands.dominio.aboardProgress = NaN; },
        raw => { raw.sailRoute.durationSeconds = NaN; }, raw => { raw.sailRoute.coordinateSystem = 'island-local'; },
        raw => { raw.sailRoute.points[0].x += .01; }, raw => { raw.sailRoute.points.at(-1)!.y += .01; },
        raw => { raw.sailRoute.points.splice(1, 0, { ...raw.sailRoute.points[0] }); raw.sailRoute.segmentHeadings.push(6); raw.sailRoute.reverseSegmentHeadings.push(2); },
        raw => { raw.sailRoute.segmentHeadings.pop(); }, raw => { raw.sailRoute.reverseSegmentHeadings[0] = -1; },
        raw => { raw.sailRoute.segmentHeadings[0] = 1.5; },
        raw => { raw.overlays[0].path = '/assets/world/map/../../bad.webp'; }, raw => { raw.overlays[0].width += 1; },
        raw => { raw.overlays[0].left = Infinity; }, raw => { raw.overlays[1].when = 'whenever'; }, raw => { raw.overlays = []; },
        raw => { raw.islands.reserva.approachBounds.right = -.2; }, raw => { raw.islands.dominio.artBounds.bottom = .7; },
    ];
    for (const mutate of mutations) {
        // A serialized export has no shared object references between endpoints.
        const raw = JSON.parse(JSON.stringify(f.raw)) as typeof f.raw; mutate(raw);
        assert.equal(parseDominioJourney(raw, reserva, f.dominio, placements), null, mutate.toString());
    }
    assert.equal(parseDominioJourney(f.raw, { ...reserva, world: 4 }, f.dominio, placements), null);
    assert.equal(parseDominioJourney(f.raw, reserva, { ...f.dominio, world: 5 }, placements), null);
});

test('whole approach and boarding segments must have convex union support, not merely supported endpoints', () => {
    const f = fixture(), raw = structuredClone(f.raw), dock = raw.islands.dominio;
    dock.support.polygons = [rectangle(.45, .5, .55, .7), rectangle(.7, .7, .8, .85), rectangle(.9, .6, 1.1, .9)];
    assert.equal(parseDominioJourney(raw, reserva, f.dominio, placements), null, 'Unsupported gaps between the three approach vertices are rejected.');
    for (const polygon of [rectangle(-.1, .1, 1.1, 1.1).reverse(), rectangle(-.1, .1, 1.1, 1.1)]) {
        raw.islands.dominio.support.polygons = [polygon];
        assert.ok(parseDominioJourney(raw, reserva, f.dominio, placements));
    }
    raw.islands.dominio.support.polygons = [[point(0, 0), point(1, 1), point(0, 1), point(1, 0)]];
    assert.equal(parseDominioJourney(raw, reserva, f.dominio, placements), null);
    raw.islands.dominio.support.polygons = [rectangle(.4, .2, 1.02, .9)];
    assert.equal(parseDominioJourney(raw, reserva, f.dominio, placements), null, 'The final onboard portion also needs its authored deck footprint.');
});

test('graph contribution is append-only and retains every released ferry, bridge, cable and route byte-for-byte', () => {
    const f = fixture(), baseline = buildJourneyNetwork({ ...f.options, dominioConnectionReady: false });
    const graph = buildJourneyNetwork(f.options), additions = buildDominioJourney(f.options);
    assert.equal(additions.edges.length, 5); assert.equal(Object.keys(additions.nodes).length, 4);
    assert.deepEqual(graph.edges.slice(0, baseline.edges.length), baseline.edges);
    for (const [id, p] of Object.entries(baseline.nodes)) assert.deepEqual(graph.nodes[id], p);
    assert.deepEqual(graph.edges.slice(baseline.edges.length), additions.edges);
    assert.deepEqual(graph.edges.find(edge => edge.id === DOMINIO_FERRY.sailEdge)!.points, f.connection.sailRoute);
    assert.equal(graph.edges.filter(edge => edge.mode === 'sail').length, 2);
    assert.equal(graph.edges.filter(edge => edge.mode === 'cable').length, 4);
    assert.equal(graph.edges.find(edge => edge.id === '6-1:6-2')!.duration, 2.1);
    assert.equal(graph.edges.find(edge => edge.id === '6-secret')!.duration, 4.1);
});

test('only existing 5-5 completion opens 6-1; locks and independent asset failures omit only this crossing', () => {
    const f = fixture(), save = freshSave();
    for (const id of ['1-5', '2-5', '3-5', '4-5']) save.completed.push(id);
    save.secrets.push('5-3'); assert.equal(isUnlocked('6-1', save), false);
    const baseline = buildJourneyNetwork({ ...f.options, dominioConnectionOpen: isUnlocked('6-1', save) });
    assert.ok(!baseline.edges.some(edge => edge.id === DOMINIO_FERRY.sailEdge));
    assert.ok(baseline.edges.some(edge => edge.id === COAST_PORT_FERRY.sailEdge));
    assert.ok(baseline.edges.some(edge => edge.id === PASSENGER_CABLE_PAIR.lanes.a.rideEdge));
    save.completed.push('5-5'); assert.equal(isUnlocked('6-1', save), true);
    assert.equal(buildDominioJourney({ ...f.options, dominioConnectionOpen: isUnlocked('6-1', save) }).edges.length, 5);
    for (const options of [{ ...f.options, dominioConnection: null }, { ...f.options, dominioConnectionReady: false },
        ...[5, 6].map(world => ({ ...f.options, islands: f.islands.map(island => island.world === world ? { ...island, ready: false } : island) }))]) {
        assert.deepEqual(buildDominioJourney(options), { nodes: {}, edges: [] });
        const graph = buildJourneyNetwork(options);
        assert.ok(graph.edges.some(edge => edge.id === COAST_PORT_FERRY.sailEdge));
        assert.ok(graph.edges.some(edge => edge.id === SERRA_CABLE_PAIR.lanes.a.rideEdge));
    }
    const coastFailed = buildJourneyNetwork({ ...f.options, connectionReady: false });
    assert.ok(coastFailed.edges.some(edge => edge.id === DOMINIO_FERRY.sailEdge));
    assert.ok(!coastFailed.edges.some(edge => edge.id === COAST_PORT_FERRY.sailEdge));
});

test('builder rejects cached connections after either snapshot, placement or shared endpoint changes', () => {
    const f = fixture();
    for (const world of [5, 6]) {
        const moved = f.islands.map(island => island.world === world ? { ...island,
            placement: { ...island.placement, origin: point(island.placement.origin.x + .01, island.placement.origin.y) } } : island);
        assert.deepEqual(buildDominioJourney({ ...f.options, islands: moved }), { nodes: {}, edges: [] });
        const stale = structuredClone(f.islands), island = stale.find(island => island.world === world)!;
        island.metadata.nodes[world === 5 ? '5-5' : '6-1'].x += .01;
        assert.deepEqual(buildDominioJourney({ ...f.options, islands: stale }), { nodes: {}, edges: [] });
    }
    const stale = structuredClone(f.connection); stale.sailRoute.at(-1)!.x += .01;
    assert.deepEqual(buildDominioJourney({ ...f.options, dominioConnection: stale }), { nodes: {}, edges: [] });
});

test('Serra↔Domínio trips preserve both cable lines and their ferry with explicit final entry', () => {
    const f = fixture(), network = buildJourneyNetwork(f.options);
    for (const [from, to] of [['4-3', '6-1'], ['6-1', '4-3']]) {
        const ferries = [COAST_PORT_FERRY, DOMINIO_FERRY].map(definition => createFerry(definition, Number(from[0])));
        const capabilities = { availableStages: f.islands.flatMap(island => Object.keys(island.metadata.nodes)),
            edgeDirections: { ...ferryEdgeDirections(ferries[0], COAST_PORT_FERRY, true), ...ferryEdgeDirections(ferries[1], DOMINIO_FERRY, true),
                ...cableEdgeDirections(createCablePair(), SERRA_CABLE_PAIR, true), ...cableEdgeDirections(createCablePair(), PASSENGER_CABLE_PAIR, true) } };
        const trip = selectJourney(createJourney(from, network, capabilities), to, network, capabilities);
        assert.equal(trip.blocked, null);
        assert.deepEqual(trip.legs.filter(leg => leg.mode === 'sail').map(leg => leg.id), [DOMINIO_FERRY.sailEdge]);
        assert.equal(trip.legs.filter(leg => leg.mode === 'cable').length, 2);
        assert.ok(trip.legs.some(leg => leg.id.startsWith('serra-reserva-passenger')));
        assert.ok(trip.legs.every(leg => leg.id !== 'factory-serra-link'));
        for (const reached of [advanceJourney(trip, 1000), skipJourney(trip), advanceJourney(trip, 0, true)]) {
            assert.equal(reached.arrived, to); assert.equal(reached.entered, null); assert.equal(canEnterJourney(reached, capabilities), true);
            assert.deepEqual(updateFerryAfterTravel(ferries[0], COAST_PORT_FERRY, trip, reached), ferries[0]);
            assert.equal(updateFerryAfterTravel(ferries[1], DOMINIO_FERRY, trip, reached).mooredWorld, to === '4-3' ? 5 : 6);
        }
        const across = selectJourney(createJourney(from, network, capabilities), '1-1', network, capabilities);
        assert.equal(across.blocked, 'no-route'); assert.equal(skipJourney(across).arrived, from);
    }
    assert.ok(network.edges.some(edge => edge.id === COAST_PORT_FERRY.sailEdge));
    assert.ok(network.edges.some(edge => edge.id === 'port-factory-bridge'));
});

test('overlay bitmaps must match declared native dimensions before the controller marks the ferry ready', () => {
    const f = fixture(), overlay = f.connection.overlays[0];
    assert.equal(matchesDominioAssetSize({ naturalWidth: overlay.width, naturalHeight: overlay.height }, overlay), true);
    assert.equal(matchesDominioAssetSize({ naturalWidth: overlay.width + 1, naturalHeight: overlay.height }, overlay), false);
    assert.equal(matchesDominioAssetSize({ naturalWidth: overlay.width, naturalHeight: 0 }, overlay), false);
    assert.equal(matchesDominioAssetSize(null, overlay), false);
});

test('independent endpoint rounding cannot add tiny sail segments and shift authored heading indices', () => {
    const f = fixture(), connection = structuredClone(f.connection);
    connection.sailRoute[0].x += 1e-7; connection.sailRoute.at(-1)!.y -= 1e-7;
    const network = buildJourneyNetwork({ ...f.options, dominioConnection: connection });
    const capabilities = { availableStages: ['5-5', '6-1'] };
    const trip = selectJourney(createJourney('5-5', network, capabilities), '6-1', network, capabilities);
    const sail = trip.legs.find(leg => leg.id === DOMINIO_FERRY.sailEdge)!;
    assert.equal(sail.points.length, connection.sailRoute.length);
    assert.deepEqual(sail.points[0], network.nodes['5-berth']); assert.deepEqual(sail.points.at(-1), network.nodes['6-berth']);
    assert.deepEqual(sail.points.slice(1, -1), connection.sailRoute.slice(1, -1));
    assert.notDeepEqual(connection.sailRoute[0], sail.points[0], 'Graph anchoring does not mutate the parsed source.');
});

test('installed ferry export matches both accepted islands, all cropped bitmaps and canonical heading segments', () => {
    const dominio = parseMapMetadata(read('dominio-diorama'), 6)!; assert.ok(dominio);
    const connection = parseDominioJourney(read('reserva-dominio-journey'), reserva, dominio, WORLD_ATLAS_PLACEMENTS)!;
    assert.ok(connection); assert.equal(connection.overlays.length, 4);
    assert.equal(connection.overlays.filter(overlay => overlay.when === 'closed').length, 2);
    assert.equal(connection.overlays.filter(overlay => overlay.when === undefined).length, 2);
    for (const expected of connection.overlays) {
        const bytes = readFileSync(new URL(`../public${expected.path}`, import.meta.url));
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
        let naturalWidth: number, naturalHeight: number;
        if (bytes.toString('ascii', 12, 16) === 'VP8X') {
            assert.ok(bytes[20] & 0x10); naturalWidth = 1 + bytes.readUIntLE(24, 3); naturalHeight = 1 + bytes.readUIntLE(27, 3);
        } else {
            assert.equal(bytes.toString('ascii', 12, 16), 'VP8L'); assert.equal(bytes[20], 0x2f);
            const dimensions = bytes.readUInt32LE(21); assert.ok(dimensions & 0x10000000);
            naturalWidth = 1 + (dimensions & 0x3fff); naturalHeight = 1 + ((dimensions >>> 14) & 0x3fff);
        }
        assert.equal(matchesDominioAssetSize({ naturalWidth, naturalHeight }, expected), true, expected.path);
    }
    const f = fixture(), islands = f.islands.map(island => island.world === 6 ? { ...island, metadata: dominio } : island);
    const graph = buildJourneyNetwork({ ...f.options, islands, dominioConnection: connection });
    const geometry = { berths: Object.fromEntries([5, 6].map(world => [world,
        { foot: graph.nodes[DOMINIO_FERRY.berths[world]], headingFrame: connection.docks[world as 5 | 6].berth.headingFrame }])),
        segmentHeadings: connection.segmentHeadings, reverseSegmentHeadings: connection.reverseSegmentHeadings };
    for (const [from, to] of [['5-5', '6-1'], ['6-1', '5-5']]) {
        const ferry = createFerry(DOMINIO_FERRY, Number(from[0])), capabilities = { availableStages: [from, to],
            edgeDirections: ferryEdgeDirections(ferry, DOMINIO_FERRY, true) };
        const trip = selectJourney(createJourney(from, graph, capabilities), to, graph, capabilities);
        assert.equal(trip.blocked, null);
        const sail = trip.legs.find(leg => leg.id === DOMINIO_FERRY.sailEdge)!;
        assert.equal(sail.points.length, connection.sailRoute.length);
        for (const progress of [0, .001, .2, .5, .8, .999, 1]) {
            const pose = sampleFerry(ferry, DOMINIO_FERRY, geometry, { active: { ...sail, progress }, time: 100, reducedMotion: true });
            assert.ok(Number.isInteger(pose.frameIndex) && pose.frameIndex >= 0 && pose.frameIndex < 8);
        }
    }
});
