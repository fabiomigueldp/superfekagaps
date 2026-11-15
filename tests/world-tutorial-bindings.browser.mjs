import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('World contextual lessons use effective bindings after loading and live remapping', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({
    keys: { left: ['KeyI'], right: ['KeyI', 'KeyL'], jump: ['KeyI', 'KeyK'],
      run: ['KeyI', 'KeyR'], down: ['KeyI', 'KeyS'] }, pads: {} })));
  await page.route('**/tutorial-fixture', route => route.fulfill({ contentType: 'text/html', body: '<main>Contextual tutorial fixture</main>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/tutorial-fixture');
  const result = await page.evaluate(async () => {
    const { WorldTutorial } = await import('/src/adventure/WorldTutorial.ts');
    const { ProgressStore, SAVE_KEY } = await import('/src/adventure/progress.ts');
    const { Player } = await import('/src/entities/Player.ts');
    const { controlPreferences, DEFAULT_KEYS, keyAction, saveControls } = await import('/src/engine/ControlPreferences.ts');
    const store = new ProgressStore(null, false), tutorial = new WorldTutorial(store), player = new Player(5, 10);
    player.data.isGrounded = true;
    const persisted = localStorage.getItem(SAVE_KEY), unchanged = [];
    const cue = (lesson, touch = false) => {
      store.save.seen = lesson === 'run' ? ['control:jump'] : [];
      const before = JSON.stringify(store.save);
      const stage = lesson === 'pound' ? { id: '2-2', mechanisms: [{ kind: 'switch', x: 80, y: 160, width: 32, height: 16 }] }
        : { id: '1-1', mechanisms: [] };
      const result = tutorial.cue(stage, player.data, touch);
      unchanged.push(before === JSON.stringify(store.save));
      return result.lines.slice(0, -1).join(' ');
    };
    const sample = () => ['jump', 'run', 'pound'].map(lesson => cue(lesson));
    const loaded = sample(), touch = ['jump', 'run', 'pound'].map(lesson => cue(lesson, true));
    const resolution = { I: keyAction('KeyI'), K: keyAction('KeyK'), R: keyAction('KeyR') };
    for (const action of ['right', 'jump', 'run', 'down']) controlPreferences.keys[action] = ['KeyI'];
    saveControls(); const shadowed = sample();
    controlPreferences.keys.jump = ['KeyK']; saveControls(); const downShadowed = cue('pound');
    controlPreferences.keys = structuredClone(DEFAULT_KEYS); saveControls(); const restored = sample();
    return { loaded, touch, resolution, shadowed, downShadowed, restored, unchanged,
      noProgressWrite: persisted === localStorage.getItem(SAVE_KEY) };
  });
  t.diagnostic(JSON.stringify(result));
  assert.deepEqual(result.resolution, { I: 'left', K: 'jump', R: 'run' });
  assert.deepEqual(result.loaded, ['K PARA PULAR', 'SEGURE R + L PARA CORRER', 'PULE K, DEPOIS S NO AR']);
  assert.deepEqual(result.shadowed, ['PULAR: SEM TECLA DISPONÍVEL', 'CORRER: SEM TECLA DISPONÍVEL', 'PULAR: SEM TECLA DISPONÍVEL']);
  assert.equal(result.downShadowed, 'SENTADA / BAIXO: SEM TECLA DISPONÍVEL');
  assert.deepEqual(result.restored, ['ESPAÇO PARA PULAR', 'SEGURE SHIFT ESQ. + → PARA CORRER', 'PULE ESPAÇO, DEPOIS ↓ NO AR']);
  assert.deepEqual(result.touch, ['↑ PARA PULAR', 'SEGURE X + → PARA CORRER', 'PULE ↑, DEPOIS ↓ NO AR']);
  assert.ok(result.unchanged.every(Boolean)); assert.equal(result.noProgressWrite, true); assert.deepEqual(errors, []);
});
