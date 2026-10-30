import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_DELICIA_STAGES, DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { completeDeliciaStage, freshDeliciaSave, parseDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { DELICIA_JOURNEY, deliciaJourneyCapabilities } from '../src/adventure/delicia/DeliciaMapJourney';
import { returnToJourney } from '../src/adventure/WorldJourneyModel';

for (const [id, unlock] of [['delicia-raizes', 3], ['delicia-relogio', 9]] as const) {
    for (const replay of [false, true]) test(`${id}: ${replay ? 'repeated' : 'first'} completion stays at the optional stop`, () => {
        const save = freshDeliciaSave(), stage = ALL_DELICIA_STAGES.find(stage => stage.id === id)!;
        for (const main of DELICIA_STAGES.slice(0, unlock)) completeDeliciaStage(save, main.id, 60);
        if (replay) { save.completed.push(id); save.times[id] = 75; save.medals[id] = ['seals']; }
        save.selected = id;
        save.checkpoint = { stage: id, index: 1, valves: [stage.valves[0].id] };
        save.collected = [stage.pickups.find(pickup => pickup.kind === 'seal')!.id];
        save.lore.push('canal'); save.music = .2; save.effects = .4; save.reducedMotion = true;
        const before = structuredClone(save);
        completeDeliciaStage(save, id, 80);
        assert.equal(save.selected, id, 'Optional stages have no automatic next main stage.');
        assert.deepEqual(save, { ...before, selected: id, checkpoint: null,
            completed: replay ? before.completed : [...before.completed, id],
            times: { ...before.times, [id]: replay ? 75 : 80 } });
        assert.deepEqual(parseDeliciaSave(JSON.stringify(save)), save, 'Existing v1 progress remains round-trip compatible.');
        const caps = deliciaJourneyCapabilities(save);
        for (const reducedMotion of [false, true]) {
            const returned = returnToJourney(id, save.selected, DELICIA_JOURNEY, caps, { reducedMotion });
            assert.equal(returned.arrived, id); assert.equal(returned.selected, id);
            assert.equal(returned.destination, null);
            assert.deepEqual(returned.legs, []);
            assert.deepEqual(returned.point, DELICIA_JOURNEY.nodes[id]);
        }
    });

    test(`${id}: a locked shrine cannot complete or change saved progress`, () => {
        const save = freshDeliciaSave(), before = JSON.stringify(save);
        assert.throws(() => completeDeliciaStage(save, id, 80), /indisponível/);
        assert.equal(JSON.stringify(save), before);
    });
}

test('main-stage completion still advances to the next main stop and stays at the final stop', () => {
    const save = freshDeliciaSave();
    for (let index = 0; index < DELICIA_STAGES.length; index++) {
        const stage = DELICIA_STAGES[index];
        completeDeliciaStage(save, stage.id, 60);
        assert.equal(save.selected, DELICIA_STAGES[index + 1]?.id ?? stage.id);
        assert.deepEqual(save.completed, DELICIA_STAGES.slice(0, index + 1).map(stage => stage.id));
    }
});
