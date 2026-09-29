import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { FileSystemManager } from '../src/editor/FileSystemManager';
import { normalizeLevelData, parseLevelFromText, serializeLevelToTS } from '../src/editor/levelSerialization';
import { CollectibleType, EnemyType, TriggerType, type LevelData } from '../src/types';

function fixture(): LevelData {
    return {
        id: 'roundtrip', name: 'João: "___TILES_PLACEHOLDER___" / /* céu */',
        width: 3, height: 2, originX: -2, originY: -1,
        tiles: [[0, 2, 3], [1, 19, 0]],
        playerSpawn: { x: -1.5, y: -1 }, goalPosition: { x: 0, y: 0 },
        enemies: [{ type: EnemyType.MINION, position: { x: -0.5, y: 0 } }],
        collectibles: [{ type: CollectibleType.HELMET, position: { x: 0, y: 0 } }],
        checkpoints: [], timeLimit: 300, isBossLevel: false,
        triggers: [
            { id: 'dialog', type: TriggerType.DIALOG, x: -16, y: 0, width: 16, height: 16, oneShot: true, active: true, text: 'Olá\n"type": "MINION"; {a} // fim' },
            { id: 'audio', type: TriggerType.AUDIO, x: 0, y: 0, width: 16, height: 16, oneShot: false, active: true, trackId: 'world', action: 'PLAY' },
            { id: 'camera', type: TriggerType.CAMERA, x: 0, y: 0, width: 16, height: 16, oneShot: false, active: true, zoom: 1.5, lockX: true, lockY: false },
            { id: 'damage', type: TriggerType.DAMAGE, x: 0, y: 0, width: 16, height: 16, oneShot: false, active: true, damagePerTick: 1, instantKill: false },
        ],
        theme: { skyGradient: ['#000000', '#ffffff'], layers: [{ type: 'clouds', color: 'rgba(0,0,0,0.5)', scrollFactor: 0.2, speedX: -1 }] },
    };
}

test('all campaign levels import and round-trip without losing data', () => {
    const directory = resolve('src/data/levels');
    for (const name of readdirSync(directory).filter(name => name !== 'index.ts' && name.endsWith('.ts'))) {
        const level = parseLevelFromText(readFileSync(resolve(directory, name), 'utf8'));
        assert.deepEqual(parseLevelFromText(serializeLevelToTS(level)), level, name);
        assert.ok(Array.isArray(level.triggers));
    }
});
test('enums, negative origins, trigger fields, escaping and placeholder-like text survive export', () => {
    const level = fixture();
    const before = structuredClone(level);
    const output = serializeLevelToTS(level);
    assert.deepEqual(parseLevelFromText(output), before);
    assert.deepEqual(level, before, 'serializing must not mutate the active editor document');
    assert.match(output, /EnemyType\.MINION/);
    assert.match(output, /CollectibleType\.HELMET/);
    assert.match(output, /TriggerType\.DIALOG/);
    assert.match(output, /import type \{ LevelData \}/);
});

test('generated files pass strict TypeScript checks with every trigger and entity enum', () => {
    const filename = resolve('src/data/levels/__persistence_typecheck__.ts');
    const source = serializeLevelToTS(fixture());
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, onError, createNew) => resolve(path) === filename
        ? ts.createSourceFile(path, source, languageVersion, true)
        : getSourceFile(path, languageVersion, onError, createNew);
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => process.cwd(), getCanonicalFileName: path => path, getNewLine: () => '\n',
    }));
});

test('data-only parser supports comments, literal keys, trailing commas and known constants', () => {
    let source = serializeLevelToTS(fixture());
    source = source.replace('"width": 3', 'width: 3 /* tiles */')
        .replace('"timeLimit": 300', 'timeLimit: GAME_WIDTH')
        .replace('"id": "roundtrip"', "id: 'roundtrip'")
        .replace('"scrollFactor": 0.2', 'scrollFactor: .2')
        .replace('export const DATA: LevelData =', 'export const DATA =')
        .replace(/};\n$/, ',} satisfies LevelData; // done\n');
    assert.equal(parseLevelFromText(source).timeLimit, 320);
    assert.equal(parseLevelFromText(source).id, 'roundtrip');
    assert.deepEqual(parseLevelFromText(JSON.stringify(fixture())), fixture());
});

test('imports reject executable content, duplicate fields, malformed enums and broken grids', () => {
    const serialized = serializeLevelToTS(fixture());
    for (const source of [
        `${serialized}\nglobalThis.__levelImportExecuted = true;`,
        serialized.replace('"width": 3', '"width": (() => { globalThis.__levelImportExecuted = true; return 3; })()'),
        serialized.replace('EnemyType.MINION', 'EnemyType.constructor'),
        serialized.replace('"width": 3', '"width": 3, "width": 4'),
        serialized.replace('"width": 3', '"width": 4'),
        serialized.replace('"id": "roundtrip"', '"__proto__": {}, "id": "roundtrip"'),
    ]) assert.throws(() => parseLevelFromText(source));
    assert.equal((globalThis as Record<string, unknown>).__levelImportExecuted, undefined);
});

test('validation requires complete object lists and refuses non-finite or invalid trigger data', () => {
    const incomplete = fixture() as unknown as Record<string, unknown>;
    delete incomplete.triggers;
    assert.throws(() => normalizeLevelData(incomplete), /triggers/);
    assert.equal(incomplete.triggers, undefined, 'normalization must not mutate the input');
    const badNumber = fixture();
    badNumber.playerSpawn.x = NaN;
    assert.throws(() => normalizeLevelData(badNumber), /finito/);
    const badTrigger = fixture();
    badTrigger.triggers[0].width = 0;
    assert.throws(() => normalizeLevelData(badTrigger), /width/);
    badTrigger.triggers[0].width = 16;
    badTrigger.triggers[1].id = badTrigger.triggers[0].id;
    assert.throws(() => normalizeLevelData(badTrigger), /único/);
});

function fakeStorage() {
    const state = { content: serializeLevelToTS(fixture()), pending: '', writes: 0, aborts: 0, failWrite: false, failClose: false };
    const file = {
        getFile: async () => ({ text: async () => state.content }),
        createWritable: async () => ({
            write: async (content: string) => { state.writes++; state.pending = content; if (state.failWrite) throw new Error('disk full'); },
            close: async () => { if (state.failClose) throw new Error('commit failed'); state.content = state.pending; },
            abort: async () => { state.aborts++; state.pending = ''; },
        }),
    };
    const directory = {
        name: 'levels', getFileHandle: async () => file,
        async *values() { for (const name of ['index.ts', 'level_10.ts', 'other.d.ts', 'level_2.ts']) yield { name, kind: 'file' }; },
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { showDirectoryPicker: async () => directory } });
    return state;
}

test('filesystem preserves previous data on invalid input, conflicts and failed writes', async () => {
    const state = fakeStorage();
    const manager = new FileSystemManager();
    assert.equal(await manager.mount(), true);
    assert.deepEqual(await manager.listLevels(), ['level_2.ts', 'level_10.ts']);
    const level = await manager.readLevel('level_2.ts');
    const original = state.content;
    level.name = 'edited';
    const invalid = structuredClone(level);
    invalid.tiles[0].pop();
    await assert.rejects(manager.saveLevel('level_2.ts', invalid));
    assert.equal(state.writes, 0);
    await assert.rejects(manager.saveLevel('../level_2.ts', level));
    await assert.rejects(manager.saveLevel('index.ts', level));
    state.content += '\n// external edit';
    await assert.rejects(manager.saveLevel('level_2.ts', level), /alterado fora/);
    assert.equal(state.writes, 0);
    state.content = 'unfinished external edits';
    await assert.rejects(manager.readLevel('level_2.ts'));
    await assert.rejects(manager.saveLevel('level_2.ts', level), /alterado fora/);
    assert.equal(state.writes, 0, 'a failed reload must keep the last successful read as its conflict baseline');
    state.content = original;
    state.failWrite = true;
    await assert.rejects(manager.saveLevel('level_2.ts', level), /disk full/);
    assert.equal(state.content, original);
    assert.equal(state.aborts, 1);
    state.failWrite = false;
    state.failClose = true;
    await assert.rejects(manager.saveLevel('level_2.ts', level), /commit failed/);
    assert.equal(state.content, original);
    assert.equal(state.aborts, 2);
    state.failClose = false;
    await manager.saveLevel('level_2.ts', level);
    assert.equal(parseLevelFromText(state.content).name, 'edited');
    await manager.saveLevel('level_2.ts', level);
    delete (globalThis as Record<string, unknown>).window;
});

test('creating a level refuses to overwrite an existing filename', async () => {
    const files = new Map<string, string>();
    const directory = {
        async getFileHandle(name: string, options?: { create?: boolean }) {
            if (!files.has(name)) {
                if (!options?.create) throw new DOMException('missing', 'NotFoundError');
                files.set(name, '');
            }
            return {
                getFile: async () => ({ text: async () => files.get(name)! }),
                createWritable: async () => ({
                    write: async (content: string) => { files.set(name, content); },
                    close: async () => {}, abort: async () => {}
                })
            };
        }
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { showDirectoryPicker: async () => directory } });
    try {
        const manager = new FileSystemManager();
        await manager.mount();
        await manager.createLevel('level_new.ts', fixture());
        const original = files.get('level_new.ts');
        assert.equal(parseLevelFromText(original!).id, 'roundtrip');
        await assert.rejects(manager.createLevel('level_new.ts', fixture()), /Já existe/);
        assert.equal(files.get('level_new.ts'), original);
    } finally {
        delete (globalThis as Record<string, unknown>).window;
    }
});

test('concurrent saves cannot commit an older document over a newer one', async () => {
    const state = fakeStorage();
    const manager = new FileSystemManager();
    await manager.mount();
    await manager.readLevel('level_2.ts');
    const first = fixture();
    first.name = 'first snapshot';
    const later = fixture();
    later.name = 'later snapshot';
    const pending = manager.saveLevel('level_2.ts', first);
    await assert.rejects(manager.saveLevel('level_2.ts', later), /salvamento atual/);
    await pending;
    assert.equal(parseLevelFromText(state.content).name, 'first snapshot');
    await manager.saveLevel('level_2.ts', later);
    assert.equal(parseLevelFromText(state.content).name, 'later snapshot');
    delete (globalThis as Record<string, unknown>).window;
});

test('canceling a mount preserves its directory and unsupported browsers fail clearly', async () => {
    fakeStorage();
    const manager = new FileSystemManager();
    await manager.mount();
    window.showDirectoryPicker = async () => { throw new DOMException('cancel', 'AbortError'); };
    assert.equal(await manager.mount(), false);
    assert.equal(manager.isMounted, true);
    window.showDirectoryPicker = async () => { throw new DOMException('permission denied', 'NotAllowedError'); };
    await assert.rejects(manager.mount(), /permission denied/);
    assert.equal(manager.isMounted, true);
    delete (globalThis as Record<string, unknown>).window;
    assert.equal(manager.isSupported, false);
    await assert.rejects(manager.mount(), /Chrome ou Edge/);
});
