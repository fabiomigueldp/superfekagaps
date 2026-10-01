import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COAST_PORT_PLACEMENTS, WORLD_ATLAS_PLACEMENTS, localToAtlas } from '../src/adventure/WorldAtlasModel';
import { fallbackMapMetadata, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { advanceJourney, canEnterJourney, createJourney, journeySaveSelection, selectJourney, skipJourney } from '../src/adventure/WorldJourneyModel';
import { BRIDGE_NODES, PORT_FACTORY_BRIDGE_EDGE, buildJourneyNetwork, parseJourneyBridge, parseJourneyConnection,
    type JourneyIsland } from '../src/adventure/WorldJourneyNetwork';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
const coast = parseMapMetadata(read('costa-diorama'), 1)!;
const port = parseMapMetadata(read('porto-diorama'), 2)!;
const ferry = parseJourneyConnection(read('coast-port-journey'), coast, port)!;
const point = (value: { x: number; y: number }) => ({ x: value.x, y: value.y });

/** Deliberately synthetic bridge geometry. Production exports get their own
 * integration checks; this fixture neither chooses nor approves their placement.
 */
function fixture() {
    const factory = fallbackMapMetadata(3);
    for (let n = 0; n < 4; n++) factory.routes[`${n}:${n + 1}`] = [factory.nodes[`3-${n + 1}`], factory.nodes[`3-${n + 2}`]];
    factory.secretRoute = [factory.nodes['3-3'], factory.nodes['3-5']];
    const placements = { 2: COAST_PORT_PLACEMENTS[2], 3: { origin: { x: 3.1, y: .2 }, scale: 1 } };
    const route = port.routes['3:4'];
    const portJoin = { x: (route[0].x + route[1].x) / 2, y: (route[0].y + route[1].y) / 2,
        route: '3:4', from: '2-4', to: '2-5', segment: 0, t: .5 };
    const portLanding = { x: .95, y: .8 }, factoryLanding = { x: .1, y: .8 };
    const portApproach = [point(portJoin), { x: .9, y: .85 }, portLanding];
    const factoryApproach = [point(factory.nodes['3-1']), { x: .15, y: .75 }, factoryLanding];
    const bounds = (points: typeof portApproach) => ({ left: Math.min(...points.map(p => p.x)) - .03,
        top: Math.min(...points.map(p => p.y)) - .03, right: Math.max(...points.map(p => p.x)) + .03,
        bottom: Math.max(...points.map(p => p.y)) + .03 });
    const overlay = { path: '/assets/world/map/synthetic-bridge-open.webp', width: 2880, height: 1320,
        left: 1.8, top: .1, widthInMap: 1.5, heightInMap: 1.1 };
    const raw = { version: 1, connection: PORT_FACTORY_BRIDGE_EDGE,
        placements: { porto: placements[2], fabrica: placements[3] },
        islands: {
            porto: { version: 1, island: 'porto', size: { width: 1920, height: 1200 }, join: portJoin,
                landing: portLanding, junctionToLanding: portApproach, approachBounds: bounds(portApproach) },
            fabrica: { version: 1, island: 'fabrica', size: { width: 1920, height: 1200 }, join: { ...point(factory.nodes['3-1']), node: '3-1' },
                landing: factoryLanding, junctionToLanding: factoryApproach, approachBounds: bounds(factoryApproach) },
        },
        bridgeRoute: { coordinateSystem: 'atlas', durationSeconds: 3,
            points: [localToAtlas(portLanding, placements[2]), { x: 2.7, y: .8 }, localToAtlas(factoryLanding, placements[3])] },
        overlays: { open: overlay, closed: { ...overlay, path: '/assets/world/map/synthetic-bridge-closed.webp' } },
    };
    const bridge = parseJourneyBridge(raw, port, factory, placements)!;
    assert.ok(bridge);
    const islands: JourneyIsland[] = Array.from({ length: 6 }, (_, index) => ({ world: index + 1, ready: true,
        metadata: index === 0 ? coast : index === 1 ? port : index === 2 ? factory : fallbackMapMetadata(index + 1),
        placement: index === 2 ? placements[3] : COAST_PORT_PLACEMENTS[index + 1] ?? { origin: { x: 0, y: 0 }, scale: 1 } }));
    const capabilities = { availableStages: islands.flatMap(island => Object.keys(island.metadata.nodes)) };
    const options = { islands, secrets: [] as string[], connection: ferry, connectionReady: true, bridge, bridgeReady: true, bridgeOpen: true };
    return { raw, factory, placements, bridge, islands, capabilities, options };
}

test('bridge parser keeps local approaches and atlas span separate without modifying either export', () => {
    const f = fixture(), original = structuredClone(f.raw);
    const parsed = parseJourneyBridge(f.raw, port, f.factory, f.placements)!;
    assert.equal(parsed.landings[2].join.route, '3:4');
    assert.equal(parsed.landings[3].join.node, '3-1');
    assert.deepEqual(parsed.bridgeRoute, f.raw.bridgeRoute.points);
    assert.deepEqual(parsed.landings[2].approachBounds, f.raw.islands.porto.approachBounds);
    assert.notEqual(parsed.bridgeRoute, f.raw.bridgeRoute.points);
    assert.notEqual(parsed.placements[3].origin, f.raw.placements.fabrica.origin);
    assert.deepEqual(f.raw, original);
});

test('bridge parser rejects mismatched joins, placements, approaches, crops and crossing endpoints', () => {
    const f = fixture();
    const mutations: Array<(data: typeof f.raw) => void> = [
        data => { data.version = 2; },
        data => { data.connection = 'invented-link'; },
        data => { data.islands.porto.join.from = '2-3'; },
        data => { data.islands.porto.join.segment = 99; },
        data => { data.islands.porto.join.t = 1.1; },
        data => { data.islands.porto.join.x += .01; },
        data => { data.islands.fabrica.join.node = '3-2'; },
        data => { data.islands.fabrica.join.y += .01; },
        data => { data.islands.fabrica.size.width = 1280; },
        data => { data.islands.porto.junctionToLanding[1].x = NaN; },
        data => { data.islands.porto.junctionToLanding[0].x += .01; },
        data => { data.islands.fabrica.landing.y += .01; },
        data => { data.islands.porto.approachBounds.left = Infinity; },
        data => { data.islands.fabrica.approachBounds.right = 0; },
        data => { data.placements.porto.origin.x += .01; },
        data => { data.placements.fabrica.scale = 2; },
        data => { data.bridgeRoute.coordinateSystem = 'local'; },
        data => { data.bridgeRoute.points[0].x += .01; },
        data => { data.bridgeRoute.durationSeconds = 0; },
        data => { data.overlays.open.path = 'https://example.test/bridge.webp'; },
        data => { data.overlays.closed.path = '/assets/world/map/../bridge.webp'; },
        data => { data.overlays.open.width += 1; },
        data => { data.overlays.closed.heightInMap = Infinity; },
    ];
    for (const mutate of mutations) {
        const raw = structuredClone(f.raw); mutate(raw);
        assert.equal(parseJourneyBridge(raw, port, f.factory, f.placements), null);
    }
});

test('missing, closed or stale bridge leaves the complete existing ferry network unchanged', () => {
    const f = fixture();
    const cases = [
        { ...f.options, bridge: null }, { ...f.options, bridgeReady: false }, { ...f.options, bridgeOpen: false },
        { ...f.options, islands: f.islands.map(island => ({ ...island, ready: island.world !== 3 })) },
        { ...f.options, islands: f.islands.map(island => island.world === 3 ? { ...island, placement: { ...island.placement, scale: 2 } } : island) },
    ];
    const moved = structuredClone(f.islands);
    moved[1].metadata.routes['3:4'][1].x += .02;
    cases.push({ ...f.options, islands: moved });
    for (const options of cases) {
        const baseline = buildJourneyNetwork({ ...options, bridge: null });
        assert.deepEqual(buildJourneyNetwork(options), baseline);
        assert.equal(baseline.edges.filter(edge => edge.id === 'coast-port-sail').length, 1);
    }
});

test('bridge splits only its approved Porto route and adds no ferry or duplicate dock nodes', () => {
    const f = fixture(), before = structuredClone(f.options), network = buildJourneyNetwork(f.options);
    const a = network.edges.find(edge => edge.id === `2-4:${BRIDGE_NODES[2].join}`)!;
    const b = network.edges.find(edge => edge.id === `${BRIDGE_NODES[2].join}:2-5`)!;
    const expected = [...port.routes['3:4']].map(point);
    expected.splice(1, 0, point(f.bridge.landings[2].join));
    assert.deepEqual([...a.points!, ...b.points!.slice(1)], expected.map(p => localToAtlas(p, f.placements[2])));
    assert.equal(a.duration + b.duration, .78);
    assert.equal(network.edges.find(edge => edge.id === PORT_FACTORY_BRIDGE_EDGE)!.mode, 'walk');
    assert.equal(network.edges.filter(edge => edge.mode === 'sail').length, 1);
    assert.equal(network.edges.filter(edge => edge.mode === 'board').length, 2);
    assert.equal(network.edges.filter(edge => edge.id === '2-dock-approach').length, 1);
    assert.equal(new Set(network.edges.map(edge => edge.id)).size, network.edges.length);
    assert.deepEqual(f.options, before);
    const noFerry = buildJourneyNetwork({ ...f.options, connectionReady: false });
    assert.equal(noFerry.edges.some(edge => edge.mode !== 'walk'), false);
    const trip = selectJourney(createJourney('2-1', noFerry, f.capabilities), '3-1', noFerry, f.capabilities);
    assert.equal(advanceJourney(trip, 100).arrived, '3-1', 'Bridge readiness does not depend on the ferry.');
});

test('mixed Costa–Factory travel disembarks in Porto and preserves last arrival through bridge reversals', () => {
    const f = fixture(), network = buildJourneyNetwork(f.options);
    let state = selectJourney(createJourney('1-1', network, f.capabilities), '3-2', network, f.capabilities);
    const bridgeIndex = state.legs.findIndex(leg => leg.id === PORT_FACTORY_BRIDGE_EDGE);
    const sailIndex = state.legs.findIndex(leg => leg.mode === 'sail');
    assert.ok(bridgeIndex > sailIndex);
    assert.ok(state.legs.slice(sailIndex + 1, bridgeIndex).some(leg => leg.id === '2-board' && leg.direction === -1));
    state = advanceJourney(state, state.legs.slice(0, bridgeIndex).reduce((sum, leg) => sum + leg.duration, 0) + f.bridge.bridgeDuration * .4);
    assert.equal(state.legs[0].id, PORT_FACTORY_BRIDGE_EDGE);
    assert.equal(state.arrived, '1-1'); assert.equal(journeySaveSelection(state), '1-1');
    assert.equal(canEnterJourney(state, f.capabilities), false);
    const feet = { ...state.point };
    state = selectJourney(state, '1-1', network, f.capabilities);
    assert.deepEqual(state.point, feet); assert.equal(state.legs[0].direction, -1);
    state = selectJourney(state, '3-2', network, f.capabilities);
    assert.deepEqual(state.point, feet); assert.equal(state.legs[0].direction, 1);
    const reloaded = createJourney(journeySaveSelection(state), network, f.capabilities);
    assert.equal(reloaded.arrived, '1-1'); assert.equal(reloaded.destination, null);
    state = advanceJourney(state, 100);
    assert.equal(state.arrived, '3-2'); assert.equal(state.entered, null);
    const returned = selectJourney(state, '1-5', network, f.capabilities);
    assert.equal(advanceJourney(returned, 100).arrived, '1-5');
});

test('bridge skip, reduced motion and locked previews retain explicit entry and existing progression', () => {
    const f = fixture(), network = buildJourneyNetwork(f.options), origin = createJourney('1-1', network, f.capabilities);
    for (const finish of [() => skipJourney(selectJourney(origin, '3-1', network, f.capabilities)),
        () => selectJourney(origin, '3-1', network, f.capabilities, { reducedMotion: true })]) {
        const arrived = finish(); assert.equal(arrived.arrived, '3-1'); assert.equal(arrived.entered, null);
        assert.equal(canEnterJourney(arrived, f.capabilities), true);
    }
    const locked = { availableStages: f.capabilities.availableStages.filter(id => !id.startsWith('3-')) };
    const preview = selectJourney(origin, '3-1', network, locked);
    assert.equal(preview.blocked, 'unavailable'); assert.deepEqual(preview.point, origin.point);
    const closedNetwork = buildJourneyNetwork({ ...f.options, bridgeOpen: false });
    const closed = selectJourney(origin, '3-1', closedNetwork, f.capabilities);
    assert.equal(closed.blocked, 'no-route'); assert.equal(closed.arrived, '1-1');
});

test('shipped bridge and Factory exports form one mixed journey at the approved fixed placements', () => {
    const factory = parseMapMetadata(read('fabrica-diorama'), 3);
    assert.ok(factory, 'The shipped Factory image must retain its matching authored metadata.');
    const bridge = parseJourneyBridge(read('port-factory-bridge'), port, factory, WORLD_ATLAS_PLACEMENTS);
    assert.ok(bridge, 'The shipped bridge must match the approved placements and both existing island paths.');
    assert.equal(bridge.landings[2].join.route, '3:4');
    assert.equal(bridge.landings[3].join.node, '3-1');
    const f = fixture(), islands = f.islands.map(island => island.world === 3
        ? { ...island, metadata: factory, placement: WORLD_ATLAS_PLACEMENTS[3] } : island);
    const network = buildJourneyNetwork({ ...f.options, islands, bridge });
    const trip = selectJourney(createJourney('1-5', network, f.capabilities), '3-5', network, f.capabilities);
    assert.equal(trip.blocked, null);
    assert.equal(trip.legs.filter(leg => leg.mode === 'sail').length, 1);
    assert.equal(trip.legs.filter(leg => leg.id === PORT_FACTORY_BRIDGE_EDGE).length, 1);
    assert.equal(trip.legs.find(leg => leg.id === PORT_FACTORY_BRIDGE_EDGE)!.mode, 'walk');
    assert.equal(journeySaveSelection(trip), '1-5');
    assert.equal(advanceJourney(trip, 100).arrived, '3-5');
    assert.deepEqual(network.nodes['2-berth'], localToAtlas(ferry.docks[2].berth.passenger, WORLD_ATLAS_PLACEMENTS[2]));
    assert.ok(!('3-berth' in network.nodes), 'Factory is reached on foot, with no new ferry berth.');
});
