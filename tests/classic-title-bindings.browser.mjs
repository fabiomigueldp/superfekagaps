import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic title shows effective live bindings without truncation and preserves touch hints', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-bitmap-labels',
      transform(code, id) {
        if (id.endsWith('/src/graphics/BitmapFont.ts')) return code.replace('  x = Math.round(x -',
          '  window.drawnText?.push({value,x,y,width:textWidth(value,scale)});\n  x = Math.round(x -');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/title-fixture', route => route.fulfill({ contentType: 'text/html', body: '<div id="evidence"></div>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/title-fixture');
  const result = await page.evaluate(async () => {
    const { GameUI } = await import('/src/graphics/GameUI.ts');
    const { SpriteAtlas } = await import('/src/graphics/pixels.ts');
    const { controlPreferences, DEFAULT_KEYS, keyAction, saveControls } = await import('/src/engine/ControlPreferences.ts');
    const ui = new GameUI(new SpriteAtlas()), runs = [];
    const draw = (name, touch = false) => {
      const label = document.createElement('div'); label.textContent = name;
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      canvas.style = 'width:640px;height:360px;image-rendering:pixelated;display:block';
      document.getElementById('evidence').append(label, canvas);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#b5dce3'; ctx.fillRect(0, 0, 320, 180);
      window.drawnText = []; ui.title(ctx, 0, touch);
      runs.push({ name, hints: window.drawnText.filter(text => text.y > 101) });
    };
    draw('default');
    Object.assign(controlPreferences.keys, { left: ['KeyI'], right: ['KeyL'], jump: ['KeyI', 'KeyK'],
      run: ['ControlRight'], down: ['PageDown'], pause: ['F10'], mute: [] });
    saveControls();
    draw('remapped live'); draw('touch', true);
    const effective = { I: keyAction('KeyI'), K: keyAction('KeyK') };
    for (const action of ['left', 'right', 'jump', 'run', 'down', 'pause', 'mute']) {
      controlPreferences.keys[action] = [action + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    }
    saveControls(); draw('long labels');
    for (const action of Object.keys(controlPreferences.keys)) controlPreferences.keys[action] = [];
    saveControls(); draw('unbound');
    controlPreferences.keys = structuredClone(DEFAULT_KEYS); saveControls(); draw('restored live');
    return { runs, effective };
  });
  await page.locator('#evidence').screenshot({ path: process.env.TITLE_CAPTURE || '/tmp/feka-title-bindings.png' });
  t.diagnostic(JSON.stringify(result));
  const [defaults, remapped, touch, long, unbound, restored] = result.runs;
  const text = remapped.hints.map(hint => hint.value).join(' ');
  for (const expected of ['ESQUERDA: I', 'DIREITA: L', 'PULAR: K', 'CORRER: ControlRight', 'SENTADA NO AR: PageDown', 'PAUSA: F10', 'SOM: SEM TECLA']) {
    assert.ok(text.includes(expected), `effective hint: ${expected}`);
  }
  assert.deepEqual(result.effective, { I: 'left', K: 'jump' });
  assert.deepEqual(restored.hints, defaults.hints);
  const unboundText = unbound.hints.map(hint => hint.value).join(' ');
  assert.equal((unboundText.match(/SEM TECLA/g) || []).length, 6);
  assert.ok(unboundText.includes('PAUSA: Esc'), 'Input retains its Escape fallback');
  assert.deepEqual(touch.hints.map(hint => hint.value), ['← → MOVER   X CORRER   ↑ PULAR', '↓ NO AR: SENTADA   TOPO: PAUSA']);
  const longText = long.hints.map(hint => hint.value).join(' ');
  for (const action of ['left', 'right', 'jump', 'run', 'down', 'pause', 'mute']) assert.ok(longText.includes(action + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
  for (const run of result.runs) for (const hint of run.hints) {
    assert.ok(hint.width <= 304, `${run.name}: fits native width`);
    assert.ok(hint.y >= 105 && hint.y <= 172, `${run.name}: stays below start button and inside canvas`);
    assert.ok(!hint.value.includes('...'));
  }
  assert.deepEqual(errors, []);
});
