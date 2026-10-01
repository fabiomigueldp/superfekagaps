import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COAST_PORT_PLACEMENTS, localToAtlas } from '../src/adventure/WorldAtlasModel';
import { fallbackMapMetadata, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { advanceJourney, createJourney, selectJourney, type JourneyCapabilities } from '../src/adventure/WorldJourneyModel';
import { buildJourneyNetwork, parseJourneyBoat, parseJourneyConnection, type JourneyIsland } from '../src/adventure/WorldJourneyNetwork';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
const coast = parseMapMetadata(read('costa-diorama'), 1)!;
const port = parseMapMetadata(read('porto-diorama'), 2)!;
const boatRaw = read('journey-boat');
const connectionRaw = read('coast-port-journey');
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const islands: JourneyIsland[] = Array.from({ length: 6 }, (_, index) => ({ world: index + 1,
    metadata: index === 0 ? coast : index === 1 ? port : fallbackMapMetadata(index + 1),
    placement: COAST_PORT_PLACEMENTS[index + 1] ?? { origin: { x: 0, y: 0 }, scale: 1 }, ready: true }));
const capabilities: JourneyCapabilities = { availableStages: islands.flatMap(island => Object.keys(island.metadata.nodes)) };
const parsedConnection = () => {
    const result = parseJourneyConnection(connectionRaw, coast, port);
    assert.ok(result, 'Shipped connection must validate against the shipped island cameras and sailing route');
    return result;
};

test('shipped boat atlas normalizes checked crops and passenger anchors for the painter', () => {
    const result = parseJourneyBoat(boatRaw);
    assert.ok(result);
    assert.equal(result.frames.length, boatRaw.frames.length);
    assert.equal(result.atlas.path, boatRaw.atlas.path);
    for (const frame of result.frames) {
        assert.equal(frame.rear?.w, boatRaw.frame.width);
        assert.equal(frame.foreground?.h, boatRaw.frame.height);
        assert.deepEqual(frame.passengerFoot, boatRaw.frames[frame.index].passengerFootPixels);
        assert.deepEqual(frame.waterlineAnchor, boatRaw.frames[frame.index].waterlineAnchorPixels);
        assert.equal(frame.passengerPixelScale, 3);
    }
});

test('boat parser rejects unsafe paths, invalid crops, nonfinite headings and inconsistent anchors', () => {
    const mutations = [
        (data: typeof boatRaw) => { data.atlas.path = 'https://example.test/boat.webp'; },
        (data: typeof boatRaw) => { data.atlas.path = '/assets/world/map/../boat.webp'; },
        (data: typeof boatRaw) => { data.frames[0].sourceRects.base.width = 385; },
        (data: typeof boatRaw) => { data.frames[0].sourceRects.foreground.x = data.atlas.width; },
        (data: typeof boatRaw) => { data.frames[0].screenHeadingRadians = Infinity; },
        (data: typeof boatRaw) => { data.frames[0].passengerFootPixels.x += 10; },
        (data: typeof boatRaw) => { data.frames[0].waterlineAnchorPixels.x += 10; },
        (data: typeof boatRaw) => { data.headingProjection = { xAxis: { x: 1, y: 0 }, yAxis: { x: 1, y: 0 } }; },
        (data: typeof boatRaw) => { data.frames[0].index = 7; },
        (data: typeof boatRaw) => { data.passengerPixelScale = 0; },
    ];
    for (const mutate of mutations) { const data = clone(boatRaw); mutate(data); assert.equal(parseJourneyBoat(data), null); }
});

test('dense boat metadata requires ordered uniform headings and a finite independent projection basis', () => {
    for (const count of [32, 64]) {
        const data = clone(boatRaw), width = data.frame.width, height = data.frame.height;
        data.atlas.width = width * 8; data.atlas.height = height * count / 4;
        data.headingProjection = { xAxis: { x: 80, y: 20 }, yAxis: { x: 40, y: -40 } };
        data.frames = Array.from({ length: count }, (_, index) => {
            const frame = clone(boatRaw.frames[index % boatRaw.frames.length]);
            frame.index = index; frame.worldHeadingRadians = index * Math.PI * 2 / count;
            frame.sourceRects.base = { x: index % 8 * width, y: Math.floor(index / 8) * height, width, height };
            frame.sourceRects.foreground = { ...frame.sourceRects.base, y: frame.sourceRects.base.y + count / 8 * height };
            return frame;
        });
        const parsed = parseJourneyBoat(data); assert.ok(parsed); assert.equal(parsed.frames.length, count);
        for (const mutate of [
            (value: typeof data) => { value.frames[1].worldHeadingRadians = value.frames[0].worldHeadingRadians; },
            (value: typeof data) => { [value.frames[1].worldHeadingRadians, value.frames[2].worldHeadingRadians] = [value.frames[2].worldHeadingRadians, value.frames[1].worldHeadingRadians]; },
            (value: typeof data) => { delete value.headingProjection; },
            (value: typeof data) => { value.headingProjection.xAxis.x = Infinity; },
            (value: typeof data) => { value.headingProjection.yAxis = value.headingProjection.xAxis; },
        ]) { const invalid = clone(data); mutate(invalid); assert.equal(parseJourneyBoat(invalid), null); }
    }
});

test('shipped connection validates the route junction, docks and fixed atlas berth endpoints', () => {
    const parsed = parsedConnection();
    assert.equal(parsed.docks[1].join.route, '2:3');
    assert.equal(parsed.docks[2].join.node, '2-1');
    assert.equal(parsed.docks[1].overlay.path, '/assets/world/map/costa-journey-dock.webp');
    assert.deepEqual(parsed.sailRoute[0], localToAtlas(parsed.docks[1].berth.passenger, COAST_PORT_PLACEMENTS[1]));
    const portEnd = localToAtlas(parsed.docks[2].berth.passenger, COAST_PORT_PLACEMENTS[2]);
    assert.ok(Math.hypot(parsed.sailRoute.at(-1)!.x - portEnd.x, parsed.sailRoute.at(-1)!.y - portEnd.y) < 1e-10);
    assert.ok(parsed.sailDuration > 0);
    assert.deepEqual(parsed.segmentHeadings, connectionRaw.sailRoute.segmentHeadings);
    assert.deepEqual(parsed.reverseSegmentHeadings, connectionRaw.sailRoute.reverseSegmentHeadings);
});

test('connection parser rejects wrong junctions/endpoints, crop sizes, unsafe assets and nonfinite coordinates', () => {
    const mutations = [
        (data: typeof connectionRaw) => { data.islands.costa.join.x += .01; },
        (data: typeof connectionRaw) => { data.islands.costa.join.segment = 999; },
        (data: typeof connectionRaw) => { data.islands.porto.join.node = '2-2'; },
        (data: typeof connectionRaw) => { data.islands.porto.boardingRoute[0].x += .01; },
        (data: typeof connectionRaw) => { data.islands.costa.berth.passenger.y = NaN; },
        (data: typeof connectionRaw) => { data.islands.costa.overlay.width += 20; },
        (data: typeof connectionRaw) => { data.islands.porto.overlay.path = '/other/dock.webp'; },
        (data: typeof connectionRaw) => { data.boatMetadata = '//example.test/boat.json'; },
        (data: typeof connectionRaw) => { data.sailRoute.points[0].x += .1; },
        (data: typeof connectionRaw) => { data.sailRoute.points[1].y = Infinity; },
        (data: typeof connectionRaw) => { data.sailRoute.segmentHeadings = []; },
        (data: typeof connectionRaw) => { data.sailRoute.segmentHeadings[0] = 8; },
        (data: typeof connectionRaw) => { data.sailRoute.reverseSegmentHeadings = []; },
        (data: typeof connectionRaw) => { data.sailRoute.reverseSegmentHeadings[0] = .5; },
        (data: typeof connectionRaw) => { data.sailRoute.reverseSegmentHeadings[0] = -1; },
        (data: typeof connectionRaw) => { data.placements.porto.origin.x += .1; },
    ];
    parsedConnection();
    for (const mutate of mutations) { const data = clone(connectionRaw); mutate(data); assert.equal(parseJourneyConnection(data, coast, port), null); }
});

test('crossing remains closed until every paired asset and matching island snapshot is ready', () => {
    const connection = parsedConnection();
    const variants = [
        { islands, connection, connectionReady: false },
        { islands, connection: null, connectionReady: true },
        { islands: islands.map(island => ({ ...island, ready: island.world !== 1 })), connection, connectionReady: true },
        { islands: islands.map(island => ({ ...island, ready: island.world !== 2 })), connection, connectionReady: true },
        { islands: islands.map(island => island.world === 1 ? { ...island, metadata: fallbackMapMetadata(1) } : island), connection, connectionReady: true },
        { islands: islands.map(island => island.world === 2 ? { ...island, placement: { ...island.placement, scale: 2 } } : island), connection, connectionReady: true },
    ];
    for (const variant of variants) {
        const network = buildJourneyNetwork({ ...variant, secrets: [] });
        assert.equal(network.edges.some(edge => edge.mode !== 'walk'), false);
        const state = selectJourney(createJourney('1-1', network, capabilities), '2-1', network, capabilities);
        assert.equal(state.blocked, 'no-route');
        assert.equal(state.arrived, '1-1');
    }
});

test('connected graph splits only Costa’s authored junction and keeps every path corner', () => {
    const connection = parsedConnection(), original = JSON.stringify({ islands, connection });
    const network = buildJourneyNetwork({ islands, connection, connectionReady: true, secrets: [] });
    const before = network.edges.find(edge => edge.id === '1-3:1-junction')!;
    const after = network.edges.find(edge => edge.id === '1-junction:1-4')!;
    const combined = [...before.points!, ...after.points!.slice(1)];
    const expected = [...coast.routes['2:3']];
    expected.splice(connection.docks[1].join.segment! + 1, 0, { x: connection.docks[1].join.x, y: connection.docks[1].join.y });
    assert.deepEqual(combined, expected);
    assert.equal(network.edges.filter(edge => edge.mode === 'sail').length, 1);
    assert.equal(network.edges.filter(edge => edge.mode === 'board').length, 2);
    assert.deepEqual(network.edges.find(edge => edge.id === 'coast-port-sail')!.points, connection.sailRoute);
    assert.equal(JSON.stringify({ islands, connection }), original);
    let state = selectJourney(createJourney('1-1', network, capabilities), '2-2', network, capabilities);
    assert.equal(state.blocked, null);
    assert.deepEqual([...new Set(state.legs.map(leg => leg.mode))], ['walk', 'board', 'sail']);
    state = advanceJourney(state, 100);
    assert.equal(state.arrived, '2-2');
    assert.equal(state.entered, null);
    state = selectJourney(state, '1-5', network, capabilities);
    assert.equal(state.blocked, null);
    assert.equal(advanceJourney(state, 100).arrived, '1-5');
});

test('secret shortcuts remain gated and all six worlds retain their local phase navigation', () => {
    const connection = parsedConnection();
    const closed = buildJourneyNetwork({ islands, connection, connectionReady: true, secrets: [] });
    assert.equal(closed.edges.some(edge => edge.id.endsWith('-secret')), false);
    const opened = buildJourneyNetwork({ islands, connection, connectionReady: true, secrets: ['1-3', '2-3'] });
    assert.deepEqual(opened.edges.filter(edge => edge.id.endsWith('-secret')).map(edge => edge.id), ['1-secret', '2-secret']);
    for (let world = 1; world <= 6; world++) {
        const start = createJourney(`${world}-1`, opened, capabilities);
        const arrived = advanceJourney(selectJourney(start, `${world}-5`, opened, capabilities), 100);
        assert.equal(arrived.arrived, `${world}-5`);
    }
    const unavailable = selectJourney(createJourney('2-1', opened, capabilities), '3-1', opened, capabilities);
    assert.equal(unavailable.blocked, 'no-route');
    assert.equal(unavailable.arrived, '2-1');
});
