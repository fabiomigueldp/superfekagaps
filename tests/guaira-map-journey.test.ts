import assert from 'node:assert/strict';
import test from 'node:test';
import metadata from '../public/assets/world/map/guaira-campaign/guaira-navigation.json';
import { GUAIRA_JOURNEY, guairaArrivalJourney, guairaDepartureJourney, guairaJourneyCapabilities, guairaJourneyDepth } from '../src/adventure/GuairaMapJourney';
import { createJourney, selectJourney, advanceJourney, skipJourney, enterJourney, returnToJourney, canEnterJourney } from '../src/adventure/WorldJourneyModel';
import { freshSave } from '../src/adventure/progress';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { withDevelopmentAccess } from '../src/adventure/DevelopmentProgress';

test('both openings reach each earned phase and optional doorway without unlocking another chapter receipt', () => {
    for (const opening of ['guaira-travessia', 'guaira-patio-comportas'] as const) {
        const save = freshSave(); save.completed.push('3-5'); save.guaira.opening = opening; save.guaira.selectedScene = opening;
        const route = guairaChapterRoute(opening);
        let journey = guairaArrivalJourney(save, opening);
        assert.equal(journey.arrived, 'guaira-arrival'); assert.equal(journey.destination, opening);
        for (const scene of route) {
            const capabilities = guairaJourneyCapabilities(save), before = JSON.stringify(save);
            journey = skipJourney(selectJourney(journey, scene, GUAIRA_JOURNEY, capabilities));
            assert.equal(journey.arrived, scene); assert.equal(canEnterJourney(journey, capabilities), true);
            for (const optional of ['gallery', 'relief']) {
                const visit = advanceJourney(selectJourney(journey, optional, GUAIRA_JOURNEY, capabilities), 100);
                assert.equal(visit.arrived, optional); assert.equal(canEnterJourney(visit, capabilities), true);
                const back = returnToJourney(optional, scene, GUAIRA_JOURNEY, capabilities);
                assert.equal(back.arrived, optional); assert.equal(back.destination, scene);
                assert.equal(skipJourney(back).arrived, scene);
            }
            assert.equal(JSON.stringify(save), before, 'geography cannot award or modify progress');
            save.guaira.completed.push(scene); // an earned runtime receipt opens the next stop
        }
        const departure = guairaDepartureJourney(journey, save);
        assert.equal(departure.destination, 'guaira-arrival');
        assert.equal(skipJourney(departure).arrived, 'guaira-arrival');
        assert.equal(canEnterJourney(skipJourney(departure), guairaJourneyCapabilities(save)), false, 'airport is not a gameplay phase');
    }
});

test('all eight modeled entrances have distinct positions, reciprocal routes and finite depth through reversals', () => {
    const save = withDevelopmentAccess(freshSave(), true), caps = guairaJourneyCapabilities(save);
    assert.equal(new Set(Object.values(metadata.nodes).map(p => `${p.x}:${p.y}`)).size, 8);
    for (const a of caps.availableStages) for (const b of caps.availableStages) {
        const origin = createJourney(a, GUAIRA_JOURNEY, caps);
        let walk = selectJourney(origin, b, GUAIRA_JOURNEY, caps);
        if (a === b) continue;
        assert.equal(walk.blocked, null);
        walk = advanceJourney(walk, .15);
        const point = { ...walk.point }, depth = guairaJourneyDepth(walk);
        assert.ok(Number.isFinite(depth)); assert.equal(canEnterJourney(walk, caps), false);
        const reverse = selectJourney(walk, a, GUAIRA_JOURNEY, caps);
        assert.deepEqual(reverse.point, point); assert.equal(guairaJourneyDepth(reverse), depth);
        assert.equal(skipJourney(reverse).arrived, a);
        const arrived = skipJourney(walk); assert.equal(arrived.arrived, b);
        assert.equal(guairaJourneyDepth(arrived), metadata.nodeDepths[b as keyof typeof metadata.nodeDepths]);
        const entered = enterJourney(arrived, caps); assert.equal(entered.entered, b);
        assert.equal(enterJourney(entered, caps), entered);
    }
});

test('locked stops, alternative opening retirement and reduced motion keep native entry semantics', () => {
    const save = freshSave(); assert.deepEqual(guairaJourneyCapabilities(save).availableStages, []);
    save.completed.push('3-5');
    const caps = guairaJourneyCapabilities(save), start = skipJourney(guairaArrivalJourney(save, save.guaira.opening));
    const locked = selectJourney(start, 'guaira-prefeito', GUAIRA_JOURNEY, caps);
    assert.equal(locked.blocked, 'unavailable'); assert.deepEqual(locked.point, start.point);
    assert.equal(enterJourney(locked, caps), locked);
    const reduced = selectJourney(start, 'gallery', GUAIRA_JOURNEY, caps, { reducedMotion: true });
    assert.equal(reduced.destination, null); assert.equal(reduced.arrived, 'gallery'); assert.equal(reduced.entered, null);
    save.guaira.completed.push('guaira-travessia');
    assert.ok(!guairaJourneyCapabilities(save).availableStages.includes('guaira-patio-comportas'));
    assert.ok(guairaJourneyCapabilities(save).availableStages.includes('guaira-respiros'));
});

test('phase landmarks share the measured arrivals and Ossabravo has its own corral branch', () => {
    assert.deepEqual(Object.keys(metadata.landmarks).sort(), Object.keys(metadata.nodes).sort());
    for (const [id, landmark] of Object.entries(metadata.landmarks)) {
        const routes = metadata.routes.filter(r => r.from === id || r.to === id);
        assert.ok(routes.length > 0, `${id} must be reachable on foot`);
        for (const r of routes) assert.deepEqual(landmark.arrivalWorld, r.from === id ? r.world[0] : r.world.at(-1));
        assert.ok(landmark.place.length > 5 && landmark.cue.length > 15);
        assert.ok(landmark.collection.includes(id), 'editable scene identifies the same phase');
        assert.ok(Math.hypot(...landmark.arrivalWorld.map((v, i) => v - landmark.anchorWorld[i])) < 2,
            `${id} must arrive beside its physical landmark`);
    }
    const corralEdges = metadata.routes.filter(r => r.from === 'guaira-lab' || r.to === 'guaira-lab');
    assert.equal(corralEdges.length, 1, 'the boss entrance is not a transit junction');
    assert.equal(corralEdges[0].id, 'corral-gate');
    assert.equal(corralEdges[0].from, 'corral-junction');
    const save = withDevelopmentAccess(freshSave(), true), caps = guairaJourneyCapabilities(save);
    const walk = selectJourney(createJourney('guaira-respiros', GUAIRA_JOURNEY, caps), 'guaira-subida', GUAIRA_JOURNEY, caps);
    assert.equal(skipJourney(walk).arrived, 'guaira-subida');
});
