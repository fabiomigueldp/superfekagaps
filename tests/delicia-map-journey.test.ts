import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DELICIA_JOURNEY as network, deliciaJourneyCapabilities, deliciaJourneyDepth } from '../src/adventure/delicia/DeliciaMapJourney';
import { freshDeliciaSave, completeDeliciaStage } from '../src/adventure/delicia/DeliciaProgress';
import { advanceJourney, canEnterJourney, createJourney, enterJourney, returnToJourney, selectJourney, skipJourney } from '../src/adventure/WorldJourneyModel';
import metadata from '../public/assets/delicia/island-map.json';

test('Blender export grounds all fourteen stops and connects each reachable destination', () => {
    const save = freshDeliciaSave(); save.completed = ALL_DELICIA_STAGES.map(s => s.id);
    const caps = deliciaJourneyCapabilities(save);
    assert.equal(Object.keys(metadata.nodes).length, 14);
    assert.equal(metadata.revision, 8);
    for (const stage of ALL_DELICIA_STAGES) {
        const origin = createJourney(stage.id, network, caps);
        assert.equal(origin.arrived, stage.id);
        for (const destination of ALL_DELICIA_STAGES) {
            const trip = selectJourney(origin, destination.id, network, caps);
            assert.equal(trip.blocked, null, `${stage.id} → ${destination.id}`);
            const arrived = skipJourney(trip);
            assert.equal(arrived.arrived, destination.id);
            assert.ok(Math.hypot(arrived.point.x-network.nodes[destination.id].x, arrived.point.y-network.nodes[destination.id].y)<1e-9);
            assert.ok(canEnterJourney(arrived, caps));
        }
    }
    for (const route of metadata.routes) {
        assert.ok(route.points.length > 2 && route.duration > 0);
        assert.ok(route.points.every(p => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1));
        assert.deepEqual(network.edges.find(e => e.id === route.id)!.points![0], network.nodes[route.from]);
        assert.deepEqual(network.edges.find(e => e.id === route.id)!.points!.at(-1), network.nodes[route.to]);
    }
});

test('depth follows the physical route through reversals, joins and every landing', () => {
    const save = freshDeliciaSave(); save.completed = ALL_DELICIA_STAGES.map(s => s.id);
    const caps = deliciaJourneyCapabilities(save);
    for (const edge of network.edges) {
        const start = { ...createJourney('delicia-1', network, caps), node: edge.from, arrived: edge.from, point: network.nodes[edge.from] };
        const trip = { ...start, node: null, destination: edge.to, legs: [{ ...edge, points: edge.points!, progress: 0, direction: 1 as const }] };
        const depths = (metadata.nodeDepths as Record<string, number>);
        assert.equal(deliciaJourneyDepth(trip), depths[edge.from]);
        const end = { ...trip, legs: [{ ...trip.legs[0], progress: 1 }] };
        assert.equal(deliciaJourneyDepth(end), depths[edge.to]);
        const partial = { ...trip, legs: [{ ...trip.legs[0], progress: .37 }] };
        const reversed = { ...partial, legs: [{ ...partial.legs[0], direction: -1 as const }] };
        assert.equal(deliciaJourneyDepth(partial), deliciaJourneyDepth(reversed));
        assert.ok(Number.isFinite(deliciaJourneyDepth(partial)));
    }
    for (const stage of ALL_DELICIA_STAGES) assert.ok(Number.isFinite(deliciaJourneyDepth(createJourney(stage.id, network, caps))));
    for (const route of metadata.routes) {
        assert.equal(route.points.length, route.depths.length);
        assert.equal(route.points.length, route.visible.length);
        assert.ok(route.depths.every(z => z > 0 && z < 255));
    }
});

test('locked previews preserve the foot and real progression opens the earned road only', () => {
    const save = freshDeliciaSave(), before = JSON.stringify(save);
    let caps = deliciaJourneyCapabilities(save), origin = createJourney('delicia-1', network, caps);
    const preview = selectJourney(origin, 'delicia-2', network, caps);
    assert.equal(preview.blocked, 'unavailable'); assert.deepEqual(preview.point, origin.point);
    assert.equal(canEnterJourney(preview, caps), false);
    assert.equal(JSON.stringify(save), before);
    completeDeliciaStage(save, 'delicia-1', 60); caps = deliciaJourneyCapabilities(save);
    const trip = selectJourney(origin, 'delicia-2', network, caps);
    assert.equal(trip.destination, 'delicia-2'); assert.equal(canEnterJourney(trip, caps), false);
    assert.deepEqual(trip.legs.map(l => l.id), ['harbor-orchard']);
    assert.equal(selectJourney(trip, 'delicia-raizes', network, caps).blocked, 'unavailable');
});

test('walking and reversing share the World engine and never jump off the authored path', () => {
    const save = freshDeliciaSave(); save.completed = ALL_DELICIA_STAGES.map(s => s.id);
    const caps = deliciaJourneyCapabilities(save), start = createJourney('delicia-1', network, caps);
    const trip = selectJourney(start, 'delicia-2', network, caps), walking = advanceJourney(trip, .25);
    assert.notDeepEqual(walking.point, start.point); assert.notDeepEqual(walking.point, network.nodes['delicia-2']);
    const reverse = selectJourney(walking, 'delicia-1', network, caps);
    assert.deepEqual(reverse.point, walking.point); assert.equal(reverse.legs[0].direction, -1);
    assert.equal(skipJourney(reverse).arrived, 'delicia-1');
    const arrived = skipJourney(trip), entered = enterJourney(arrived, caps);
    assert.equal(entered.entered, 'delicia-2'); assert.equal(enterJourney(entered, caps), entered);
    assert.equal(canEnterJourney(entered, caps), false);
});

test('clear returns to the played stop before walking to the next; reduced motion skips movement', () => {
    const save = freshDeliciaSave(); completeDeliciaStage(save, 'delicia-1', 60);
    const caps = deliciaJourneyCapabilities(save);
    const returned = returnToJourney('delicia-1', save.selected, network, caps);
    assert.equal(returned.arrived, 'delicia-1'); assert.equal(returned.destination, 'delicia-2');
    assert.deepEqual(returned.point, network.nodes['delicia-1']);
    const reduced = returnToJourney('delicia-1', save.selected, network, caps, { reducedMotion: true });
    assert.equal(reduced.arrived, 'delicia-2'); assert.equal(reduced.destination, null);
    assert.equal(createJourney('delicia-crossroads', network, caps).arrived, 'delicia-1', 'A junction cannot become an enterable phase.');
});
