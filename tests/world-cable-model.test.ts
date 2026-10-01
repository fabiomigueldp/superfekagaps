import test from 'node:test';
import assert from 'node:assert/strict';
import { cableCarAt, cableCarTerminal, cableEdgeDirections, createCablePair, sampleCablePair, updateCablePairAfterTravel,
    type CableFootPaths, type CablePairDefinition, type CablePairState } from '../src/adventure/WorldCableModel';
import { advanceJourney, canEnterJourney, createJourney, enterJourney, journeyMode, journeySaveSelection,
    selectJourney, skipJourney, type JourneyCapabilities, type JourneyNetwork, type JourneyState } from '../src/adventure/WorldJourneyModel';
import { freshSave, parseSave } from '../src/adventure/progress';
import { samplePath } from '../src/adventure/WorldMapModel';

/** Synthetic parallel lanes only: no production placement or camera is approved here. */
const definition: CablePairDefinition = { lanes: {
    a: { rideEdge: 'cable-a', boardingEdges: { lower: 'board-a-lower', upper: 'board-a-upper' },
        berths: { lower: 'a-lower', upper: 'a-upper' } },
    b: { rideEdge: 'cable-b', boardingEdges: { lower: 'board-b-lower', upper: 'board-b-upper' },
        berths: { lower: 'b-lower', upper: 'b-upper' } },
} };
const network: JourneyNetwork = {
    nodes: { '4-3': { x: .1, y: .5 }, '4-4': { x: .5, y: .9 }, '4-5': { x: .9, y: .3 },
        'a-lower': { x: .2, y: .4 }, 'a-upper': { x: .8, y: .2 },
        'b-lower': { x: .2, y: .6 }, 'b-upper': { x: .8, y: .4 } },
    edges: [
        { id: 'main-lower', from: '4-3', to: '4-4', mode: 'walk', duration: 3 },
        { id: 'main-upper', from: '4-4', to: '4-5', mode: 'walk', duration: 3 },
        ...(['a', 'b'] as const).flatMap(car => {
            const lane = definition.lanes[car];
            return [
                { id: lane.boardingEdges.lower, from: '4-3', to: lane.berths.lower, mode: 'cable-board' as const, duration: .5 },
                { id: lane.rideEdge, from: lane.berths.lower, to: lane.berths.upper, mode: 'cable' as const, duration: 2,
                    points: [{ x: .45, y: car === 'a' ? .25 : .45 }] },
                { id: lane.boardingEdges.upper, from: '4-5', to: lane.berths.upper, mode: 'cable-board' as const, duration: .5 },
            ];
        }),
    ],
};
const paths = Object.fromEntries((['a', 'b'] as const).map(car => {
    const lane = definition.lanes[car], ride = network.edges.find(edge => edge.id === lane.rideEdge)!;
    return [car, [network.nodes[lane.berths.lower], ...ride.points!, network.nodes[lane.berths.upper]]];
})) as unknown as CableFootPaths;
const capabilities = (pair: CablePairState, enabled = true, journey?: JourneyState): JourneyCapabilities => ({
    availableStages: ['4-3', '4-4', '4-5'], edgeDirections: cableEdgeDirections(pair, definition, enabled, journey?.legs[0]),
});
function start(from = '4-3') {
    const pair = createCablePair();
    return { pair, journey: createJourney(from, network, capabilities(pair)) };
}
type Session = ReturnType<typeof start>;
const select = (state: Session, target: string, enabled = true): Session => ({ ...state,
    journey: selectJourney(state.journey, target, network, capabilities(state.pair, enabled, state.journey)),
});
function advance(state: Session, seconds: number, reducedMotion = false): Session {
    const journey = advanceJourney(state.journey, seconds, reducedMotion);
    return { journey, pair: updateCablePairAfterTravel(state.pair, definition, state.journey, journey) };
}
function skip(state: Session): Session {
    const journey = skipJourney(state.journey);
    return { journey, pair: updateCablePairAfterTravel(state.pair, definition, state.journey, journey) };
}

test('a waiting car can board at its origin and its future destination always permits disembarkation', () => {
    const pair = createCablePair(), dirs = cableEdgeDirections(pair, definition, true);
    assert.deepEqual(dirs, { 'cable-a': 'forward', 'board-a-lower': 'both', 'board-a-upper': 'reverse',
        'cable-b': 'reverse', 'board-b-lower': 'reverse', 'board-b-upper': 'both' });
    for (const [origin, target, car, direction] of [['4-3', '4-5', 'a', 1], ['4-5', '4-3', 'b', -1]] as const) {
        const state = select(start(origin), target), legs = state.journey.legs;
        assert.equal(state.journey.blocked, null);
        assert.deepEqual(legs.map(leg => leg.mode), ['cable-board', 'cable', 'cable-board']);
        assert.equal(legs[0].direction, 1); assert.equal(legs[1].id, `cable-${car}`);
        assert.equal(legs[1].direction, direction); assert.equal(legs[2].direction, -1);
        assert.equal(advance(state, 100).journey.arrived, target);
    }
});

test('cable travel has explicit boarding, ride and disembark modes, with no ferry mode', () => {
    let state = select(start(), '4-5');
    assert.equal(journeyMode(state.journey), 'cable-board');
    state = advance(state, .5); assert.equal(journeyMode(state.journey), 'cable');
    state = advance(state, 2); assert.equal(journeyMode(state.journey), 'cable-disembark');
    assert.equal(state.pair.aAt, 'upper', 'The ride settles before the final stage arrival.');
    assert.equal(state.journey.arrived, '4-3'); assert.equal(canEnterJourney(state.journey, capabilities(state.pair)), false);
    state = advance(state, .5); assert.equal(journeyMode(state.journey), 'arrived');
    assert.equal(state.journey.arrived, '4-5'); assert.equal(state.journey.entered, null);
    assert.equal(enterJourney(state.journey, capabilities(state.pair)).entered, '4-5');
});

test('partial ride reversals preserve the lane and set the reached terminal without blindly toggling phase', () => {
    let state = advance(select(start(), '4-5'), 1.1);
    assert.equal(journeyMode(state.journey), 'cable');
    const lane = structuredClone(state.journey.legs[0].points), originalPhase = state.pair;
    for (const target of ['4-3', '4-5', '4-3', '4-5', '4-3']) {
        const feet = state.journey.point;
        state = select(state, target);
        assert.deepEqual(state.journey.point, feet); assert.deepEqual(state.journey.legs[0].points, lane);
        assert.equal(state.pair, originalPhase); assert.equal(state.journey.arrived, '4-3');
    }
    assert.equal(state.journey.legs[0].direction, -1);
    state = advance(state, 100);
    assert.equal(state.journey.arrived, '4-3'); assert.equal(state.pair, originalPhase);
    assert.equal(cableCarAt(state.pair, 'lower'), 'a'); assert.equal(cableCarAt(state.pair, 'upper'), 'b');
});

test('near either ride endpoint, all retargets keep the current car and never plan a later absent-car boarding', () => {
    for (const aAt of ['lower', 'upper'] as const) for (const from of ['4-3', '4-5']) {
        const pair: CablePairState = { aAt }, origin = { pair, journey: createJourney(from, network, capabilities(pair)) };
        const target = from === '4-3' ? '4-5' : '4-3';
        for (const fraction of [.001, .05, .5, .95, .999]) {
            const traveling = advance(select(origin, target), .5 + 2 * fraction);
            const carEdge = traveling.journey.legs[0].id;
            assert.equal(journeyMode(traveling.journey), 'cable');
            for (const destination of ['4-3', '4-4', '4-5']) {
                const next = select(traveling, destination);
                assert.deepEqual(next.journey.point, traveling.journey.point);
                assert.deepEqual(next.journey.legs.filter(leg => leg.mode === 'cable').map(leg => leg.id), [carEdge]);
                assert.equal(advance(next, 100).journey.arrived, destination);
            }
        }
    }
});

test('unequal boarding paths cannot route through the other car at its stale pre-ride berth', () => {
    const awkward: JourneyNetwork = { ...network, edges: network.edges.map(edge => ({ ...edge,
        duration: edge.mode === 'walk' ? 30 : edge.mode === 'cable' ? 2 : edge.id === 'board-a-lower' ? 8 : .1,
    })) };
    const pair = createCablePair(), original = createJourney('4-3', awkward, capabilities(pair));
    const outward = selectJourney(original, '4-5', awkward, capabilities(pair));
    for (const seconds of [7.92, 9.9]) {
        const traveling = advanceJourney(outward, seconds);
        const stale = selectJourney(traveling, '4-3', awkward, capabilities(pair));
        assert.ok(stale.legs.some(leg => leg.id === 'cable-b'), 'Without occupied-lane permissions, this fixture exposes the future absent-car route.');
        const cap = capabilities(pair, true, traveling);
        assert.equal(cap.edgeDirections!['cable-b'], 'none');
        assert.equal(cap.edgeDirections!['board-b-upper'], 'reverse');
        assert.equal(cap.edgeDirections!['board-b-lower'], 'reverse');
        const safe = selectJourney(traveling, '4-3', awkward, cap);
        assert.deepEqual(safe.point, traveling.point); assert.equal(safe.legs[0].direction, -1);
        assert.ok(!safe.legs.some(leg => leg.id === 'cable-b'));
        const after = advanceJourney(safe, 100);
        assert.equal(after.arrived, '4-3'); assert.equal(updateCablePairAfterTravel(pair, definition, safe, after), pair);
    }
});

test('both active cable and boarding legs can retreat after all new departures close', () => {
    for (const seconds of [.2, 1.1]) {
        let state = advance(select(start(), '4-5'), seconds), feet = state.journey.point;
        state = select(state, '4-3', false);
        assert.deepEqual(state.journey.point, feet); assert.equal(state.journey.legs[0].direction, -1);
        assert.equal(journeyMode(state.journey), seconds < .5 ? 'cable-disembark' : 'cable');
        state = advance(state, 100);
        assert.equal(state.journey.arrived, '4-3'); assert.equal(state.pair.aAt, 'lower');
    }
    const closed = cableEdgeDirections(createCablePair(), definition, false);
    assert.equal(closed['cable-a'], 'none'); assert.equal(closed['cable-b'], 'none');
    assert.ok(Object.entries(closed).filter(([id]) => id.startsWith('board')).every(([, permission]) => permission === 'reverse'));
});

test('completed ride then main-path return boards the other car at its actual distinct berth', () => {
    const original = structuredClone({ network, definition });
    let state = advance(select(start(), '4-5'), 100);
    assert.equal(state.pair.aAt, 'upper');
    for (const target of ['4-4', '4-3']) {
        state = select(state, target);
        assert.ok(state.journey.legs.every(leg => leg.mode === 'walk'));
        state = advance(state, 100); assert.equal(state.pair.aAt, 'upper');
    }
    state = select(state, '4-5');
    assert.equal(state.journey.legs[0].id, 'board-b-lower'); assert.equal(state.journey.legs[1].id, 'cable-b');
    state = advance(state, .5);
    assert.deepEqual(state.journey.point, network.nodes['b-lower']);
    assert.notDeepEqual(state.journey.point, network.nodes['a-lower']);
    state = advance(state, 100); assert.equal(state.pair.aAt, 'lower');
    assert.deepEqual({ network, definition }, original, 'Neither permissions nor phase updates modify lane geometry.');
});

test('retargeting during disembarkation reboards the car that just arrived without moving the feet', () => {
    let state = advance(select(start(), '4-5'), 2.7);
    assert.equal(state.pair.aAt, 'upper'); assert.equal(journeyMode(state.journey), 'cable-disembark');
    const feet = state.journey.point;
    state = select(state, '4-3');
    assert.deepEqual(state.journey.point, feet);
    assert.equal(state.journey.legs[0].id, 'board-a-upper'); assert.equal(state.journey.legs[0].direction, 1);
    assert.equal(state.journey.legs[1].id, 'cable-a'); assert.equal(state.journey.legs[1].direction, -1);
    state = advance(state, 100); assert.equal(state.pair.aAt, 'lower'); assert.equal(state.journey.arrived, '4-3');
});

test('a ride settles before a subsequent walk to another stage and replaying the update is idempotent', () => {
    let state = select(advance(select(start(), '4-5'), 1.8), '4-4');
    assert.equal(state.journey.legs[0].direction, 1);
    const before = state;
    state = advance(state, 1.4);
    assert.equal(journeyMode(state.journey), 'walk'); assert.equal(state.pair.aAt, 'upper');
    assert.equal(state.journey.destination, '4-4'); assert.equal(journeySaveSelection(state.journey), '4-3');
    assert.equal(updateCablePairAfterTravel(state.pair, definition, before.journey, state.journey), state.pair);
    state = advance(state, 100);
    assert.equal(state.journey.arrived, '4-4'); assert.equal(state.pair.aAt, 'upper');
});

test('upper-origin ride and ground-return cycle uses the other waiting lane in reverse', () => {
    let state = skip(select(start('4-5'), '4-3'));
    assert.equal(state.pair.aAt, 'upper');
    for (const target of ['4-4', '4-5']) {
        state = select(state, target); assert.ok(state.journey.legs.every(leg => leg.mode === 'walk'));
        state = skip(state);
    }
    state = select(state, '4-3');
    assert.equal(state.journey.legs[0].id, 'board-a-upper');
    assert.equal(state.journey.legs[1].id, 'cable-a'); assert.equal(state.journey.legs[1].direction, -1);
    state = advance(state, .5); assert.deepEqual(state.journey.point, network.nodes['a-upper']);
    state = skip(state); assert.equal(state.pair.aAt, 'lower'); assert.equal(state.journey.arrived, '4-3');
});

test('large steps, skip and reduced motion settle the same named car without entering gameplay', () => {
    for (const finish of [(state: Session) => advance(state, 100), skip, (state: Session) => advance(state, 0, true)]) {
        const outward = finish(advance(select(start(), '4-5'), 1.1));
        assert.equal(outward.pair.aAt, 'upper'); assert.equal(outward.journey.arrived, '4-5'); assert.equal(outward.journey.entered, null);
        const reverse = finish(select(advance(select(start(), '4-5'), 1.1), '4-3'));
        assert.equal(reverse.pair.aAt, 'lower'); assert.equal(reverse.journey.arrived, '4-3'); assert.equal(reverse.journey.entered, null);
        const otherCar = finish(select(start('4-5'), '4-3'));
        assert.equal(otherCar.pair.aAt, 'upper'); assert.equal(otherCar.journey.arrived, '4-3');
    }
});

test('closed or unavailable shortcuts retain ground travel, and truthful duration still chooses the shortest route', () => {
    const closed = select(start(), '4-5', false);
    assert.deepEqual(closed.journey.legs.map(leg => leg.id), ['main-lower', 'main-upper']);
    const slow: JourneyNetwork = { ...network, edges: network.edges.map(edge => edge.mode === 'cable' ? { ...edge, duration: 8 } : edge) };
    const state = selectJourney(start().journey, '4-5', slow, capabilities(createCablePair()));
    assert.deepEqual(state.legs.map(leg => leg.id), ['main-lower', 'main-upper']);
    const locked = selectJourney(start().journey, '4-5', network, { ...capabilities(createCablePair()), availableStages: ['4-3'] });
    assert.equal(locked.blocked, 'unavailable'); assert.equal(locked.legs.length, 0);
});

test('locked preview during a ride preserves the actual trip and skip settles its car without entering the preview', () => {
    let state = advance(select(start(), '4-5'), 1.1);
    state = select(state, '5-1');
    assert.equal(state.journey.blocked, 'unavailable'); assert.equal(state.journey.destination, '4-5');
    state = skip(state);
    assert.equal(state.pair.aAt, 'upper'); assert.equal(state.journey.arrived, '4-5');
    assert.equal(state.journey.selected, '5-1'); assert.equal(canEnterJourney(state.journey, capabilities(state.pair)), false);
});

test('reload retains only last stage arrival and resets a valid pair with a car at either station', () => {
    const beforeRide = advance(select(start(), '4-5'), 1.1);
    const afterRide = advance(select(start(), '4-5'), 2.7);
    const finished = skip(afterRide);
    for (const state of [beforeRide, afterRide, finished]) {
        const save = freshSave(); save.selected = journeySaveSelection(state.journey);
        const parsed = parseSave(JSON.stringify(save)), pair = createCablePair();
        const journey = createJourney(parsed.selected, network, capabilities(pair));
        assert.equal(journey.arrived, state === finished ? '4-5' : '4-3');
        assert.equal(journey.destination, null); assert.equal(pair.aAt, 'lower');
        assert.equal(cableCarTerminal(pair, cableCarAt(pair, 'lower')), 'lower');
        assert.equal(cableCarTerminal(pair, cableCarAt(pair, 'upper')), 'upper');
        const next = select({ pair, journey }, state === finished ? '4-3' : '4-5');
        assert.equal(next.journey.legs.find(leg => leg.mode === 'cable')!.id, state === finished ? 'cable-b' : 'cable-a');
        assert.deepEqual(Object.keys(parsed).sort(), Object.keys(freshSave()).sort());
    }
});

test('phase transitions ignore walking and ferry legs and leave all inputs unchanged', () => {
    const pair = createCablePair(), before = select(start(), '4-5').journey;
    const inputs = structuredClone({ pair, before, definition }), after = advanceJourney(before, 100);
    assert.deepEqual(updateCablePairAfterTravel(pair, definition, before, after), { aAt: 'upper' });
    assert.deepEqual({ pair, before, definition }, inputs);
    for (const mode of ['walk', 'board', 'sail'] as const) {
        const unrelated: JourneyState = { ...before, legs: before.legs.map(leg => ({ ...leg, mode })) };
        assert.equal(updateCablePairAfterTravel(pair, definition, unrelated, skipJourney(unrelated)), pair);
    }
    assert.equal(updateCablePairAfterTravel(pair, definition, before, advanceJourney(before, .1)), pair);
});

test('pair pose keeps both cars at fixed lane endpoints during boarding and ordinary walking', () => {
    for (const aAt of ['lower', 'upper'] as const) {
        const pair: CablePairState = { aAt }, pose = sampleCablePair(pair, definition, paths)!;
        assert.equal(pose.movingCar, null);
        for (const car of ['a', 'b'] as const)
            assert.deepEqual(pose.feet[car], network.nodes[definition.lanes[car].berths[cableCarTerminal(pair, car)]]);
        for (const mode of ['walk', 'cable-board', 'sail'] as const)
            assert.deepEqual(sampleCablePair(pair, definition, paths, { id: 'board-a-lower', mode, progress: .6 }), pose);
    }
});

test('pair pose follows the occupied car and counterbalances its partner on unchanged lanes through reversal', () => {
    const original = structuredClone(paths);
    for (const from of ['4-3', '4-5']) {
        let state = advance(select(start(from), from === '4-3' ? '4-5' : '4-3'), 1.1);
        const car = from === '4-3' ? 'a' : 'b', other = car === 'a' ? 'b' : 'a';
        const pose = sampleCablePair(state.pair, definition, paths, state.journey.legs[0])!;
        assert.equal(pose.movingCar, car); assert.deepEqual(pose.feet[car], state.journey.point);
        assert.deepEqual(pose.feet[other], samplePath(paths[other], 1 - state.journey.legs[0].progress));
        state = select(state, from);
        assert.deepEqual(sampleCablePair(state.pair, definition, paths, state.journey.legs[0]), pose);
        state = advance(state, .1);
        const moved = sampleCablePair(state.pair, definition, paths, state.journey.legs[0])!;
        assert.deepEqual(moved.feet[car], state.journey.point); assert.notDeepEqual(moved.feet[other], pose.feet[other]);
        state = skip(state);
        const parked = sampleCablePair(state.pair, definition, paths)!;
        assert.equal(parked.movingCar, null);
        assert.deepEqual(parked.feet[car], network.nodes[definition.lanes[car].berths[from === '4-3' ? 'lower' : 'upper']]);
    }
    assert.deepEqual(paths, original);
});

test('pair pose rejects incomplete/nonfinite paths and cannot fabricate a car for invalid progress', () => {
    const pair = createCablePair();
    assert.equal(sampleCablePair(pair, definition, { ...paths, a: [] }), null);
    assert.equal(sampleCablePair(pair, definition, { ...paths, b: [{ x: NaN, y: .3 }, { x: .8, y: .4 }] }), null);
    assert.equal(sampleCablePair(pair, definition, paths, { id: 'cable-a', mode: 'cable', progress: Infinity }), null);
    const parked = sampleCablePair(pair, definition, paths)!;
    assert.deepEqual(sampleCablePair(pair, definition, paths, { id: 'unrelated', mode: 'cable', progress: .7 }), parked);
    assert.deepEqual(sampleCablePair(pair, definition, paths, { id: 'cable-a', mode: 'cable', progress: -1 })!.feet, parked.feet);
});
