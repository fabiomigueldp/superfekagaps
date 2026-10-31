/** Real editor controls, input and simulation in local Chromium. Only the RAF
 * clock, audio device and gamepad availability are controlled; storage is isolated.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<canvas id="game-canvas" tabindex="0" aria-label="Prévia da fase"></canvas><script type="module">
import { WorldEditor } from '/src/adventure/WorldEditor.ts';
import { STAGES } from '/src/adventure/campaign.ts';
import { freshSave, SAVE_KEY } from '/src/adventure/progress.ts';
import { controlPreferences } from '/src/engine/ControlPreferences.ts';
const saved=freshSave();saved.completed=['1-1'];saved.selected='1-2';
localStorage.setItem(SAVE_KEY,JSON.stringify(saved));
const storage=()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
const originalStorage=storage(),source=JSON.stringify(STAGES[0]);
let now=1000,id=0;const frames=new Map();
Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
window.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};
window.cancelAnimationFrame=id=>frames.delete(id);
const editor=new WorldEditor(document.querySelector('canvas'));
let playerAtStart;
window.h={editor,originalStorage,source,
  frame(count=1){for(let i=0;i<count;i++){now+=1000/60;const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(now);}},
  beginAttempt(){playerAtStart=editor.game.player;return this.sample();},
  sample(){const game=editor.game;return {preview:editor.preview,state:game.state,
    focus:document.activeElement.id||document.activeElement.tagName,
    player:game.player.getRect(),vy:game.player.data.velocity.y,grounded:game.player.data.isGrounded,
    samePlayer:game.player===playerAtStart};},
  preserved(){return {storage:storage(),keys:structuredClone(controlPreferences.keys),
    draft:JSON.stringify(editor.draft),history:JSON.stringify(editor.history),future:JSON.stringify(editor.future),
    source:JSON.stringify(STAGES[0])};}
};h.frame();
</script></html>`;

before(async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    appType: 'custom', server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'world-editor-focus', configureServer(vite) {
      vite.middlewares.use('/editor-fixture', (_request, response) => {
        response.setHeader('Content-Type', 'text/html'); response.end(fixture);
      });
    } }] });
  await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, viewport, remappedJump = false) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    assert.equal(new URL(route.request().url()).origin, base, 'only local requests'); return route.continue();
  });
  await page.addInitScript(remapped => {
    window.AudioContext = undefined; navigator.getGamepads = () => [];
    localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: {
      right: ['KeyL'], ...(remapped ? { jump: ['KeyK'] } : {}) } }));
    localStorage.setItem('unrelated-project-save', 'untouched');
  }, remappedJump);
  t.after(async () => { try { assert.deepEqual(errors, [], 'no browser errors'); } finally { await context.close(); } });
  await page.goto(base + '/editor-fixture'); await page.waitForFunction(() => !!window.h);
  const textarea = page.getByRole('textbox', { name: 'Dados da fase World' });
  const draft = JSON.parse(await textarea.inputValue()); draft.name += ' · Rascunho QA';
  await textarea.fill(JSON.stringify(draft)); await page.getByRole('button', { name: 'Aplicar JSON', exact: true }).click();
  const before = await page.evaluate(() => h.preserved());
  assert.deepEqual(before.storage, await page.evaluate(() => h.originalStorage), 'editor construction preserves the real save key');
  assert.equal(before.source, await page.evaluate(() => h.source), 'editing owns a separate draft');
  return { page, before, toggle: page.getByRole('button', { name: 'Jogar / editar', exact: true }) };
}

async function pressDuringFrame(page, key) {
  await page.keyboard.down(key); await page.evaluate(() => h.frame());
  await page.keyboard.up(key); return page.evaluate(() => { h.frame(); return h.sample(); });
}

async function artifact(page, label, data) {
  if (!process.env.BROWSER_ARTIFACT_DIR) return;
  await mkdir(process.env.BROWSER_ARTIFACT_DIR, { recursive: true });
  await writeFile(`${process.env.BROWSER_ARTIFACT_DIR}/${label}.json`, JSON.stringify(data, null, 2));
  await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/${label}.png` });
}

for (const compact of [false, true]) test(`${compact ? 'compact keyboard' : 'desktop pointer'} preview gives Space to gameplay and preserves the edited document`, async t => {
  const { page, before, toggle } = await setup(t, compact ? { width: 760, height: 600 } : { width: 1280, height: 800 });
  const observations = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    if (compact) { await toggle.focus(); await page.keyboard.press(attempt ? 'Space' : 'Enter'); }
    else await toggle.click();
    const entry = await page.evaluate(() => { h.frame(12); return h.beginAttempt(); });
    assert.equal(entry.preview, true); assert.equal(entry.state, 'playing'); assert.equal(entry.grounded, true);
    const jumped = await pressDuringFrame(page, 'Space'); observations.push({ entry, jumped });
    await artifact(page, `${compact ? 'compact' : 'desktop'}-${attempt}`, observations);
    assert.equal(jumped.preview, true, 'Space must jump instead of activating the editor toggle again');
    assert.equal(jumped.samePlayer, true, 'the attempt and player are not reloaded');
    assert.ok(jumped.vy < 0 && !jumped.grounded, 'the real player jumps');
    assert.equal(jumped.focus, 'game-canvas');
    const moved = await page.evaluate(() => h.sample());
    await page.keyboard.down('KeyL'); await page.evaluate(() => h.frame(10)); await page.keyboard.up('KeyL');
    assert.ok((await page.evaluate(() => h.sample())).player.x > moved.player.x, 'remapped movement still works');
    await toggle.click();
    assert.equal(await page.evaluate(() => h.editor.preview), false, 'explicit toggle returns to editing');
    assert.deepEqual(await page.evaluate(() => h.preserved()), before, 'preview preserves draft, undo/redo, source, saves and bindings');
  }
});

test('preview respects a persisted jump remap and Space stays unassigned', async t => {
  const { page, before, toggle } = await setup(t, { width: 1280, height: 800 }, true);
  await toggle.click(); await page.evaluate(() => { h.frame(12); h.beginAttempt(); });
  const space = await pressDuringFrame(page, 'Space');
  assert.equal(space.preview, true); assert.equal(space.samePlayer, true); assert.equal(space.grounded, true);
  const jump = await pressDuringFrame(page, 'KeyK');
  assert.equal(jump.preview, true); assert.equal(jump.samePlayer, true); assert.ok(jump.vy < 0 && !jump.grounded);
  await toggle.click(); assert.deepEqual(await page.evaluate(() => h.preserved()), before);
});
