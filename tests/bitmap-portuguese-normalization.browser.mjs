import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Portuguese NFC and NFD text have identical bitmap metrics, wrapping and speech bubbles', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/font-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas><div id="evidence"></div>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/font-fixture');
  const result = await page.evaluate(async () => {
    const { pixelText, textWidth, fitText, wrapText } = await import('/src/graphics/BitmapFont.ts');
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { SpeechBubbleController } = await import('/src/voice/SpeechBubbleController.ts');
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 80;
    const ctx = canvas.getContext('2d'), pairs = [];
    const pixels = (text, align, scale) => {
      ctx.clearRect(0, 0, 640, 80); pixelText(ctx, text, 320, 20, '#000', scale, align);
      return ctx.getImageData(0, 0, 640, 80).data;
    };
    for (const text of ['JOÃO', 'CAFÉ', 'ação, bênção e avó', 'À Á Â Ã É Ê Í Ó Ô Õ Ú Ç']) {
      const nfd = text.normalize('NFD');
      const equalPixels = [];
      for (const align of ['left', 'center', 'right']) for (const scale of [1, 2]) {
        const a = pixels(text, align, scale), b = pixels(nfd, align, scale);
        equalPixels.push(a.every((v, i) => v === b[i]));
      }
      pairs.push({ text, widths: [textWidth(text), textWidth(nfd)], equalPixels,
        fit: [fitText(text, 30), fitText(nfd, 30)], fullFit: [fitText(text, 600), fitText(nfd, 600)],
        wrap: [wrapText(text, 35), wrapText(nfd, 35)] });
    }
    const renderer = new Renderer(), bubble = new SpeechBubbleController({ fadeOutMs: 120 });
    bubble.setAnchorProvider(() => ({ x: 160, y: 145 }));
    const phrase = 'JOÃO, CAFÉ E PÃO! AÇÃO, BÊNÇÃO E AVÓ.';
    const frames = [], retained = [];
    for (const [label, text] of [['NFC', phrase], ['NFD', phrase.normalize('NFD')]]) {
      bubble.show(text); const state = bubble.getRenderState(); retained.push(state.text === text);
      const c = renderer.getContext(); c.clearRect(0, 0, 320, 180);
      c.fillStyle = '#b5dce3'; c.fillRect(0, 0, 320, 180);
      renderer.drawSpeechBubble(state, { x: 0, y: 0 });
      frames.push(c.getImageData(0, 0, 320, 180).data);
      const output = document.createElement('canvas'); output.width = 320; output.height = 180;
      output.style = 'display:block;width:640px;height:360px;image-rendering:pixelated';
      output.getContext('2d').drawImage(c.canvas, 0, 0);
      const caption = document.createElement('div'); caption.textContent = label;
      document.getElementById('evidence').append(caption, output);
    }
    renderer.dispose();
    return { pairs, retained, bubbleEqual: frames[0].every((v, i) => v === frames[1][i]) };
  });
  await page.locator('#evidence').screenshot({ path: process.env.FONT_CAPTURE || '/tmp/feka-font.png' });
  t.diagnostic(JSON.stringify(result));
  for (const pair of result.pairs) {
    assert.equal(pair.widths[0], pair.widths[1], pair.text + ': equal width');
    assert.ok(pair.equalPixels.every(Boolean), pair.text + ': equal aligned/scaled pixels');
    assert.equal(pair.fit[0], pair.fit[1]); assert.equal(pair.fullFit[0], pair.fullFit[1]);
    assert.deepEqual(pair.wrap[0], pair.wrap[1]);
  }
  assert.ok(result.retained.every(Boolean), 'controller retains the original text');
  assert.equal(result.bubbleEqual, true); assert.deepEqual(errors, []);
});
