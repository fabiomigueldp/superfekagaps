import test from 'node:test';
import assert from 'node:assert/strict';
import { developmentProfileStorage, developmentSaveKey, hasDevelopmentAccess } from '../src/adventure/DevelopmentProgress';
import { ProgressStore, SAVE_KEY, freshSave, parseSave, isUnlocked, isGuairaUnlocked, canContinueFromGuaira, finishStage } from '../src/adventure/progress';
import { DeliciaStore, DELICIA_SAVE_KEY, freshDeliciaSave, parseDeliciaSave, deliciaUnlocked, completeDeliciaStage } from '../src/adventure/delicia/DeliciaProgress';
import { ALL_DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { GuairaChapterSession } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { freshGuairaChapterProgress } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { mapStageState, mapStagePrerequisite } from '../src/adventure/WorldMapModel';
import viteConfig from '../vite.config';

function memory(entries: [string, string][] = []) {
    const data = new Map(entries), writes: string[] = [], reads: string[] = [];
    return { data, writes, reads, failWrites: false, failReads: false,
        getItem(key: string) { reads.push(key); if (this.failReads) throw Error('blocked'); return data.get(key) ?? null; },
        setItem(key: string, raw: string) { if (this.failWrites) throw Error('quota'); writes.push(key); data.set(key, raw); },
    };
}
const worldIds = Array.from({ length: 30 }, (_, i) => `${Math.floor(i / 5) + 1}-${i % 5 + 1}`);
const developmentWorldKey = developmentSaveKey(SAVE_KEY), developmentDeliciaKey = developmentSaveKey(DELICIA_SAVE_KEY);

function allWorldOpen(store: ProgressStore) {
    for (const id of worldIds) {
        assert.equal(isUnlocked(id, store.save), true, id);
        assert.equal(mapStageState(id, store.save).unlocked, true);
        assert.equal(mapStagePrerequisite(id, store.save), null);
    }
    assert.equal(isGuairaUnlocked(store.save), true);
    assert.equal(canContinueFromGuaira(store.save), true);
    for (const id of ['7-1', '1-6', 'delicia-1', '', 'guaira-prefeito']) assert.equal(isUnlocked(id, store.save), false);
}
function allDeliciaOpen(store: DeliciaStore) {
    for (const stage of ALL_DELICIA_STAGES) assert.equal(deliciaUnlocked(stage.id, store.save), true, stage.id);
    for (const id of ['1-1', 'delicia-13', 'delicia-unknown', '']) assert.equal(deliciaUnlocked(id, store.save), false);
}

test('fresh development profile opens every valid stage without manufacturing earned data or writing at startup', () => {
    const storage = memory(), world = new ProgressStore(storage, true), delicia = new DeliciaStore(storage, true);
    allWorldOpen(world); allDeliciaOpen(delicia);
    assert.equal(ALL_DELICIA_STAGES.length, 14);
    assert.deepEqual(world.save, freshSave()); assert.deepEqual(delicia.save, freshDeliciaSave());
    assert.equal(world.save.legacySerraAccess, undefined);
    assert.deepEqual(world.save.seen, []); assert.deepEqual(world.save.guaira.completed, []);
    assert.deepEqual(storage.writes, []);
    assert.equal(world.persist(), true); assert.equal(delicia.persist(), true);
    assert.deepEqual(storage.writes, [developmentWorldKey, developmentDeliciaKey]);
    assert.equal(storage.data.has(SAVE_KEY), false); assert.equal(storage.data.has(DELICIA_SAVE_KEY), false);
    assert.equal(storage.data.get(developmentWorldKey), JSON.stringify(freshSave()));
    assert.equal(storage.data.get(developmentDeliciaKey), JSON.stringify(freshDeliciaSave()));
    assert.equal(isUnlocked('6-5', parseSave(JSON.stringify(world.save))), false, 'Export cannot grant runtime development access');
    assert.equal(deliciaUnlocked('delicia-12', parseDeliciaSave(JSON.stringify(delicia.save))), false);
});

test('copy-on-read preserves exact normal bytes, real results, reloads and flag-off restoration', () => {
    const normalWorld = { ...freshSave(), completed: ['1-1'], seals: ['1-1:s1'], seen: ['opening'], times: { '1-1': 42 }, selected: '1-2' };
    const normalDelicia = { ...freshDeliciaSave(), completed: ['delicia-1'], times: { 'delicia-1': 62 }, selected: 'delicia-2' };
    const worldRaw = JSON.stringify(normalWorld, null, 3), deliciaRaw = JSON.stringify(normalDelicia, null, 2);
    const storage = memory([[SAVE_KEY, worldRaw], [DELICIA_SAVE_KEY, deliciaRaw]]);
    const world = new ProgressStore(storage, true), delicia = new DeliciaStore(storage, true);
    assert.deepEqual(world.save, normalWorld); assert.deepEqual(delicia.save, normalDelicia);
    finishStage(world.save, '6-5', 'normal', 100); assert.equal(world.persist(), true);
    completeDeliciaStage(delicia.save, 'delicia-12', 88); assert.equal(delicia.persist(), true);
    assert.equal(storage.data.get(SAVE_KEY), worldRaw); assert.equal(storage.data.get(DELICIA_SAVE_KEY), deliciaRaw);
    const worldReload = new ProgressStore(storage, true), deliciaReload = new DeliciaStore(storage, true);
    allWorldOpen(worldReload); allDeliciaOpen(deliciaReload);
    assert.deepEqual(worldReload.save.completed, ['1-1', '6-5']); assert.equal(worldReload.save.times['6-5'], 100);
    assert.deepEqual(deliciaReload.save.completed, ['delicia-1', 'delicia-12']);
    assert.deepEqual(worldReload.save.seen, ['opening'], 'No salon visit/victory or guidance is fabricated');
    const normal = new ProgressStore(storage, false), normalExpansion = new DeliciaStore(storage, false);
    assert.deepEqual(normal.save, normalWorld); assert.deepEqual(normalExpansion.save, normalDelicia);
    assert.equal(isUnlocked('6-5', normal.save), false); assert.equal(deliciaUnlocked('delicia-12', normalExpansion.save), false);
    assert.equal(hasDevelopmentAccess(normal.save), false);
    assert.deepEqual(new ProgressStore(storage, true).save, worldReload.save, 'Re-enable returns to the separate testing profile');
});

test('valid development imports keep every stage open and reject cross-campaign data before any write', () => {
    const worldRaw = JSON.stringify(freshSave()), deliciaRaw = JSON.stringify(freshDeliciaSave());
    const storage = memory([[SAVE_KEY, worldRaw], [DELICIA_SAVE_KEY, deliciaRaw]]);
    const world = new ProgressStore(storage, true), delicia = new DeliciaStore(storage, true);
    const incoming = JSON.stringify({ ...freshSave(), selected: '5-3', seals: ['2-1:s1'] });
    assert.equal(world.import(incoming), true); assert.equal(delicia.import(deliciaRaw), true);
    allWorldOpen(world); allDeliciaOpen(delicia);
    const writes = storage.writes.length, originalWorld = world.save, originalDelicia = delicia.save;
    assert.throws(() => world.import(deliciaRaw), /Delícia/);
    assert.throws(() => delicia.import(worldRaw), /World/);
    assert.throws(() => world.import('{broken')); assert.throws(() => delicia.import('{broken'));
    assert.equal(storage.writes.length, writes); assert.equal(world.save, originalWorld); assert.equal(delicia.save, originalDelicia);
    assert.equal(storage.data.get(SAVE_KEY), worldRaw); assert.equal(storage.data.get(DELICIA_SAVE_KEY), deliciaRaw);
    assert.deepEqual(world.save.completed, []); assert.deepEqual(world.save.seals, ['2-1:s1']);
    storage.failWrites = true;
    assert.equal(world.import(worldRaw), false); assert.equal(delicia.import(deliciaRaw), false);
    assert.equal(world.save, originalWorld); assert.equal(delicia.save, originalDelicia);
    allWorldOpen(world); allDeliciaOpen(delicia);
});

for (const corruptKey of [SAVE_KEY, developmentWorldKey]) test(`corrupt ${corruptKey} stays protected while stages remain testable`, () => {
    const storage = memory([[SAVE_KEY, JSON.stringify(freshSave())], [corruptKey, '{broken']]);
    const before = new Map(storage.data), store = new ProgressStore(storage, true);
    allWorldOpen(store); assert.ok(store.warning); assert.equal(store.persist(), false);
    assert.equal(store.updateGuaira(freshGuairaChapterProgress()), false);
    assert.deepEqual(storage.data, before); assert.equal(storage.writes.length, 0);
    assert.equal(store.import(JSON.stringify(freshSave())), true); allWorldOpen(store);
    assert.equal(storage.data.get(SAVE_KEY), before.get(SAVE_KEY));
});
for (const corruptKey of [DELICIA_SAVE_KEY, developmentDeliciaKey]) test(`corrupt ${corruptKey} never overwrites normal expansion bytes`, () => {
    const storage = memory([[DELICIA_SAVE_KEY, JSON.stringify(freshDeliciaSave())], [corruptKey, '{broken']]);
    const before = new Map(storage.data), store = new DeliciaStore(storage, true);
    allDeliciaOpen(store); assert.ok(store.warning); assert.equal(store.persist(), false);
    assert.deepEqual(storage.data, before); assert.equal(store.import(JSON.stringify(freshDeliciaSave())), true);
    assert.equal(storage.data.get(DELICIA_SAVE_KEY), before.get(DELICIA_SAVE_KEY));
});

test('full, denied and unavailable storage still permit testing without leaking writes to normal saves', () => {
    for (const failure of ['quota', 'denied', 'null']) {
        const storage = memory([[SAVE_KEY, JSON.stringify(freshSave())], [DELICIA_SAVE_KEY, JSON.stringify(freshDeliciaSave())]]);
        const before = new Map(storage.data);
        storage.failWrites = failure === 'quota'; storage.failReads = failure === 'denied';
        const world = new ProgressStore(failure === 'null' ? null : storage, true);
        const delicia = new DeliciaStore(failure === 'null' ? null : storage, true);
        allWorldOpen(world); allDeliciaOpen(delicia);
        assert.equal(world.persist(), false); assert.equal(delicia.persist(), false);
        assert.ok(world.warning); assert.ok(delicia.warning);
        assert.deepEqual(storage.data, before); assert.deepEqual(storage.writes, []);
        allWorldOpen(new ProgressStore(failure === 'null' ? null : storage, true));
        allDeliciaOpen(new DeliciaStore(failure === 'null' ? null : storage, true));
    }
});

test('chapter and World share only the development profile and retain independently earned out-of-order receipts', () => {
    const original = JSON.stringify(freshSave(), null, 2), storage = memory([[SAVE_KEY, original]]);
    const world = new ProgressStore(storage, true), chapter = new ProgressStore(storage, true);
    const session = new GuairaChapterSession({ progress: chapter.save.guaira, developmentUnlocked: hasDevelopmentAccess(chapter.save) });
    for (const id of session.snapshot().route) assert.equal(session.canSelectScene(id, session.snapshot().generation), true);
    assert.deepEqual(session.snapshot().accepted, []); assert.equal(session.snapshot().chapterComplete, false);
    const selected = session.selectScene('guaira-prefeito', session.snapshot().generation)!;
    const attempt = session.enterScene('guaira-prefeito', selected.generation)!;
    assert.ok(attempt);
    const incomplete = { attempt, alive: true, state: 'playing', result: null };
    assert.equal(session.canContinue(attempt, incomplete), false); assert.equal(session.acceptCompletion(attempt, incomplete), false);
    const live = { ...incomplete, result: { sceneId: 'guaira-prefeito', kind: 'mayor-water-released' } } as const;
    assert.equal(session.acceptCompletion(attempt, { ...live, alive: false }), false);
    assert.equal(session.acceptCompletion(attempt, live), true);
    assert.equal(chapter.updateGuaira({ ...chapter.save.guaira, selectedScene: 'guaira-prefeito', completed: session.snapshot().accepted.map(r => r.sceneId) }), true);
    finishStage(world.save, '6-5', 'normal', 71); assert.equal(world.persist(), true);
    const reloaded = new ProgressStore(storage, true); allWorldOpen(reloaded);
    assert.deepEqual(reloaded.save.completed, ['6-5']); assert.deepEqual(reloaded.save.guaira.completed, ['guaira-prefeito']);
    assert.equal(reloaded.save.guaira.selectedScene, 'guaira-travessia', 'Existing latest-navigation merge contract remains intact');
    assert.equal(storage.data.get(SAVE_KEY), original);
    const restarted = new GuairaChapterSession({ progress: reloaded.save.guaira, developmentUnlocked: true });
    assert.deepEqual(restarted.snapshot().accepted.map(r => r.sceneId), ['guaira-prefeito']);
    assert.equal(restarted.snapshot().chapterComplete, false); assert.equal(restarted.retry(attempt), null);
    const replacement = restarted.restartChapter(restarted.snapshot().generation, { opening: 'guaira-patio-comportas' })!;
    assert.equal(replacement.canSelectScene('guaira-lab', replacement.snapshot().generation), true);
    assert.deepEqual(replacement.snapshot().accepted, []);
    assert.deepEqual(new ProgressStore(storage, false).save, freshSave());
});

test('development profile adapter rejects accidental foreign namespace access', () => {
    const storage = memory(), profile = developmentProfileStorage(storage, SAVE_KEY, true)!;
    assert.throws(() => profile.getItem(DELICIA_SAVE_KEY), /namespace/);
    assert.throws(() => profile.setItem(DELICIA_SAVE_KEY, '{}'), /namespace/);
    assert.deepEqual(storage.reads, []); assert.deepEqual(storage.writes, []);
    assert.equal(developmentProfileStorage(storage, SAVE_KEY, false), storage);
});

test('site builds opt in by default and explicit false reverses both production and preview development access', async t => {
    const previous = process.env.VITE_DEVELOPMENT_UNLOCKED_SAVE;
    t.after(() => { if (previous === undefined) delete process.env.VITE_DEVELOPMENT_UNLOCKED_SAVE; else process.env.VITE_DEVELOPMENT_UNLOCKED_SAVE = previous; });
    assert.equal(typeof viteConfig, 'function');
    if (typeof viteConfig !== 'function') throw Error('Expected mode-aware site configuration');
    delete process.env.VITE_DEVELOPMENT_UNLOCKED_SAVE;
    const development = await viteConfig({ command: 'build', mode: 'production' });
    assert.equal(development.define?.__FEKA_DEVELOPMENT_UNLOCKED_SAVE__, 'true');
    process.env.VITE_DEVELOPMENT_UNLOCKED_SAVE = 'false';
    const normal = await viteConfig({ command: 'build', mode: 'production' });
    assert.equal(normal.define?.__FEKA_DEVELOPMENT_UNLOCKED_SAVE__, 'false');
    const devServer = await viteConfig({ command: 'serve', mode: 'development' });
    assert.equal(devServer.define?.__FEKA_DEVELOPMENT_UNLOCKED_SAVE__, 'false');
});
