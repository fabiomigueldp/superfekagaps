import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

/** Follow only runtime static imports, matching the eager browser module graph. */
function eagerModules(entry: string, seen = new Set<string>()): Set<string> {
    if (seen.has(entry)) return seen;
    seen.add(entry);
    const source = ts.createSourceFile(entry, readFileSync(entry, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
        if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) continue;
        if (ts.isExportDeclaration(node) && node.isTypeOnly) continue;
        const specifier = node.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
        const path = resolve(dirname(entry), specifier.text);
        const file = [path + '.ts', resolve(path, 'index.ts')].find(existsSync);
        if (file) eagerModules(file, seen);
    }
    return seen;
}

test('World boot keeps development tools outside its eager dependency graph and has no extras launcher', () => {
    const root = resolve('src');
    const graph = eagerModules(resolve(root, 'main.ts'));
    for (const file of ['game/Game.ts', 'editor/EditorController.ts', 'adventure/WorldEditor.ts',
        'voice/VoiceDirector.ts', 'data/levels/index.ts', 'adventure/experimental/hub/ExperimentalHub.ts']) {
        assert.equal(graph.has(resolve(root, file)), false, `${file} must load only when selected`);
    }
    assert.ok(graph.has(resolve(root, 'adventure/factory/FactoryCampaign.ts')), 'World remains eager with no new first-frame wait');
    assert.ok(eagerModules(resolve(root, 'game/ClassicEntry.ts')).has(resolve(root, 'game/Game.ts')));
    const entry = readFileSync(resolve(root, 'main.ts'), 'utf8');
    assert.match(entry, /import\('\.\/game\/ClassicEntry'\)/);
    assert.match(entry, /import\('\.\/adventure\/WorldEditor'\)/);
});

import { runInNewContext } from 'node:vm';

function boot(search: string, fail = false) {
    const calls: string[] = [], statuses: { textContent: string; removed: boolean }[] = [];
    let ready!: () => Promise<void>;
    class WorldGame {
        constructor() { calls.push('world'); }
        start() { calls.push('start'); }
        enableGamepadControls() { calls.push('gamepad'); }
        restoreGuairaReturn() { calls.push('map'); }
        openChapterMap(chapter: string) { calls.push('chapter:' + chapter); }
    }
    class Game {
        constructor() { calls.push('classic'); }
        start() { calls.push('start'); }
    }
    const canvas = { setAttribute() {}, addEventListener() {}, focus() { calls.push('focus'); } };
    const code = ts.transpileModule(readFileSync(resolve('src/main.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(code, {
        exports: {}, URLSearchParams, console: { log() {}, error() {} },
        window: { location: { search }, addEventListener(_event: string, callback: () => Promise<void>) { ready = callback; } },
        document: {
            getElementById: () => canvas, body: { append() {} },
            createElement() {
                const status = { textContent: '', removed: false, style: {}, setAttribute() {}, remove() { this.removed = true; } };
                statuses.push(status); return status;
            },
        },
        require(path: string) {
            if (path.endsWith('.css')) return {};
            if (path.endsWith('/WorldGame')) return { WorldGame };
            if (path.endsWith('/FactoryCampaign')) return { FactoryCampaign: WorldGame };
            calls.push('import:' + path);
            if (fail) throw new Error('chunk unavailable');
            if (path.endsWith('/ClassicEntry')) return { Game };
            if (path.endsWith('/WorldEditor')) return { WorldEditor: class { constructor() { calls.push('world-editor'); } } };
            throw new Error('Unexpected module ' + path);
        },
    });
    const done = ready();
    return { calls, statuses, done };
}

test('default World paints synchronously without optional imports or a loading overlay', async () => {
    const h = boot('');
    assert.deepEqual(h.calls, ['world', 'gamepad', 'start', 'focus']);
    assert.equal(h.statuses.length, 0);
    await h.done;
});

test('old Extras bookmarks start the same game without an intermediate menu', async () => {
    const h = boot('?experiments=1');
    await h.done;
    assert.deepEqual(h.calls, ['world', 'gamepad', 'start', 'focus']);
    assert.equal(h.statuses.length, 0);
});

test('legacy Guaira return still restores the journey without loading an extra menu', async () => {
    const h = boot('?guairaReturn=1');
    await h.done;
    assert.deepEqual(h.calls, ['world', 'gamepad', 'map', 'start', 'focus']);
    assert.equal(h.statuses.length, 0);
});

test('explicit optional routes load only their chosen mode and keep focus behavior', async () => {
    for (const [query, mode, focus] of [['?classic=true', 'classic', true], ['?editor=true', 'classic', false],
        ['?worldEditor=true&classic=true', 'world-editor', false]] as const) {
        const h = boot(query);
        assert.equal(h.calls.length, 0, 'optional constructors wait for the import');
        assert.equal(h.statuses[0].textContent, 'Carregando…');
        await h.done;
        assert.ok(h.calls.includes(mode));
        assert.equal(h.calls.includes('world'), false);
        assert.equal(h.calls.includes('gamepad'), false, 'Optional modes retain their own input owners');
        assert.equal(h.calls.includes('focus'), focus);
        assert.equal(h.calls.filter(call => call.startsWith('import:')).length, 1);
        assert.equal(h.statuses[0].removed, true);
    }
});

test('failed optional chunks leave a visible recovery message instead of an empty canvas', async () => {
    const h = boot('?classic=true', true);
    await h.done;
    assert.equal(h.calls.includes('start'), false);
    assert.equal(h.statuses[0].removed, false);
    assert.match(h.statuses[0].textContent, /Recarregue/);
});

for (const search of ['?delicia=true', '?chapter=delicia']) test(`Delícia bookmark ${search} uses World and its shared map`, async () => {
    const h = boot(search); await h.done;
    assert.deepEqual(h.calls, ['world', 'gamepad', 'start', 'focus', 'chapter:delicia']);
    assert.equal(h.statuses.length, 0);
});
