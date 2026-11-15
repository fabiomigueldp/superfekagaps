import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('speech bubbles keep native size, anchor, alpha and composition order across camera zoom', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/bubble-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas><div id="evidence"></div>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/bubble-fixture');
  const result = await page.evaluate(async () => {
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { JOAOZAO_VOICE_MANIFEST } = await import('/src/voice/joaozaoVoiceManifest.ts');
    const { panel, pixelText, wrapText, textWidth } = await import('/src/graphics/BitmapFont.ts');
    const { ART } = await import('/src/graphics/palette.ts');
    const renderer = new Renderer(), camera = { x: 32, y: 48 };
    const text = JOAOZAO_VOICE_MANIFEST.voiceLines.aqui_e_o_joao_namorado_da_yasmin.text;
    const equal = (a, b) => a.every((v, i) => v === b[i]);
    const frames = [], rows = [];
    // Preserve the established zoom-1 appearance, including alpha and edge clamping.
    const legacy = (anchor, alpha) => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const c = canvas.getContext('2d'); c.fillStyle = ART.ink; c.fillRect(0, 0, 320, 180);
      const lines = wrapText(text, 210).slice(0, 5), w = Math.max(...lines.map(s => textWidth(s))) + 12, h = lines.length * 12 + 8;
      const x = Math.round(Math.max(4, Math.min(320 - w - 4, anchor.x - w / 2)));
      const y = Math.round(Math.max(25, Math.min(180 - h - 5, anchor.y - h - 8)));
      c.globalAlpha = alpha; panel(c, x, y, w, h, ART.paper, ART.ink);
      lines.forEach((line, i) => pixelText(c, line, x + 6, y + 6 + i * 12, ART.ink));
      c.fillStyle = ART.ink; c.fillRect(Math.round(x + w / 2) - 3, y + h, 6, 2); c.fillRect(Math.round(x + w / 2) - 1, y + h + 2, 2, 2);
      return c.getImageData(0, 0, 320, 180).data;
    };
    for (const zoom of [0.5, 1, 2, 0.1, 8]) {
      for (const [name, anchor, alpha] of [['center', { x: 160, y: 140 }, 1], ['edge', { x: 316, y: 177 }, 0.5], ['hidden', { x: 0, y: 0 }, 0]]) {
        renderer.startScene(zoom);
        renderer.drawSpeechBubble({ text, alpha, position: { x: camera.x + anchor.x / zoom, y: camera.y + anchor.y / zoom } }, camera);
        renderer.present();
        const c = renderer.getContext(), pixels = c.getImageData(0, 0, 320, 180).data;
        rows.push({ zoom, name, matchesNative: equal(pixels, legacy(anchor, alpha)) });
        if (name === 'center') {
          const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
          canvas.style = 'display:block;width:640px;height:360px;image-rendering:pixelated';
          canvas.getContext('2d').drawImage(c.canvas, 0, 0);
          const label = document.createElement('div'); label.textContent = 'zoom ' + zoom;
          document.getElementById('evidence').append(label, canvas);
          frames.push(pixels);
        }
      }
      renderer.startScene(zoom);
      let c = renderer.getContext(); c.fillStyle = '#00ff00'; c.fillRect(152 / zoom, 112 / zoom, 16 / zoom, 16 / zoom);
      renderer.drawSpeechBubble({ text, alpha: 1, position: { x: camera.x + 160 / zoom, y: camera.y + 140 / zoom } }, camera);
      c = renderer.getContext(); c.fillStyle = '#ff0000'; c.fillRect(152 / zoom, 112 / zoom, 16 / zoom, 16 / zoom);
      renderer.present();
      const pixel = [...renderer.getContext().getImageData(160, 120, 1, 1).data];
      rows.push({ zoom, name: 'later world stays above bubble', pixel });
    }
    renderer.dispose();
    return { text, rows, identicalFrames: frames.every(frame => equal(frame, frames[1])) };
  });
  await page.locator('#evidence').screenshot({ path: process.env.BUBBLE_CAPTURE || '/tmp/feka-bubble-zoom.png' });
  t.diagnostic(JSON.stringify(result));
  for (const row of result.rows) {
    if (row.pixel) assert.deepEqual(row.pixel, [255, 0, 0, 255], 'composition order at zoom ' + row.zoom);
    else assert.equal(row.matchesNative, true, row.name + ' at zoom ' + row.zoom);
  }
  assert.equal(result.identicalFrames, true); assert.deepEqual(errors, []);
});
