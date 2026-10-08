import assert from 'node:assert/strict';
import test from 'node:test';
import { DELICIA_SAVE_KEY, DeliciaStore, freshDeliciaSave, parseDeliciaSave, completeDeliciaStage, awardDeliciaMedals } from '../src/adventure/delicia/DeliciaProgress';
import { developmentSaveKey } from '../src/adventure/DevelopmentProgress';

// Actual stores sharing an in-memory Storage boundary; no browser/user data.
function memory(raw: string | null = JSON.stringify(freshDeliciaSave())) {
    const data = new Map<string, string>(raw === null ? [] : [[DELICIA_SAVE_KEY, raw]]);
    return { data, failRead: false, failWrite: false, writes: 0,
        getItem(key: string) { if (this.failRead) throw Error('read unavailable'); return data.get(key) ?? null; },
        setItem(key: string, value: string) { if (this.failWrite) throw Error('quota'); data.set(key, value); this.writes++; },
    };
}
function earn(store: DeliciaStore) {
    completeDeliciaStage(store.save, 'delicia-1', 25);
    awardDeliciaMedals(store.save, 'delicia-1', { eligible: true, damage: 0, seals: 3, seconds: 25, parries: 0 });
    store.collect('delicia-1:seal-1', 'memoria');
}

test('stale volume autosave refuses to overwrite every newer earned field or checkpoint', () => {
    const storage = memory(), stale = new DeliciaStore(storage), active = new DeliciaStore(storage);
    earn(active); active.save.checkpoint = { stage: 'delicia-2', index: 0, valves: [] }; assert.equal(active.persist(), true);
    const durable = storage.data.get(DELICIA_SAVE_KEY), local = structuredClone(stale.save);
    stale.save.music = .1; local.music = .1;
    assert.equal(stale.persist(), false); assert.equal(storage.data.get(DELICIA_SAVE_KEY), durable);
    assert.deepEqual(stale.save, local); assert.equal(stale.warning, 'Progresso alterado em outra aba. Exporte esta sessão antes de recarregar.');
    assert.equal(stale.persist(), false, 'Retry never adopts the intervening snapshot.');
});

test('failed write retry cannot delete an intervening seal, including repeated retries', () => {
    const storage = memory(), a = new DeliciaStore(storage), b = new DeliciaStore(storage);
    storage.failWrite = true; a.collect('a'); assert.match(a.warning, /sessão/);
    storage.failWrite = false; b.collect('b'); const durable = storage.data.get(DELICIA_SAVE_KEY);
    for (let i = 0; i < 3; i++) assert.equal(a.persist(), false);
    assert.equal(storage.data.get(DELICIA_SAVE_KEY), durable); assert.deepEqual(a.save.collected, ['a']);
});

for (const seeded of [true, false]) test(`normal failed-write retry retains its baseline (${seeded ? 'legacy save' : 'missing save'})`, () => {
    const storage = memory(seeded ? JSON.stringify(freshDeliciaSave()) : null), store = new DeliciaStore(storage);
    storage.failWrite = true; earn(store); assert.equal(store.persist(), false);
    storage.failWrite = false; assert.equal(store.persist(), true); assert.equal(store.warning, '');
    assert.deepEqual(new DeliciaStore(storage).save, store.save); store.save.effects = .2;
    assert.equal(store.persist(), true); assert.equal(new DeliciaStore(storage).save.effects, .2);
});

for (const identical of [false, true]) test(`deliberate ${identical ? 'byte-identical' : 'fresh'} import invalidates unsaved old sessions`, () => {
    const original = freshDeliciaSave(); if (!identical) original.collected.push('old');
    const storage = memory(JSON.stringify(original)), stale = new DeliciaStore(storage), importer = new DeliciaStore(storage);
    storage.failWrite = true; stale.collect('unsaved'); storage.failWrite = false;
    assert.equal(importer.import(JSON.stringify(freshDeliciaSave())), true);
    const replacement = storage.data.get(DELICIA_SAVE_KEY)!;
    assert.equal(stale.persist(), false); assert.equal(storage.data.get(DELICIA_SAVE_KEY), replacement);
    assert.deepEqual(parseDeliciaSave(replacement), freshDeliciaSave());
});

test('import marker stays in storage across saves and reloads, never in portable data', () => {
    const storage = memory(), store = new DeliciaStore(storage); const portable = JSON.stringify(store.save);
    assert.equal(store.import(portable), true); const marker = JSON.parse(storage.data.get(DELICIA_SAVE_KEY)!).replacementId;
    assert.match(marker, /^v1:.+/); assert.equal(JSON.stringify(store.save), portable);
    store.collect('a'); assert.equal(JSON.parse(storage.data.get(DELICIA_SAVE_KEY)!).replacementId, marker);
    const reloaded = new DeliciaStore(storage); reloaded.collect('b');
    assert.equal(JSON.parse(storage.data.get(DELICIA_SAVE_KEY)!).replacementId, marker);
    const before = storage.data.get(DELICIA_SAVE_KEY); const old = new DeliciaStore(storage);
    assert.equal(reloaded.import(JSON.stringify(reloaded.save)), true);
    assert.notEqual(storage.data.get(DELICIA_SAVE_KEY), before); assert.equal(old.persist(), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reloaded.save, 'replacementId'), false);
});

test('failed import does not change save, baseline, or marker; subsequent normal retry works', () => {
    const storage = memory(), store = new DeliciaStore(storage); store.import(JSON.stringify(store.save));
    const before = storage.data.get(DELICIA_SAVE_KEY), previous = store.save;
    storage.failWrite = true; assert.equal(store.import(JSON.stringify(freshDeliciaSave())), false);
    assert.equal(store.save, previous); assert.equal(storage.data.get(DELICIA_SAVE_KEY), before);
    storage.failWrite = false; store.collect('retained'); assert.equal(store.warning, '');
    assert.equal(JSON.parse(storage.data.get(DELICIA_SAVE_KEY)!).replacementId, JSON.parse(before!).replacementId);
});

for (const raw of ['', '{broken', 'null', JSON.stringify({ ...freshDeliciaSave(), replacementId: 1 }), JSON.stringify({ ...freshDeliciaSave(), replacementId: '' })]) {
    test(`malformed stored snapshot is protected: ${raw.slice(0, 35)}`, () => {
        const storage = memory(raw), store = new DeliciaStore(storage); store.collect('session');
        assert.equal(store.persist(), false); assert.equal(storage.data.get(DELICIA_SAVE_KEY), raw); assert.equal(storage.writes, 0);
        assert.equal(store.import(JSON.stringify(freshDeliciaSave())), true); assert.equal(store.persist(), true);
    });
}

for (const changed of [null, '', '{broken']) test(`storage deletion/corruption after loading is never overwritten: ${changed}`, () => {
    const storage = memory(), store = new DeliciaStore(storage);
    if (changed === null) storage.data.delete(DELICIA_SAVE_KEY); else storage.data.set(DELICIA_SAVE_KEY, changed);
    store.collect('session'); assert.equal(store.persist(), false);
    assert.equal(storage.data.get(DELICIA_SAVE_KEY) ?? null, changed); assert.equal(storage.writes, 0);
});

test('read errors preserve storage and local progress until a verified retry or valid import', () => {
    const storage = memory(), store = new DeliciaStore(storage), original = storage.data.get(DELICIA_SAVE_KEY);
    storage.failRead = true; store.collect('session'); assert.equal(store.persist(), false);
    assert.equal(storage.data.get(DELICIA_SAVE_KEY), original);
    const unreadable = new DeliciaStore(storage); storage.failRead = false;
    assert.equal(unreadable.persist(), false); assert.equal(store.persist(), true);
    assert.equal(unreadable.import(JSON.stringify(freshDeliciaSave())), true);
});

test('same-tab stage/checkpoint/settings ownership is unchanged', () => {
    const storage = memory(), store = new DeliciaStore(storage);
    earn(store); store.save.selected = 'delicia-2'; store.save.checkpoint = { stage: 'delicia-2', index: 0, valves: [] };
    store.save.music = .12; store.save.effects = .23; store.save.reducedMotion = true; store.save.assists = true;
    assert.equal(store.persist(), true); assert.deepEqual(new DeliciaStore(storage).save, store.save);
    store.save.checkpoint = null; assert.equal(store.persist(), true); assert.equal(new DeliciaStore(storage).save.checkpoint, null);
});

test('development tabs conflict only within their profile after copy-on-read; real saves stay intact', () => {
    const storage = memory(), real = storage.data.get(DELICIA_SAVE_KEY), a = new DeliciaStore(storage, true), b = new DeliciaStore(storage, true);
    a.collect('dev'); const dev = storage.data.get(developmentSaveKey(DELICIA_SAVE_KEY));
    assert.equal(b.persist(), false); assert.equal(storage.data.get(developmentSaveKey(DELICIA_SAVE_KEY)), dev);
    const normal = new DeliciaStore(storage, false); normal.collect('real');
    a.collect('dev-2'); assert.equal(a.warning, '');
    const normalRaw = storage.data.get(DELICIA_SAVE_KEY); assert.notEqual(normalRaw, real);
    assert.equal(a.import(JSON.stringify(freshDeliciaSave())), true); assert.equal(storage.data.get(DELICIA_SAVE_KEY), normalRaw);
});

test('failed import cannot adopt a newer tab snapshot; explicit successful import can replace it', () => {
    const storage = memory(), stale = new DeliciaStore(storage), active = new DeliciaStore(storage);
    active.collect('active'); const newer = storage.data.get(DELICIA_SAVE_KEY), previous = stale.save;
    storage.failWrite = true; assert.equal(stale.import(JSON.stringify(freshDeliciaSave())), false);
    storage.failWrite = false; assert.equal(stale.persist(), false);
    assert.equal(stale.save, previous); assert.equal(storage.data.get(DELICIA_SAVE_KEY), newer);
    assert.throws(() => stale.import('{broken')); assert.equal(storage.data.get(DELICIA_SAVE_KEY), newer);
    assert.equal(stale.import(JSON.stringify(freshDeliciaSave())), true); stale.collect('replacement');
    assert.equal(stale.warning, ''); assert.deepEqual(new DeliciaStore(storage).save.collected, ['replacement']);
    assert.equal(active.persist(), false);
});

test('an intervening write during a read outage remains protected after the outage ends', () => {
    const storage = memory(), a = new DeliciaStore(storage), b = new DeliciaStore(storage);
    storage.failRead = true; a.collect('offline'); storage.failRead = false;
    b.collect('durable'); const before = storage.data.get(DELICIA_SAVE_KEY);
    assert.equal(a.persist(), false); assert.equal(storage.data.get(DELICIA_SAVE_KEY), before);
    assert.deepEqual(a.save.collected, ['offline']);
});
