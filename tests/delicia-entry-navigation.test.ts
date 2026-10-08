import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

for (const [old, expected] of [
    ['https://game.example/delicia.html', 'https://game.example/?chapter=delicia'],
    ['https://game.example/world/releases/candidate/delicia.html', 'https://game.example/world/releases/candidate/?chapter=delicia'],
    ['https://game.example/world/?delicia=true', 'https://game.example/world/?chapter=delicia'],
]) test(`legacy entry ${old} opens the campaign at the same deployment prefix`, () => {
    const replacements: string[] = [];
    const source = readFileSync(new URL('../src/adventure/delicia/entry.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    // No DOM, storage, module loader or animation clock: a legacy link cannot start a second game or overwrite progress.
    runInNewContext(code, { URL, window: { location: { href: old, replace: (url: string) => replacements.push(url) } } });
    assert.deepEqual(replacements, [expected]);
});
