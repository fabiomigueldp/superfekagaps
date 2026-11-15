import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('World journal presents pending, legacy and released water consistently on the same page', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-journal-text',
      transform(code, id) {
        if (id.endsWith('/src/graphics/BitmapFont.ts')) return code.replace('  x = Math.round(x -',
          '  window.drawnText?.push({value,x,y,width:textWidth(value,scale)});\n  x = Math.round(x -');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/journal-fixture', route => route.fulfill({ contentType: 'text/html', body: '<main id="evidence"></main>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/journal-fixture');
  const results = await page.evaluate(async () => {
    const { WorldGame } = await import('/src/adventure/WorldGame.ts');
    const { JournalAccessibility } = await import('/src/adventure/JournalAccessibility.ts');
    const { ProgressStore } = await import('/src/adventure/progress.ts');
    const { campaignJournal } = await import('/src/adventure/CampaignJournal.ts');
    const { guairaChapterRoute } = await import('/src/adventure/experimental/guaira/chapter/GuairaChapterProgress.ts');
    const store = new ProgressStore(null, false), canvas = document.createElement('canvas');
    const accessible = new JournalAccessibility(canvas);
    // Run the real gallery renderer without starting the campaign, input or persistence hosts.
    const game = Object.assign(Object.create(WorldGame.prototype), { store, galleryWorld: 7, buttons: [], menuSelection: 0 });
    const results = [];
    for (const state of ['pending', 'legacy', 'released', 'pending']) {
      store.save.legacySerraAccess = state === 'legacy';
      store.save.guaira.completed = state === 'released' ? [...guairaChapterRoute(store.save.guaira.opening)] : [];
      const before = JSON.stringify(store.save), expected = campaignJournal(store.save).water;
      const picture = document.createElement('canvas'); picture.width = 320; picture.height = 180;
      picture.style = 'width:640px;height:360px;image-rendering:pixelated';
      const row = document.createElement('div'); row.textContent = state; row.append(picture);
      document.getElementById('evidence').append(row);
      window.drawnText = []; game.buttons = []; game.renderGallery(picture.getContext('2d'));
      accessible.sync(7, store.save);
      const water = window.drawnText.filter(text => text.y >= 98 && text.y < 114);
      const root = accessible.root.firstChild; accessible.sync(7, store.save);
      results.push({ state, expected, spoken: accessible.root.querySelector('p').textContent,
        painted: water.map(text => text.value).join(' '), water,
        unchanged: before === JSON.stringify(store.save), reused: root === accessible.root.firstChild });
    }
    accessible.dispose(); return results;
  });
  await page.locator('#evidence').screenshot({ path: process.env.JOURNAL_CAPTURE || '/tmp/feka-journal-water.png' });
  t.diagnostic(JSON.stringify(results));
  for (const result of results) {
    assert.equal(result.spoken, result.expected, result.state + ': accessible state');
    assert.equal(result.painted, result.expected, result.state + ': painted state');
    assert.ok(result.water.length <= 2 && result.water.every(line => line.x >= 20 && line.x + line.width <= 300));
    assert.equal(result.unchanged, true); assert.equal(result.reused, true);
  }
  assert.match(results[1].expected, /água pendente.*acesso antigo/);
  assert.match(results[2].expected, /água liberada.*Serra aberto/);
  assert.deepEqual(errors, []);
});
