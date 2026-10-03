import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/adventure/campaign';
import { finishStage, freshSave, isUnlocked, parseSave } from '../src/adventure/progress';
import { advanceJourney, canEnterJourney, createJourney, enterJourney, journeyBlockReason, journeyMode,
    journeySaveSelection, returnToJourney, selectJourney, skipJourney,
    type JourneyCapabilities, type JourneyEdgeDirection, type JourneyNetwork, type JourneyState } from '../src/adventure/WorldJourneyModel';

const network: JourneyNetwork = {
    nodes: {
        '1-1': { x: .1, y: .4 }, '1-2': { x: .2, y: .3 }, '1-3': { x: .25, y: .2 },
        'coast-dock': { x: .3, y: .4 }, 'coast-boat': { x: .35, y: .45 },
        'port-boat': { x: .65, y: .5 }, 'port-dock': { x: .7, y: .45 },
        '2-1': { x: .8, y: .4 }, '2-2': { x: .9, y: .3 },
    },
    edges: [
        { id: 'coast-trail', from: '1-1', to: '1-2', mode: 'walk', duration: 2,
            points: [{ x: .1, y: .3 }, { x: .15, y: .28 }] },
        { id: 'coast-path', from: '1-2', to: '1-3', mode: 'walk', duration: 1 },
        { id: 'coast-dock-path', from: '1-2', to: 'coast-dock', mode: 'walk', duration: 1 },
        { id: 'coast-board', from: 'coast-dock', to: 'coast-boat', mode: 'board', duration: 1 },
        { id: 'crossing', from: 'coast-boat', to: 'port-boat', mode: 'sail', duration: 4,
            points: [{ x: .4, y: .55 }, { x: .6, y: .57 }] },
        { id: 'port-board', from: 'port-dock', to: 'port-boat', mode: 'board', duration: 1 },
        { id: 'port-dock-path', from: 'port-dock', to: '2-1', mode: 'walk', duration: 1 },
        { id: 'port-trail', from: '2-1', to: '2-2', mode: 'walk', duration: 1 },
    ],
};
const capabilities: JourneyCapabilities = { availableStages: ['1-1', '1-2', '1-3', '2-1', '2-2'] };
const select = (state: JourneyState, id: string) => selectJourney(state, id, network, capabilities);
const initial = () => createJourney('1-1', network, capabilities);

test('selection, physical arrival and explicit entry are separate states', () => {
    const state = select(initial(), '2-1');
    assert.equal(state.selected, '2-1');
    assert.equal(state.arrived, '1-1');
    assert.equal(state.destination, '2-1');
    assert.equal(state.entered, null);
    assert.equal(canEnterJourney(state, capabilities), false);
    assert.equal(enterJourney(state, capabilities), state);
    const arrived = advanceJourney(state, 10);
    assert.equal(arrived.arrived, '2-1');
    assert.equal(arrived.entered, null);
    assert.equal(arrived.destination, null);
    assert.deepEqual(arrived.point, network.nodes['2-1']);
    assert.equal(canEnterJourney(arrived, capabilities), true);
    const entered = enterJourney(arrived, capabilities);
    assert.equal(entered.entered, '2-1');
    assert.equal(journeyMode(entered), 'entered');
    assert.equal(canEnterJourney(entered, capabilities), false);
    assert.equal(select(entered, '1-1'), entered);
});

test('Costa to Porto walks to a dock, boards, sails, disembarks and walks to the phase', () => {
    let state = select(initial(), '2-1');
    assert.equal(journeyMode(state), 'walk');
    state = advanceJourney(state, 3);
    assert.equal(journeyMode(state), 'board');
    assert.deepEqual(state.point, network.nodes['coast-dock']);
    state = advanceJourney(state, 1);
    assert.equal(journeyMode(state), 'sail');
    assert.deepEqual(state.point, network.nodes['coast-boat']);
    state = advanceJourney(state, 4);
    assert.equal(journeyMode(state), 'disembark');
    assert.deepEqual(state.point, network.nodes['port-boat']);
    state = advanceJourney(state, 1);
    assert.equal(journeyMode(state), 'walk');
    assert.deepEqual(state.point, network.nodes['port-dock']);
    state = advanceJourney(state, 1);
    assert.equal(journeyMode(state), 'arrived');
    assert.equal(state.entered, null);
    assert.equal(state.arrived, '2-1');

    state = select(state, '1-1');
    state = advanceJourney(state, 1);
    assert.equal(journeyMode(state), 'board');
    assert.deepEqual(state.point, network.nodes['port-dock']);
    state = advanceJourney(state, 1);
    assert.equal(journeyMode(state), 'sail');
    state = advanceJourney(state, 4);
    assert.equal(journeyMode(state), 'disembark');
    assert.deepEqual(state.point, network.nodes['coast-boat']);
    state = advanceJourney(state, 4);
    assert.equal(state.arrived, '1-1');
});

test('rapid walking retargets reverse the authored polyline from the exact current position', () => {
    let state = advanceJourney(select(initial(), '2-1'), 1.3);
    const before = state.point;
    state = select(state, '1-1');
    assert.deepEqual(state.point, before);
    assert.equal(state.legs[0].direction, -1);
    state = advanceJourney(state, .2);
    const reversed = state.point;
    assert.notDeepEqual(reversed, before);
    for (const target of ['1-3', '1-1', '2-2', '1-1', '1-2', '2-1']) {
        const current = state.point;
        state = select(state, target);
        assert.deepEqual(state.point, current);
        assert.equal(state.arrived, '1-1');
    }
    assert.deepEqual(state.legs[0].points, [network.nodes['1-1'], ...network.edges[0].points!, network.nodes['1-2']]);
    state = advanceJourney(state, 100);
    assert.equal(state.arrived, '2-1');
});

test('boat reversals stay on the same water route, including several changes of mind', () => {
    let state = advanceJourney(select(initial(), '2-1'), 5.8);
    assert.equal(journeyMode(state), 'sail');
    const atSea = state.point;
    state = select(state, '1-1');
    assert.deepEqual(state.point, atSea);
    assert.equal(state.legs[0].direction, -1);
    state = advanceJourney(state, .2);
    const reversed = state.point;
    state = select(state, '2-2');
    assert.deepEqual(state.point, reversed);
    assert.equal(state.legs[0].direction, 1);
    state = advanceJourney(state, .1);
    const forward = state.point;
    state = select(state, '1-2');
    assert.deepEqual(state.point, forward);
    assert.equal(state.legs[0].direction, -1);
    assert.equal(journeyMode(state), 'sail');
    state = advanceJourney(state, 100);
    assert.equal(state.arrived, '1-2');
    assert.deepEqual(state.point, network.nodes['1-2']);
    assert.equal(state.entered, null);
});

test('boarding can reverse to disembark without jumping to either dock', () => {
    let state = advanceJourney(select(initial(), '2-1'), 3.4);
    assert.equal(journeyMode(state), 'board');
    const point = state.point;
    state = select(state, '1-2');
    assert.equal(journeyMode(state), 'disembark');
    assert.deepEqual(state.point, point);
    assert.equal(advanceJourney(state, 1.4).arrived, '1-2');
});

test('unavailable stage, unavailable region, missing destination and missing routes cannot move or enter', () => {
    const original = initial();
    const locked: JourneyCapabilities = { availableStages: ['1-1'] };
    for (const id of ['1-2', '2-1', '6-5', 'bad-id']) {
        const state = selectJourney(original, id, network, locked);
        assert.equal(state.selected, id);
        assert.equal(state.blocked, 'unavailable');
        assert.ok(journeyBlockReason(state));
        assert.deepEqual(state.point, original.point);
        assert.equal(state.arrived, '1-1');
        assert.equal(enterJourney(state, locked), state);
    }
    const missing = selectJourney(original, '3-1', network, { availableStages: [...capabilities.availableStages, '3-1'] });
    assert.equal(missing.blocked, 'no-route');
    assert.deepEqual(missing.point, original.point);
    assert.equal(missing.arrived, original.arrived);
    const sailing = advanceJourney(select(original, '2-1'), 5);
    const missingAtSea = selectJourney(sailing, '3-1', network,
        { availableStages: [...capabilities.availableStages, '3-1'] });
    assert.equal(missingAtSea.blocked, 'no-route');
    assert.deepEqual(missingAtSea.point, sailing.point);
    assert.equal(missingAtSea.arrived, sailing.arrived);
    assert.equal(missingAtSea.destination, '2-1');
    assert.equal(skipJourney(missingAtSea).arrived, '2-1');
    const disconnected = selectJourney(original, '2-1', network,
        { ...capabilities, availableEdges: network.edges.filter(edge => edge.id !== 'crossing').map(edge => edge.id) });
    assert.equal(disconnected.blocked, 'no-route');
    assert.equal(disconnected.legs.length, 0);
    assert.ok(journeyBlockReason(disconnected));
});

test('a crossing gate changing mid-trip still lets the boat return to shore without teleporting', () => {
    const sailing = advanceJourney(select(initial(), '2-1'), 5);
    const closed: JourneyCapabilities = { ...capabilities,
        availableEdges: network.edges.filter(edge => edge.id !== 'crossing').map(edge => edge.id) };
    const returning = selectJourney(sailing, '1-1', network, closed);
    assert.deepEqual(returning.point, sailing.point);
    assert.equal(journeyMode(returning), 'sail');
    assert.equal(returning.legs[0].direction, -1);
    assert.equal(advanceJourney(returning, 100).arrived, '1-1');
});

test('inspecting a locked destination during travel keeps a safe route and skip cannot enter that selection', () => {
    const travelling = advanceJourney(select(initial(), '2-1'), 5);
    const inspected = select(travelling, '6-5');
    assert.equal(inspected.selected, '6-5');
    assert.equal(inspected.destination, '2-1');
    assert.deepEqual(inspected.point, travelling.point);
    const arrived = skipJourney(inspected);
    assert.equal(arrived.arrived, '2-1');
    assert.equal(arrived.selected, '6-5');
    assert.equal(canEnterJourney(arrived, capabilities), false);
    assert.equal(canEnterJourney(select(arrived, '2-1'), capabilities), true);
});

test('skip and reduced motion finish the available destination but never enter it', () => {
    for (const state of [skipJourney(advanceJourney(select(initial(), '2-1'), 5)),
        selectJourney(initial(), '2-1', network, capabilities, { reducedMotion: true }),
        advanceJourney(select(initial(), '2-1'), 0, true)]) {
        assert.equal(state.arrived, '2-1');
        assert.deepEqual(state.point, network.nodes['2-1']);
        assert.equal(state.entered, null);
        assert.equal(state.legs.length, 0);
        assert.equal(canEnterJourney(state, capabilities), true);
    }
});

test('save semantics restore last arrival after reload during transit, without new save fields', () => {
    const save = freshSave();
    const state = advanceJourney(select(initial(), '2-1'), 5);
    save.selected = journeySaveSelection(state);
    const restoredSave = parseSave(JSON.stringify(save));
    const restored = createJourney(restoredSave.selected, network, capabilities);
    assert.equal(restored.selected, '1-1');
    assert.equal(restored.arrived, '1-1');
    assert.deepEqual(restored.point, network.nodes['1-1']);
    assert.deepEqual(Object.keys(restoredSave).sort(), Object.keys(freshSave()).sort());
    const finished = advanceJourney(state, 100);
    assert.equal(createJourney(journeySaveSelection(finished), network, capabilities).arrived, '2-1');
});

test('legacy saves with a locked selection recover at an available phase and preserve the gate explanation', () => {
    const state = createJourney('2-1', network, { availableStages: ['1-1', '1-2'] });
    assert.equal(state.selected, '2-1');
    assert.equal(state.arrived, '1-2');
    assert.equal(state.blocked, 'unavailable');
    assert.deepEqual(state.point, network.nodes['1-2']);
    assert.equal(canEnterJourney(state, capabilities), false);
    assert.equal(selectJourney(state, '1-2', network, capabilities).blocked, null);
    assert.equal(createJourney('invalid', network, capabilities).selected, '1-1');
});

test('returning from gameplay anchors played phase before selecting the next unlocked destination', () => {
    const pausedReturn = returnToJourney('1-2', '1-2', network, capabilities);
    assert.equal(pausedReturn.arrived, '1-2');
    assert.equal(pausedReturn.entered, null);
    assert.equal(canEnterJourney(pausedReturn, capabilities), true);
    const clearReturn = returnToJourney('1-2', '2-1', network, capabilities);
    assert.equal(clearReturn.arrived, '1-2');
    assert.equal(clearReturn.selected, '2-1');
    assert.equal(journeySaveSelection(clearReturn), '1-2');
    assert.deepEqual(clearReturn.point, network.nodes['1-2']);
    assert.equal(canEnterJourney(clearReturn, capabilities), false);
    assert.equal(advanceJourney(clearReturn, 100).arrived, '2-1');
});

test('existing 30 stage IDs, 72 seals and progression remain authoritative without mutation', () => {
    const save = freshSave();
    const allNodes = Object.fromEntries(STAGES.map((stage, index) => [stage.id, { x: index / 30, y: .5 }]));
    const allStages: JourneyNetwork = { nodes: allNodes, edges: [] };
    assert.equal(STAGES.length, 30);
    assert.equal(STAGES.reduce((total, stage) => total + stage.pickups.filter(item => item.kind === 'seal').length, 0), 72);
    for (const stage of STAGES) {
        assert.equal(isUnlocked(stage.id, save), true);
        const cap = { availableStages: STAGES.filter(item => isUnlocked(item.id, save)).map(item => item.id) };
        const before = JSON.stringify(save);
        const state = createJourney(stage.id, allStages, cap);
        assert.equal(enterJourney(state, cap).entered, stage.id);
        assert.equal(JSON.stringify(save), before);
        finishStage(save, stage.id, 'normal', 10);
        if (stage.id === '3-5') save.guaira.completed = guairaChapterRoute(save.guaira.opening);
    }
    assert.equal(save.completed.length, 30);
});

test('model leaves inputs immutable and handles zero-duration legs and invalid deltas', () => {
    const before = JSON.stringify(network), state = select(initial(), '2-1'), stateBefore = JSON.stringify(state);
    for (const delta of [NaN, Infinity, -Infinity, -10]) {
        const next = advanceJourney(state, delta);
        assert.deepEqual(next.point, state.point);
    }
    advanceJourney(state, 100);
    select(state, '1-1');
    assert.equal(JSON.stringify(state), stateBefore);
    assert.equal(JSON.stringify(network), before);
    const instant = { ...network, edges: network.edges.map(edge => ({ ...edge, duration: 0 })) };
    const arrived = selectJourney(initial(), '2-1', instant, capabilities);
    assert.equal(arrived.arrived, '2-1');
    assert.equal(arrived.entered, null);
    assert.equal(arrived.legs.length, 0);
});

test('omitted, empty and explicit both direction permissions preserve the complete legacy journey exactly', () => {
    for (const edgeDirections of [{}, Object.fromEntries(network.edges.map(edge => [edge.id, 'both' as const]))]) {
        const explicit = { ...capabilities, edgeDirections };
        let expected = initial(), actual = createJourney('1-1', network, explicit);
        for (const [target, seconds] of [['2-1', 5.8], ['1-1', .2], ['2-2', .1], ['1-2', 100], ['2-1', 100]] as const) {
            expected = selectJourney(expected, target, network, capabilities);
            actual = selectJourney(actual, target, network, explicit);
            assert.deepEqual(actual, expected);
            expected = advanceJourney(expected, seconds); actual = advanceJourney(actual, seconds);
            assert.deepEqual(actual, expected);
        }
        assert.deepEqual(enterJourney(actual, explicit), enterJourney(expected, capabilities));
    }
});

test('edge direction permissions independently gate each authored departure and retain availableEdges gates', () => {
    const trail = { ...network, edges: [network.edges[0]] };
    for (const permission of ['forward', 'reverse', 'both', 'none'] as const) {
        const cap: JourneyCapabilities = { ...capabilities, edgeDirections: { 'coast-trail': permission } };
        for (const [from, to, direction] of [['1-1', '1-2', 'forward'], ['1-2', '1-1', 'reverse']] as const) {
            const state = selectJourney(createJourney(from, trail, cap), to, trail, cap);
            assert.equal(state.blocked, permission === 'both' || permission === direction ? null : 'no-route');
        }
    }
    const closed: JourneyCapabilities = { ...capabilities, availableEdges: [], edgeDirections: { 'coast-trail': 'both' } };
    assert.equal(selectJourney(initial(), '1-2', trail, closed).blocked, 'no-route');
    const malformed = { ...capabilities, edgeDirections: { 'coast-trail': 'sideways' as JourneyEdgeDirection } };
    assert.equal(selectJourney(initial(), '1-2', trail, malformed).blocked, 'no-route');
});

test('closing both departure directions still permits continuous exit or reversal of the active partial leg', () => {
    const state = advanceJourney(select(initial(), '2-1'), 5);
    const closed: JourneyCapabilities = { ...capabilities, edgeDirections: { crossing: 'none' } };
    for (const [target, direction] of [['1-1', -1], ['2-1', 1]] as const) {
        const next = selectJourney(state, target, network, closed);
        assert.deepEqual(next.point, state.point); assert.equal(next.legs[0].direction, direction);
        assert.deepEqual(next.legs[0].points, state.legs[0].points);
        assert.equal(advanceJourney(next, 100).arrived, target);
    }
    assert.equal(selectJourney(initial(), '2-1', network, closed).blocked, 'no-route');
});
