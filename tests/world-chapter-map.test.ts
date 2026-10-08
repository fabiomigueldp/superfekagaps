import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterMapStages, chapterSelection, deliciaMapProgress } from '../src/adventure/WorldChapterMap';
import { ALL_DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { freshSave } from '../src/adventure/progress';
import { freshDeliciaSave, completeDeliciaStage } from '../src/adventure/delicia/DeliciaProgress';
import { withDevelopmentAccess } from '../src/adventure/DevelopmentProgress';

test('one map exposes both chapters without granting progress by inspecting them', () => {
    const save = freshSave(), delicia = freshDeliciaSave(), before = JSON.stringify([save, delicia]);
    const guaira = chapterMapStages('guaira', save, delicia), empire = chapterMapStages('delicia', save, delicia);
    assert.ok(guaira.every(stage => !stage.open));
    assert.deepEqual(empire.filter(stage => stage.open).map(stage => stage.id), ['delicia-1']);
    assert.equal(empire.length, 14, 'The two optional sanctuaries remain discoverable.');
    assert.ok(guaira.some(stage => stage.id === 'gallery') && guaira.some(stage => stage.id === 'relief'));
    assert.equal(JSON.stringify([save, delicia]), before);
});

test('Guaíra follows earned receipts, preserves the alternative opening and explains each locked stop', () => {
    const save = freshSave(), delicia = freshDeliciaSave(); save.completed.push('3-5');
    let stages = chapterMapStages('guaira', save, delicia);
    assert.equal(stages.find(s => s.id === 'guaira-travessia')?.open, true);
    assert.equal(stages.find(s => s.id === 'guaira-patio-comportas')?.open, true);
    assert.equal(stages.find(s => s.id === 'guaira-prefeito')?.open, false);
    save.guaira.opening = 'guaira-patio-comportas'; save.guaira.completed = ['guaira-patio-comportas'];
    stages = chapterMapStages('guaira', save, delicia);
    assert.deepEqual(stages.filter(s => !s.optional && s.open).map(s => s.id), ['guaira-patio-comportas', 'guaira-respiros']);
    assert.ok(stages.filter(s => !s.open).every(s => s.gate.startsWith('Conclua')));
    assert.equal(stages[chapterSelection(stages, 'guaira-prefeito')].id, 'guaira-respiros');
});

test('Delícia returns to the next earned stage and keeps checkpoints separate from completion', () => {
    const save = freshSave(), delicia = freshDeliciaSave();
    delicia.checkpoint = { stage: 'delicia-1', index: 0, valves: [] };
    let stages = chapterMapStages('delicia', save, delicia);
    assert.equal(stages[1].open, false); assert.equal(stages[0].completed, false);
    completeDeliciaStage(delicia, 'delicia-1', 60);
    stages = chapterMapStages('delicia', save, delicia);
    assert.equal(stages[chapterSelection(stages, delicia.selected)].id, 'delicia-2');
    assert.equal(stages[0].completed, true); assert.equal(stages[2].open, false);
});

test('development access opens every stop without inventing a completion or collectible', () => {
    const save = withDevelopmentAccess(freshSave(), true), delicia = withDevelopmentAccess(freshDeliciaSave(), true);
    for (const chapter of ['guaira', 'delicia'] as const) {
        const stages = chapterMapStages(chapter, save, delicia);
        assert.ok(stages.every(s => s.open && !s.completed));
        assert.ok(stages.every(s => Number.isFinite(s.point.x) && Number.isFinite(s.point.y)));
    }
    assert.deepEqual(save.completed, []); assert.deepEqual(delicia.completed, []);
});

test('the shared map counts only authored seals and main chapter completions', () => {
    const save = freshDeliciaSave(), seal = ALL_DELICIA_STAGES[0].pickups.find(p => p.kind === 'seal')!;
    save.collected.push(seal.id, 'unknown', 'a-coin'); save.completed.push('delicia-1', 'delicia-raizes');
    const progress = deliciaMapProgress(save), stages = chapterMapStages('delicia', freshSave(), save);
    assert.equal(progress.completed, 1); assert.equal(progress.stages, 12); assert.equal(progress.seals, 1);
    assert.equal(progress.sealTotal, ALL_DELICIA_STAGES.flatMap(s => s.pickups).filter(p => p.kind === 'seal').length);
    assert.equal(stages[0].seals, 1);
    assert.equal(stages[0].sealTotal, ALL_DELICIA_STAGES[0].pickups.filter(p => p.kind === 'seal').length);
});
