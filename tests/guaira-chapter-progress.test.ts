import test from 'node:test';
import assert from 'node:assert/strict';
import { freshGuairaChapterProgress, sanitizeGuairaChapterProgress, mergeGuairaChapterProgress, guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { GuairaChapterSession } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { ProgressStore, SAVE_KEY, freshSave } from '../src/adventure/progress';

test('durable chapter rejects malformed, noncontiguous and unreachable progress', () => {
    assert.deepEqual(sanitizeGuairaChapterProgress(null), freshGuairaChapterProgress());
    const progress = sanitizeGuairaChapterProgress({ version: 1, completed: ['guaira-prefeito'], selectedScene: 'guaira-prefeito', resumeScene: 'guaira-subida', optional: { gallery: 'yes' } });
    assert.deepEqual(progress.completed, []); assert.equal(progress.selectedScene, 'guaira-travessia');
    assert.equal(progress.resumeScene, null); assert.equal(progress.optional.gallery, false);
});
test('valid runtime completion latches before map/Continue and restores with fresh identities', () => {
    const session = new GuairaChapterSession(), attempt = session.enterScene('guaira-travessia', session.snapshot().generation)!;
    const live = { attempt, state: 'playing', alive: true, result: { sceneId: 'guaira-travessia', kind: 'reached-finish' } } as const;
    assert.equal(session.acceptCompletion(attempt, { ...live, alive: false }), false);
    assert.equal(session.acceptCompletion(attempt, live), true);
    assert.equal(session.acceptCompletion(attempt, live), false);
    const progress = { ...freshGuairaChapterProgress(), completed: session.snapshot().accepted.map(r => r.sceneId), resumeScene: attempt.sceneId };
    const restored = new GuairaChapterSession({ progress });
    assert.equal(restored.snapshot().accepted.length, 1);
    assert.equal(restored.snapshot().activeAttempt, null);
    assert.notEqual(restored.snapshot().generation.sessionId, attempt.sessionId);
    assert.equal(restored.acceptCompletion(attempt, live), false);
    assert.equal(restored.retry(attempt), null);
});
test('monotonic merge preserves completed campaign and optional rewards across replay', () => {
    const earned = { ...freshGuairaChapterProgress(), completed: guairaChapterRoute('guaira-travessia'), optional: { gallery: true, relief: true } };
    const merged = mergeGuairaChapterProgress(earned, { ...freshGuairaChapterProgress(), audioEnabled: false });
    assert.equal(merged.completed.length, 5); assert.deepEqual(merged.optional, earned.optional); assert.equal(merged.audioEnabled, false);
});
test('chapter-only persistence rereads latest shared save without clobbering campaign fields', () => {
    let raw = JSON.stringify(freshSave());
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const chapter = new ProgressStore(storage), campaign = new ProgressStore(storage);
    campaign.save.completed.push('1-1'); campaign.save.seals.push('1-1:s1'); campaign.persist();
    const progress = { ...freshGuairaChapterProgress(), completed: ['guaira-travessia' as const], audioEnabled: false };
    assert.equal(chapter.updateGuaira(progress), true);
    const reload = new ProgressStore(storage);
    assert.deepEqual(reload.save.completed, ['1-1']); assert.deepEqual(reload.save.seals, ['1-1:s1']);
    assert.deepEqual(reload.save.guaira.completed, ['guaira-travessia']); assert.equal(reload.save.guaira.audioEnabled, false);
    assert.equal(SAVE_KEY, 'super_feka_gaps_world_v1');
});
test('corrupt storage remains protected and write failure truthfully reports session-only', () => {
    let writes = 0;
    const protectedStore = new ProgressStore({ getItem: () => '{broken', setItem: () => { writes++; } });
    assert.equal(protectedStore.updateGuaira(freshGuairaChapterProgress()), false); assert.equal(writes, 0); assert.ok(protectedStore.warning);
    const unavailable = new ProgressStore(null);
    assert.equal(unavailable.updateGuaira(freshGuairaChapterProgress()), false); assert.match(unavailable.warning, /sessão/);
});
