import test from 'node:test';
import assert from 'node:assert/strict';
import { COAST_PORT_FERRY, createFerry, ferryEdgeDirections, journeyPathSegment, sampleFerry, updateFerryAfterTravel,
    type FerryDefinition, type FerryGeometry, type FerryState } from '../src/adventure/WorldFerryModel';
import { advanceJourney, canEnterJourney, createJourney, journeySaveSelection, selectJourney, skipJourney,
    type JourneyCapabilities, type JourneyLeg, type JourneyNetwork, type JourneyState } from '../src/adventure/WorldJourneyModel';
import { samplePath } from '../src/adventure/WorldMapModel';
import { freshSave, parseSave } from '../src/adventure/progress';

const dominio: FerryDefinition = { id: 'reserva-dominio-sail', sailEdge: 'reserva-dominio-sail', worlds: [5, 6],
    boardingEdges: { 5: '5-board', 6: '6-board' }, berths: { 5: '5-berth', 6: '6-berth' } };
const definitions = [COAST_PORT_FERRY, dominio];
const point = (x: number, y: number) => ({ x, y });
const network: JourneyNetwork = {
    nodes: { '1-5': point(0, 0), '1-berth': point(.1, .1), '2-berth': point(1, .2), '2-1': point(1.1, .1),
        '5-5': point(3, .1), '5-berth': point(3.1, .2), '6-berth': point(4, .1), '6-1': point(4.1, 0) },
    edges: [
        { id: '1-board', from: '1-5', to: '1-berth', mode: 'board', duration: 1 },
        { id: 'coast-port-sail', from: '1-berth', to: '2-berth', mode: 'sail', duration: 4,
            points: [point(.1, .1), point(.5, .5), point(1, .2)] },
        { id: '2-board', from: '2-1', to: '2-berth', mode: 'board', duration: 1 },
        { id: 'land-through-middle-worlds', from: '2-1', to: '5-5', mode: 'walk', duration: 2 },
        { id: '5-board', from: '5-5', to: '5-berth', mode: 'board', duration: 1 },
        { id: 'reserva-dominio-sail', from: '5-berth', to: '6-berth', mode: 'sail', duration: 5,
            points: [point(3.1, .2), point(3.5, .5), point(4, .1)] },
        { id: '6-board', from: '6-1', to: '6-berth', mode: 'board', duration: 1 },
    ],
};
const geometry: FerryGeometry[] = definitions.map(definition => ({
    berths: Object.fromEntries(definition.worlds.map((world, i) => [world,
        { foot: network.nodes[definition.berths[world]], headingFrame: i ? 6 : 2 }])),
    segmentHeadings: [3, 1], reverseSegmentHeadings: [5, 7],
}));
interface Session { ferries: FerryState[]; journey: JourneyState }
const capabilities = (ferries: FerryState[], enabled = true): JourneyCapabilities => ({ availableStages: ['1-5', '2-1', '5-5', '6-1'],
    edgeDirections: Object.assign({}, ...ferries.map((ferry, index) => ferryEdgeDirections(ferry, definitions[index], enabled))),
});
const start = (stage = '1-5'): Session => {
    const ferries = definitions.map(definition => createFerry(definition, Number(stage[0])));
    return { ferries, journey: createJourney(stage, network, capabilities(ferries)) };
};
const select = (session: Session, stage: string, enabled = true): Session => ({ ...session,
    journey: selectJourney(session.journey, stage, network, capabilities(session.ferries, enabled)) });
const consume = (session: Session, mode: number | 'skip' | 'reduced'): Session => {
    const journey = mode === 'skip' ? skipJourney(session.journey) : advanceJourney(session.journey, mode === 'reduced' ? 0 : mode, mode === 'reduced');
    return { journey, ferries: session.ferries.map((ferry, index) => updateFerryAfterTravel(ferry, definitions[index], session.journey, journey)) };
};
const poses = (session: Session, time = 0) => definitions.map((definition, index) => sampleFerry(session.ferries[index], definition, geometry[index],
    { active: session.journey.legs[0], point: session.journey.point, time }));

test('released coast IDs remain intact and independent reload seeds cover all actual campaign worlds', () => {
    assert.deepEqual(COAST_PORT_FERRY, { id: 'coast-port-sail', sailEdge: 'coast-port-sail', worlds: [1, 2],
        boardingEdges: { 1: '1-board', 2: '2-board' }, berths: { 1: '1-berth', 2: '2-berth' } });
    for (let world = 1; world <= 6; world++) {
        assert.equal(createFerry(COAST_PORT_FERRY, world).mooredWorld, world === 1 ? 1 : 2);
        assert.equal(createFerry(dominio, world).mooredWorld, world === 6 ? 6 : 5);
    }
    const fresh = freshSave(), restored = parseSave(JSON.stringify({ ...fresh, selected: '6-1', completed: [] }));
    const recovered = createJourney(restored.selected, network, { availableStages: ['1-5', '2-1', '5-5'] });
    assert.equal(recovered.arrived, '5-5'); assert.equal(createFerry(dominio, Number(recovered.arrived[0])).mooredWorld, 5);
    assert.deepEqual(Object.keys(restored), Object.keys(fresh), 'No ferry/session fields enter the save schema.');
});

test('one route consumes both ferries sequentially without moving the unrelated hull', () => {
    let session = select(start(), '6-1');
    assert.deepEqual(session.journey.legs.filter(leg => leg.mode === 'sail').map(leg => leg.id), definitions.map(definition => definition.sailEdge));
    const newAtStart = poses(session)[1];
    session = consume(session, 2);
    assert.equal(session.journey.legs[0].id, COAST_PORT_FERRY.sailEdge);
    assert.deepEqual(poses(session, 500)[1].foot, newAtStart.foot);
    assert.equal(poses(session, 500)[1].frameIndex, newAtStart.frameIndex);
    assert.deepEqual(session.ferries.map(ferry => ferry.mooredWorld), [1, 5]);
    session = consume(session, 7.5);
    assert.equal(session.journey.legs[0].id, dominio.sailEdge);
    assert.deepEqual(session.ferries.map(ferry => ferry.mooredWorld), [2, 5]);
    const coastAtPort = poses(session)[0];
    session = consume(session, 3);
    assert.deepEqual(poses(session, 1000)[0].foot, coastAtPort.foot);
    assert.equal(poses(session, 1000)[0].frameIndex, coastAtPort.frameIndex);
    session = consume(session, 100);
    assert.deepEqual(session.ferries.map(ferry => ferry.mooredWorld), [2, 6]);
    assert.equal(session.journey.arrived, '6-1'); assert.equal(canEnterJourney(session.journey, capabilities(session.ferries)), true);
    assert.equal(session.journey.entered, null); assert.equal(journeySaveSelection(session.journey), '6-1');
    session = consume(select(session, '1-5'), 'skip');
    assert.deepEqual(session.ferries.map(ferry => ferry.mooredWorld), [1, 5]);
});

test('partial and repeatedly reversed rides leave mooring untouched until the actual endpoint is consumed', () => {
    for (const [from, to, ferryIndex] of [['1-5', '2-1', 0], ['5-5', '6-1', 1]] as const) {
        let session = consume(select(start(from), to), 2), original = session.ferries;
        const activeId = session.journey.legs[0].id, path = session.journey.legs[0].points;
        for (const target of [from, to, from, to, from]) {
            const foot = session.journey.point;
            session = select(session, target);
            assert.deepEqual(session.journey.point, foot); assert.equal(session.journey.legs[0].id, activeId);
            assert.deepEqual(session.journey.legs[0].points, path); assert.equal(session.ferries, original);
        }
        assert.equal(session.journey.legs[0].direction, -1);
        session = consume(session, 100);
        assert.equal(session.journey.arrived, from); assert.equal(session.ferries[ferryIndex], original[ferryIndex]);
        session = consume(select(session, to), 100);
        assert.equal(session.ferries[ferryIndex].mooredWorld, Number(to[0]));
    }
});

test('skip, large deltas and reduced motion consume matching sailing legs identically and keep explicit entry', () => {
    for (const mode of ['skip', 'reduced', 100] as const) {
        const forward = consume(select(start(), '6-1'), mode);
        assert.deepEqual(forward.ferries.map(ferry => ferry.mooredWorld), [2, 6]);
        assert.equal(forward.journey.arrived, '6-1'); assert.equal(forward.journey.entered, null);
        const backward = consume(select(forward, '1-5'), mode);
        assert.deepEqual(backward.ferries.map(ferry => ferry.mooredWorld), [1, 5]);
        assert.equal(backward.journey.arrived, '1-5'); assert.equal(backward.journey.entered, null);
    }
});

test('boarding gates forbid absent hulls but allow future disembark and active ride retreat after closure', () => {
    const original = start('5-5'), permissions = ferryEdgeDirections(original.ferries[1], dominio, true);
    assert.deepEqual(permissions, { 'reserva-dominio-sail': 'forward', '5-board': 'both', '6-board': 'reverse' });
    const absent = { ...original, journey: createJourney('6-1', network, capabilities(original.ferries)) };
    assert.equal(select(absent, '5-5').journey.blocked, 'no-route');
    for (const seconds of [.4, 2]) {
        const traveling = consume(select(original, '6-1'), seconds), foot = traveling.journey.point;
        const retreat = select(traveling, '5-5', false);
        assert.deepEqual(retreat.journey.point, foot); assert.equal(retreat.journey.legs[0].direction, -1);
        assert.equal(consume(retreat, 100).journey.arrived, '5-5');
    }
    const closed = ferryEdgeDirections(original.ferries[1], dominio, false);
    assert.deepEqual(closed, { 'reserva-dominio-sail': 'none', '5-board': 'reverse', '6-board': 'reverse' });
});

test('mooring updates before disembark retargets; rapid reboarding uses the hull that just arrived', () => {
    let session = consume(select(start('5-5'), '6-1'), 6.25);
    assert.equal(session.ferries[1].mooredWorld, 6); assert.equal(session.journey.legs[0].id, '6-board');
    const foot = session.journey.point;
    session = select(session, '5-5');
    assert.deepEqual(session.journey.point, foot); assert.equal(session.journey.legs[0].direction, 1);
    assert.equal(session.journey.legs[1].id, dominio.sailEdge); assert.equal(session.journey.legs[1].direction, -1);
    assert.equal(consume(session, 100).ferries[1].mooredWorld, 5);
});

test('only consumed matching sail modes update mooring, even if a later leg repeats the same ID', () => {
    const session = start('5-5'), planned = select(session, '6-1').journey;
    const sail = planned.legs.find(leg => leg.id === dominio.sailEdge)!;
    const repeated = { ...planned, legs: [sail, { ...sail, direction: -1 as const, progress: 1 }] };
    const afterFirst = advanceJourney(repeated, sail.duration);
    assert.equal(afterFirst.legs[0].id, sail.id);
    assert.equal(updateFerryAfterTravel(session.ferries[1], dominio, repeated, afterFirst).mooredWorld, 6);
    for (const leg of [{ ...sail, id: COAST_PORT_FERRY.sailEdge }, { ...sail, mode: 'board' as const }]) {
        const before = { ...planned, legs: [leg] }, after = skipJourney(before);
        assert.equal(updateFerryAfterTravel(session.ferries[1], dominio, before, after), session.ferries[1]);
    }
});

test('sampling boarding, walking, idle and another sail snaps each parked hull to its own real berth', () => {
    const session = start('5-5'), definition = dominio, dock = geometry[1].berths[5];
    const state = { ...session.ferries[1], headingIndex: 7, headingAt: 0 };
    const base = select(session, '6-1').journey.legs[0];
    for (const active of [undefined, base, { ...base, mode: 'walk' as const },
        { ...base, id: COAST_PORT_FERRY.sailEdge, mode: 'sail' as const }]) {
        const pose = sampleFerry(state, definition, geometry[1], { active, point: point(99, 99), time: 1 });
        assert.deepEqual(pose.foot, dock.foot); assert.equal(pose.frameIndex, dock.headingFrame);
        assert.equal(pose.state.mooredWorld, 5); assert.equal(state.headingIndex, 7, 'Sampling cannot mutate input.');
    }
});

test('each ferry has independent 120ms shortest-heading easing and reduced motion snaps', () => {
    const coastLeg = consume(select(start(), '2-1'), 2).journey.legs[0];
    const newLeg = consume(select(start('5-5'), '6-1'), 2).journey.legs[0];
    let coast = { ...createFerry(COAST_PORT_FERRY, 1), headingIndex: 0, headingAt: 100 };
    let ferry = { ...createFerry(dominio, 5), headingIndex: 7, headingAt: 180 };
    const sampleCoast = (time: number) => sampleFerry(coast, COAST_PORT_FERRY, geometry[0], { active: coastLeg, time });
    assert.equal(sampleCoast(219).frameIndex, 0);
    coast = sampleCoast(220).state; assert.equal(coast.headingIndex, 1);
    assert.equal(sampleFerry(ferry, dominio, geometry[1], { active: newLeg, time: 299 }).frameIndex, 7);
    ferry = sampleFerry(ferry, dominio, geometry[1], { active: newLeg, time: 300 }).state;
    assert.equal(ferry.headingIndex, 0); assert.equal(coast.headingAt, 220);
    assert.equal(sampleFerry(coast, COAST_PORT_FERRY, geometry[0], { active: coastLeg, time: 221, reducedMotion: true }).frameIndex, 3);
});

test('heading knots follow the exact path metric in either direction and preserve final .65 second docking behavior', () => {
    const session = consume(select(start('5-5'), '6-1'), 2), original = session.journey.legs[0];
    const lengths = original.points.slice(1).map((p, i) => Math.hypot((p.x - original.points[i].x) * 1.6, p.y - original.points[i].y));
    const boundary = lengths[0] / (lengths[0] + lengths[1]);
    for (const direction of [1, -1] as const) for (const offset of [-1e-6, 1e-6]) {
        const active: JourneyLeg = { ...original, direction, progress: boundary + offset };
        const segment = journeyPathSegment(active.points, active.progress);
        assert.equal(segment, offset < 0 ? 0 : 1);
        const heading = direction === 1 ? geometry[1].segmentHeadings[segment] : geometry[1].reverseSegmentHeadings[1 - segment];
        const pose = sampleFerry(session.ferries[1], dominio, geometry[1], { active, time: 0, reducedMotion: true });
        assert.equal(pose.frameIndex, heading); assert.deepEqual(pose.foot, samplePath(active.points, active.progress));
    }
    for (const direction of [1, -1] as const) {
        const active = { ...original, direction, progress: direction === 1 ? .9 : .1 };
        assert.equal(sampleFerry(session.ferries[1], dominio, geometry[1], { active, time: 0, reducedMotion: true }).frameIndex,
            geometry[1].berths[direction === 1 ? 6 : 5].headingFrame);
    }
});

test('explicit reload from last reached stage discards in-flight state without new save fields', () => {
    const traveling = consume(select(start('5-5'), '6-1'), 3);
    const stage = journeySaveSelection(traveling.journey), restored = start(stage);
    assert.equal(stage, '5-5'); assert.equal(restored.journey.legs.length, 0);
    assert.deepEqual(restored.ferries.map(ferry => ferry.mooredWorld), [2, 5]);
    const reached = consume(traveling, 'skip'), reloaded = start(journeySaveSelection(reached.journey));
    assert.deepEqual(reloaded.ferries.map(ferry => ferry.mooredWorld), [2, 6]);
});
