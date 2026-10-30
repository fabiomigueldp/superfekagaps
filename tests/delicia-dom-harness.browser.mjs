/** Local DOM parity; no gameplay, layout or external-service validation.
 * With Playwright installed: CHROMIUM_PATH=/usr/bin/chromium npx tsx --test tests/delicia-dom-harness.browser.mjs
 * PLAYWRIGHT_MODULE may point to an existing Playwright/Playwright Core installation.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createDeliciaDom } from './helpers/deliciaDomHarness.ts';
import { deliciaDomContract } from './helpers/deliciaDomContract.ts';

test('shared Delicia DOM contract matches local Chromium', async t => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const dom = createDeliciaDom(), errors = [], externalRequests = [];
    const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body><script type="module">
        import { deliciaDomContract } from '/tests/helpers/deliciaDomContract.ts';
        window.report = await deliciaDomContract(document);
    </script></body></html>`;
    let browser, server;
    try {
        const expected = await deliciaDomContract(dom.document);
        server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
            appType: 'custom', server: { host: '127.0.0.1', port: 0 },
            plugins: [{ name: 'delicia-dom-contract', configureServer(vite) {
                vite.middlewares.use('/contract', (_request, response) => {
                    response.setHeader('Content-Type', 'text/html'); response.end(fixture);
                });
            } }] });
        await server.listen(); const base = 'http://127.0.0.1:' + server.httpServer.address().port;
        browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
        const page = await browser.newPage(); page.setDefaultTimeout(5000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            if (new URL(route.request().url()).origin === base) return route.continue();
            externalRequests.push(route.request().url()); return route.abort();
        });
        await page.goto(base + '/contract'); await page.waitForFunction(() => !!window.report);
        assert.deepEqual(await page.evaluate(() => window.report), expected);
        assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
        t.diagnostic(`${expected.length} snapshots match Chromium ${browser.version()}; no external requests`);
    } finally { await browser?.close(); await server?.close(); await dom.dispose(); }
});
