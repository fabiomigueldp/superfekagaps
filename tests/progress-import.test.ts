import test from 'node:test';
import assert from 'node:assert/strict';
import { importProgressFile } from '../src/adventure/ProgressImport';
import { ProgressStore, freshSave, SAVE_KEY } from '../src/adventure/progress';

const file = (raw: string) => ({ text: async () => raw });
const replacement = JSON.stringify({ ...freshSave(), completed: ['1-1'], selected: '1-2' });

test('read errors and unsupported/corrupt files never invoke the write stage', async () => {
    let writes = 0;
    const store = { import: () => { writes++; return true; } };
    assert.equal(await importProgressFile({ text: async () => { throw Error('NotReadableError'); } }, store), 'unreadable');
    for (const raw of ['{', 'null', '{"version":2}', '[]'])
        assert.equal(await importProgressFile(file(raw), store), 'invalid');
    assert.equal(writes, 0);
});

test('quota failure preserves saved bytes and live save identity; retry commits exactly once', async () => {
    const initial = freshSave(); initial.completed = ['2-1'];
    let raw = JSON.stringify(initial), fail = true, writes = 0;
    const storage = { getItem: () => raw, setItem: (key: string, next: string) => {
        assert.equal(key, SAVE_KEY);
        if (fail) throw Error('QuotaExceededError');
        raw = next; writes++;
    } };
    const store = new ProgressStore(storage), original = store.save;
    assert.equal(await importProgressFile(file(replacement), store), 'storage-unavailable');
    assert.equal(store.save, original); assert.deepEqual(JSON.parse(raw), initial); assert.equal(writes, 0);
    fail = false;
    assert.equal(await importProgressFile(file(replacement), store), 'imported');
    assert.deepEqual(store.save.completed, ['1-1']); assert.equal(store.save.selected, '1-2');
    assert.deepEqual(new ProgressStore(storage).save, store.save); assert.equal(writes, 1); assert.equal(store.warning, '');
});

test('unavailable storage never installs a session-only import', async () => {
    const store = new ProgressStore(null), original = store.save;
    assert.equal(await importProgressFile(file(replacement), store), 'storage-unavailable');
    assert.equal(store.save, original);
    assert.equal(await importProgressFile(file(replacement), { import: () => { throw Error('SecurityError'); } }), 'storage-unavailable');
});

test('failed import retains corruption protection; successful explicit replacement clears it', () => {
    let raw = '{broken', fail = true, writes = 0;
    const store = new ProgressStore({ getItem: () => raw, setItem: (_key, next) => {
        if (fail) throw Error('Storage blocked'); raw = next; writes++;
    } });
    const original = store.save;
    assert.equal(store.import(replacement), false); assert.equal(store.save, original);
    fail = false;
    assert.equal(store.persist(), false); assert.equal(raw, '{broken'); assert.equal(writes, 0);
    assert.equal(store.import(replacement), true); assert.equal(writes, 1);
    assert.equal(store.persist(), true); assert.equal(writes, 2);
});

test('legacy v1 import keeps existing migration and sanitization behavior', async () => {
    let raw = '';
    const store = new ProgressStore({ getItem: () => raw, setItem: (_key, next) => { raw = next; } });
    const legacy = JSON.stringify({ version: 1, completed: ['3-5', '3-5', 'bad'], preferences: { music: 3 } });
    assert.equal(await importProgressFile(file(legacy), store), 'imported');
    assert.equal(store.save.version, 1); assert.deepEqual(store.save.completed, ['3-5']);
    assert.equal(store.save.legacySerraAccess, true); assert.equal(store.save.preferences.music, 1);
    assert.deepEqual(new ProgressStore({ getItem: () => raw, setItem: () => {} }).save, store.save);
});

test('stale read never commits after the chooser was replaced or disposed', async () => {
    let resolve!: (text: string) => void, active = true, writes = 0;
    const reading = new Promise<string>(done => { resolve = done; });
    const pending = importProgressFile({ text: () => reading }, { import: () => { writes++; return true; } }, () => active);
    active = false; resolve(replacement);
    assert.equal(await pending, 'cancelled'); assert.equal(writes, 0);
});
