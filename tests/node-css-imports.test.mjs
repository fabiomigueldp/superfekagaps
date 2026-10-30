import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const loader = new URL('./helpers/nodeCssLoader.mjs', import.meta.url).href;
const run = source => spawnSync(process.execPath,
    ['--import', 'tsx', '--loader', loader, '--input-type=module', '--eval', source],
    { cwd: root, encoding: 'utf8', timeout: 10_000 });

test('Node can import the real TypeScript help graph with its side-effect styles', () => {
    const module = new URL('../src/adventure/WorldControlsHelp.ts', import.meta.url).href;
    const result = run(`import { WorldControlsHelp } from ${JSON.stringify(module)}; console.log(typeof WorldControlsHelp);`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'function');
});

test('missing CSS remains a module resolution error', () => {
    const missing = new URL('./helpers/missing-css-loader-regression.css', import.meta.url).href;
    const result = run(`import ${JSON.stringify(missing)};`);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
});

test('CSS module value imports are not silently replaced with fake exports', () => {
    const css = new URL('../src/engine/controls.css', import.meta.url).href;
    const result = run(`import styles from ${JSON.stringify(css)}; console.log(styles);`);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not provide an export named 'default'/);
});

test('non-CSS module failures still propagate through the loader', () => {
    const module = 'data:text/javascript,' + encodeURIComponent('throw new Error("ordinary-module-failure");');
    const result = run(`await import(${JSON.stringify(module)});`);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error: ordinary-module-failure/);
});
