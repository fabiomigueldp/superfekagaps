import test from 'node:test';
import assert from 'node:assert/strict';
import { importProgressFile } from '../src/adventure/ProgressImport';
import { ProgressStore, freshSave, parseSave, SAVE_KEY } from '../src/adventure/progress';
import { DeliciaStore, freshDeliciaSave, parseDeliciaSave, DELICIA_SAVE_KEY } from '../src/adventure/delicia/DeliciaProgress';

function memoryStorage(key: string, initial: string) {
    let raw = initial, writes = 0;
    return {
        get raw() { return raw; },
        get writes() { return writes; },
        getItem(readKey: string) { assert.equal(readKey, key); return raw; },
        setItem(writeKey: string, next: string) { assert.equal(writeKey, key); raw = next; writes++; },
    };
}

const worldExport = () => JSON.stringify({ ...freshSave(), completed: ['1-1'], selected: '1-2', seals: ['1-1:s1'] });
const deliciaExport = () => JSON.stringify({ ...freshDeliciaSave(), completed: ['delicia-1'], selected: 'delicia-2', collected: ['delicia-1:s1'] });

test('World rejects Delícia exports before replacing saved bytes or session progress', async () => {
    const storage = memoryStorage(SAVE_KEY, worldExport()), store = new ProgressStore(storage), previous = store.save;
    for (const raw of [deliciaExport(), JSON.stringify(freshDeliciaSave())]) {
        assert.equal(await importProgressFile({ text: async () => raw }, store), 'invalid');
        assert.throws(() => store.import(raw));
        assert.equal(store.save, previous);
        assert.equal(storage.raw, worldExport()); assert.equal(storage.writes, 0);
    }
});

test('Delícia rejects World exports before replacing saved bytes or session progress', () => {
    const storage = memoryStorage(DELICIA_SAVE_KEY, deliciaExport()), store = new DeliciaStore(storage), previous = store.save;
    for (const raw of [worldExport(), JSON.stringify(freshSave())]) {
        assert.throws(() => store.import(raw));
        assert.equal(store.save, previous);
        assert.equal(storage.raw, deliciaExport()); assert.equal(storage.writes, 0);
    }
});

test('foreign saves in either storage slot stay protected until a valid explicit import', () => {
    const worldStorage = memoryStorage(SAVE_KEY, deliciaExport()), world = new ProgressStore(worldStorage);
    const deliciaStorage = memoryStorage(DELICIA_SAVE_KEY, worldExport()), delicia = new DeliciaStore(deliciaStorage);
    assert.equal(world.persist(), false); assert.equal(delicia.persist(), false);
    assert.ok(world.warning); assert.ok(delicia.warning);
    assert.equal(worldStorage.raw, deliciaExport()); assert.equal(worldStorage.writes, 0);
    assert.equal(deliciaStorage.raw, worldExport()); assert.equal(deliciaStorage.writes, 0);
    assert.equal(world.import(worldExport()), true); assert.equal(delicia.import(deliciaExport()), true);
    assert.equal(world.persist(), true); assert.equal(delicia.persist(), true);
    assert.deepEqual(new ProgressStore(worldStorage).save, world.save);
    assert.deepEqual(new DeliciaStore(deliciaStorage).save, delicia.save);
});

test('older v1 exports retain their own progress and are rejected by the other campaign', () => {
    const olderWorld = JSON.stringify({ version: 1, completed: ['3-5', '3-5', 'bad'], seals: ['3-4:s2'], preferences: { music: 3 } });
    const olderDelicia = JSON.stringify({ version: 1, completed: ['delicia-1', 'delicia-1', 'bad'], collected: ['delicia-1:s1'], lore: ['carta'], music: 3 });
    const world = parseSave(olderWorld), delicia = parseDeliciaSave(olderDelicia);
    assert.deepEqual(world.completed, ['3-5']); assert.equal(world.legacySerraAccess, true);
    assert.deepEqual(world.seals, ['3-4:s2']); assert.equal(world.preferences.music, 1);
    assert.deepEqual(delicia.completed, ['delicia-1']); assert.deepEqual(delicia.collected, ['delicia-1:s1']); assert.equal(delicia.music, 1);
    assert.deepEqual(parseSave(JSON.stringify(world)), world);
    assert.deepEqual(parseDeliciaSave(JSON.stringify(delicia)), delicia);
    assert.throws(() => parseSave(olderDelicia)); assert.throws(() => parseDeliciaSave(olderWorld));
});

test('sparse v1 saves keep their established defaults and sanitization', () => {
    assert.deepEqual(parseSave('{"version":1}'), freshSave());
    assert.deepEqual(parseDeliciaSave('{"version":1}'), freshDeliciaSave());
    const ambiguous = '{"version":1,"completed":[],"times":{}}';
    assert.deepEqual(parseSave(ambiguous), freshSave());
    assert.deepEqual(parseDeliciaSave(ambiguous), freshDeliciaSave());
    assert.deepEqual(parseSave('{"version":1,"completed":["1-1","bad"]}').completed, ['1-1']);
    assert.deepEqual(parseDeliciaSave('{"version":1,"completed":["delicia-1","bad"]}').completed, ['delicia-1']);
    assert.throws(() => parseSave('{"version":1,"completed":["delicia-1"]}'));
    assert.throws(() => parseDeliciaSave('{"version":1,"completed":["1-1"]}'));
});

test('foreign checkpoint and record identifiers are rejected before they are discarded', () => {
    assert.throws(() => parseSave('{"version":1,"checkpoint":{"stage":"delicia-raizes","index":0}}'), /Save da Delícia/);
    assert.throws(() => parseSave('{"version":1,"times":{"delicia-2":42}}'), /Importe na expansão Delícia/);
    assert.throws(() => parseDeliciaSave('{"version":1,"checkpoint":{"stage":"2-3","index":0}}'), /Save do World/);
    assert.throws(() => parseDeliciaSave('{"version":1,"times":{"2-3":42}}'), /Importe na campanha World/);
});

test('unknown own-campaign fields and stage identifiers retain forward-compatible sanitization', () => {
    const world = parseSave(JSON.stringify({ ...freshSave(), completed: ['1-1', 'future-stage'], lore: ['new-lore'], collected: ['new-item'], extension: { stage: 'delicia-1' } }));
    const delicia = parseDeliciaSave(JSON.stringify({ ...freshDeliciaSave(), completed: ['delicia-1', 'future-stage'], seals: ['new-item'], preferences: { future: true }, extension: { stage: '1-1' } }));
    assert.deepEqual(world.completed, ['1-1']); assert.deepEqual(delicia.completed, ['delicia-1']);
    assert.deepEqual(parseSave(JSON.stringify(world)), world);
    assert.deepEqual(parseDeliciaSave(JSON.stringify(delicia)), delicia);
});
