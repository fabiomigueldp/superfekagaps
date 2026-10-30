import assert from 'node:assert/strict';
import test from 'node:test';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';
import { awardDeliciaMedals, completeDeliciaStage, freshDeliciaSave, parseDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';

for (const assisted of [false, true]) for (const checkpoint of [-1, 0]) {
    test(`attempt assists=${assisted}, checkpoint=${checkpoint}: changing the next preference cannot change earned records`, () => {
        const save = freshDeliciaSave(), stage = DELICIA_STAGES[0];
        save.assists = assisted; save.completed = [stage.id]; save.times[stage.id] = 90;
        save.medals[stage.id] = ['seals']; save.selected = stage.id;
        save.collected = stage.pickups.filter(p => p.kind === 'seal').map(p => p.id);
        const sim = new DeliciaSimulation(stage, save.assists, checkpoint);
        save.assists = !assisted;
        save.checkpoint = checkpoint < 0 ? null : { stage: stage.id, index: checkpoint, valves: [] };
        const before = structuredClone(save), eligible = !assisted && checkpoint < 0;
        completeDeliciaStage(save, stage.id, 30, sim.recordEligible, sim.assists);
        const medals = awardDeliciaMedals(save, stage.id, { eligible: sim.recordEligible,
            damage: 0, seals: 3, seconds: 30, parries: 0 }, sim.assists);
        assert.deepEqual(medals, eligible ? ['clean', 'seals', 'tempo'] : []);
        assert.deepEqual(save, { ...before, checkpoint: null, selected: 'delicia-2',
            times: { [stage.id]: eligible ? 30 : 90 }, medals: { [stage.id]: eligible ? ['seals', 'clean', 'tempo'] : ['seals'] } });
        assert.deepEqual(parseDeliciaSave(JSON.stringify(save)), save, 'Existing save format and next-attempt preference survive reload.');
        completeDeliciaStage(save, stage.id, 60, sim.recordEligible, sim.assists);
        assert.equal(save.times[stage.id], eligible ? 30 : 90, 'A slower replay never replaces the best record.');
    });
}

for (const assisted of [false, true]) test(`callers without attempt context retain the saved assistance guard, assists=${assisted}`, () => {
    const save = freshDeliciaSave(); save.assists = assisted;
    completeDeliciaStage(save, 'delicia-1', 30);
    const medals = awardDeliciaMedals(save, 'delicia-1', { eligible: true, damage: 0, seals: 3, seconds: 30, parries: 0 });
    assert.deepEqual(save.completed, ['delicia-1']); assert.equal(save.selected, 'delicia-2');
    assert.equal(save.times['delicia-1'], assisted ? undefined : 30);
    assert.deepEqual(medals, assisted ? [] : ['clean', 'seals', 'tempo']);
    assert.equal(save.assists, assisted);
});
