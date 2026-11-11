import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('rejected and stale level reads cannot authorize overwriting external edits', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-read-acceptance',
      transform(code, id) {
        if (id.endsWith('/src/main.ts')) return code.replace('game = new mode.Game(canvas);',
          'game = new mode.Game(canvas); window.editorUnderTest = game.editorController;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
  await page.waitForFunction(() => !!window.editorUnderTest);
  const results = [];
  for (const kind of ['cancel', 'version', 'request', 'visual', 'accept', 'directory']) {
    results.push(await page.evaluate(async kind => {
      const { FileSystemManager } = await import('/src/editor/FileSystemManager.ts');
      const e = editorUnderTest, data = e.createBlankLevel(); data.id = 'A';
      const storage = JSON.stringify({ ...localStorage });
      const { CAMPAIGN_LEVELS } = await import('/src/data/levels/index.ts');
      const campaign = JSON.stringify(CAMPAIGN_LEVELS);
      function memoryDirectory(content) {
        const state = { content, writes: 0, delayed: false, pending: [] };
        const handle = {
          async getFile() {
            const snapshot = state.content;
            return { text: () => state.delayed ? new Promise(resolve => state.pending.push(() => resolve(snapshot))) : Promise.resolve(snapshot) };
          },
          async createWritable() {
            state.writes++; let next;
            return { async write(value) { next = value; }, async close() { state.content = next; }, async abort() {} };
          }
        };
        return { state, async *values() { yield { kind: 'file', name: 'A.ts' }; }, async getFileHandle() { return handle; } };
      }
      const directory = memoryDirectory(JSON.stringify(data));
      window.showDirectoryPicker = async () => directory;
      e.fs = new FileSystemManager(); await e.fs.mount();
      window.confirm = () => true;
      e.loadLevel(data, '', false); await e.refreshLevelList();
      const button = document.querySelector('.level-list-item');
      await button.onclick(); // Real readLevel establishes the original accepted baseline.
      e.levelData.name = 'Local draft'; e.recordChange();
      const external = structuredClone(data); external.name = 'External revision';
      if (kind === 'visual') external.theme = { skyGradient: ['not-a-color', '#000'], layers: [] };
      // Preserve exact bytes, including whitespace, rather than reserializing the candidate.
      directory.state.content = '\n  ' + JSON.stringify(external) + '\n';
      const externalBytes = directory.state.content;
      let confirmations = 0;
      window.confirm = () => { confirmations++; return kind !== 'cancel'; };
      directory.state.delayed = true;
      const reading = button.onclick();
      while (directory.state.pending.length < 1) await new Promise(resolve => setTimeout(resolve, 0));
      if (kind === 'version') { e.levelData.timeLimit++; e.recordChange(); }
      if (kind === 'request') {
        void button.onclick();
        while (directory.state.pending.length < 2) await new Promise(resolve => setTimeout(resolve, 0));
      }
      let other;
      if (kind === 'directory') {
        other = memoryDirectory(externalBytes); window.showDirectoryPicker = async () => other; await e.fs.mount();
      }
      directory.state.delayed = false; directory.state.pending[0](); await reading;
      const loadedName = e.levelData.name;
      const visualError = document.getElementById('editor-message').textContent;
      if (kind === 'accept') { e.levelData.name = 'After accepted reload'; e.recordChange(); }
      await e.save(); // Real saveLevel must refuse a stale baseline before opening a stream.
      return { kind, loadedName, confirmations, visualError: kind === 'visual' && visualError.includes('cor inválida'),
        writes: directory.state.writes, preservedExternal: directory.state.content === externalBytes,
        refused: /alterado fora|Abra a fase/.test(document.getElementById('editor-message').textContent),
        dirty: e.history.isDirty(e.levelData), otherWrites: other?.state.writes ?? 0,
        otherUnchanged: !other || other.state.content === externalBytes,
        preserved: storage === JSON.stringify({ ...localStorage }) && campaign === JSON.stringify(CAMPAIGN_LEVELS) };
    }, kind));
  }
  t.diagnostic(JSON.stringify(results));
  for (const r of results) {
    assert.equal(r.preserved && r.otherUnchanged, true); assert.equal(r.otherWrites, 0);
    if (r.kind === 'accept') {
      assert.equal(r.loadedName, 'External revision'); assert.equal(r.confirmations, 1);
      assert.equal(r.writes, 1); assert.equal(r.refused, false); assert.equal(r.dirty, false);
    } else {
      assert.equal(r.loadedName, 'Local draft', r.kind + ' retains the editor document');
      assert.equal(r.preservedExternal, true, r.kind + ' retains external bytes');
      assert.equal(r.writes, 0); assert.equal(r.refused, true); assert.equal(r.dirty, true);
      assert.equal(r.confirmations, ['cancel', 'visual'].includes(r.kind) ? 1 : 0);
      if (r.kind === 'visual') assert.equal(r.visualError, true);
    }
  }
  assert.deepEqual(errors, []);
});
