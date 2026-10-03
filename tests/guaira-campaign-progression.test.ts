import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, parseSave, finishStage, isUnlocked, isGuairaUnlocked, ProgressStore, SAVE_KEY } from '../src/adventure/progress';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { mapStagePrerequisite } from '../src/adventure/WorldMapModel';

test('new campaign inserts Guaíra without renumbering earned stages', () => {
    const save = freshSave(); save.completed = ['2-5', '3-1', '3-2', '3-3', '3-4'];
    assert.equal(isGuairaUnlocked(save), false);
    finishStage(save, '3-5', 'normal', 52);
    assert.equal(isGuairaUnlocked(save), true);
    assert.equal(isUnlocked('4-1', save), false);
    assert.equal(mapStagePrerequisite('4-1', save), 'guaira-prefeito');
    save.guaira.completed = guairaChapterRoute(save.guaira.opening);
    assert.equal(isUnlocked('4-1', save), true);
    assert.equal(isUnlocked('4-2', save), false);
    assert.equal(save.times['3-5'], 52);
});

test('pre-chapter v1 imports preserve already-earned Serra access and all progress', () => {
    const old: any = freshSave(); delete old.guaira;
    old.completed = ['3-5', '4-1', '4-2']; old.selected = '4-3';
    old.seals = ['4-2:s2']; old.times = { '4-2': 42 }; old.checkpoint = { stage: '4-3', index: 1, helmet: true };
    const imported = parseSave(JSON.stringify(old));
    assert.equal(imported.legacySerraAccess, true);
    assert.equal(isUnlocked('4-3', imported), true);
    assert.deepEqual(imported.completed, old.completed);
    assert.deepEqual(imported.checkpoint, old.checkpoint);
    assert.deepEqual(imported.seals, old.seals);
    assert.deepEqual(parseSave(JSON.stringify(imported)), imported);
});

test('chapter updates preserve concurrent campaign save and do not rewrite corrupt storage', () => {
    let raw = JSON.stringify(freshSave());
    const storage = { getItem: (key: string) => { assert.equal(key, SAVE_KEY); return raw; }, setItem: (_key: string, next: string) => { raw = next; } };
    const first = new ProgressStore(storage), second = new ProgressStore(storage);
    first.save.completed.push('1-1'); first.save.preferences.music = .2; first.persist();
    const next = second.save.guaira; next.completed.push('guaira-travessia'); next.optional.gallery = true;
    assert.equal(second.updateGuaira(next), true);
    const result = parseSave(raw);
    assert.deepEqual(result.completed, ['1-1']); assert.equal(result.preferences.music, .2);
    assert.equal(result.guaira.completed.length, 1); assert.equal(result.guaira.optional.gallery, true);
    raw = '{corrupt'; assert.equal(second.updateGuaira(next), false); assert.equal(raw, '{corrupt');
});
