import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

// Use the real editor DOM and inspector rebuild path with isolated in-memory triggers.
const fixture = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(
    '<script type="module" src="/src/main.ts"></script>', `<script type="module">
import { EditorController } from '/src/editor/EditorController.ts';
import { Renderer } from '/src/engine/Renderer.ts';
import { MUSIC_TRACKS } from '/src/engine/audioCatalog.ts';
const canvas = document.getElementById('game-canvas');
const editor = new EditorController(canvas, new Renderer(canvas));
document.getElementById('editor-ui').style.display = 'block';
const base = { x: 0, y: 0, width: 32, height: 32, active: true, oneShot: false };
const audio = { ...base, id: 'audio', type: 'AUDIO', trackId: Object.keys(MUSIC_TRACKS)[0], action: 'PLAY' };
const dialog = { ...base, id: 'dialog', type: 'DIALOG', text: 'Original dialogue' };
editor.levelData.triggers = [audio, dialog];
window.h = { editor, audio, dialog,
    select(kind) { editor.activeSelection = { type: 'TRIGGER', data: kind === 'audio' ? audio : dialog }; editor.updateInspector(); }
};
h.select('audio');
</script>`);

test('trigger inspector labels survive value edits and rebuilding without duplicate IDs', async t => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
        configFile: false, appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'inspector-label-fixture', configureServer(vite) {
            vite.middlewares.use('/inspector-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    t.after(() => server.close());
    await server.listen();
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/inspector-fixture');
    await page.waitForFunction(() => !!window.h);
    const inspector = page.locator('#inspector-content');
    t.diagnostic(await inspector.ariaSnapshot());
    await page.evaluate(() => h.select('dialog'));
    t.diagnostic(await inspector.ariaSnapshot());
    await page.evaluate(() => h.select('audio'));
    const tracks = await page.locator('#inspector-content select').first().locator('option').evaluateAll(options => options.map(o => o.value));
    assert.ok(tracks.length > 2);
    for (let iteration = 0; iteration < 2; iteration++) {
        await page.evaluate(() => h.select('audio'));
        const track = inspector.getByRole('combobox', { name: 'Track ID', exact: true });
        const action = inspector.getByRole('combobox', { name: 'Action', exact: true });
        assert.equal(await track.count(), 1); assert.equal(await action.count(), 1);
        assert.equal(await inspector.locator('select').evaluateAll(fields => fields.every(field =>
            field.labels.length === 1 && field.labels[0].control === field)), true);
        await track.selectOption(tracks[iteration + 1]);
        await action.selectOption(iteration ? 'PLAY' : 'STOP');
        assert.deepEqual(await page.evaluate(() => [h.audio.trackId, h.audio.action]),
            [tracks[iteration + 1], iteration ? 'PLAY' : 'STOP']);
        await page.evaluate(() => h.select('dialog'));
        const text = inspector.getByRole('textbox', { name: 'Text', exact: true });
        await text.fill('Edited dialogue ' + iteration); await text.press('Tab');
        assert.equal(await page.evaluate(() => h.dialog.text), 'Edited dialogue ' + iteration);
        await page.evaluate(() => h.select('audio'));
        assert.equal(await track.inputValue(), tracks[iteration + 1]);
        assert.equal(await action.inputValue(), iteration ? 'PLAY' : 'STOP');
        await page.evaluate(() => h.select('dialog'));
        assert.equal(await text.inputValue(), 'Edited dialogue ' + iteration);
        assert.equal(await page.locator('#inspector-content').evaluate(root => {
            const field = root.querySelector('textarea');
            return field.labels.length === 1 && field.labels[0].control === field;
        }), true);
        const ids = await page.locator('[id]').evaluateAll(elements => elements.map(e => e.id));
        assert.equal(new Set(ids).size, ids.length, 'rebuilding must not duplicate IDs');
    }
    assert.deepEqual(errors, [], 'no browser errors');
});
