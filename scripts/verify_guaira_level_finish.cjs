// Isolated browser profile, real chapter host and keyboard input. Explicit
// stage mounting is inspection coverage, not an unlocked save or victory.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve(process.env.GUAIRA_OUTPUT || 'output/guaira/level-finish-2026-10-16/browser');
const url = process.env.FEKA_UI_URL || 'http://127.0.0.1:3000';
const stages = ['guaira-travessia','guaira-patio-comportas','guaira-respiros','guaira-lab','guaira-subida','guaira-prefeito','gallery','relief'];
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const report = { kind: 'isolated-browser-native-chapter-inspection', checks: [], errors: [], physicalDevice: false };
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(url + '/?chapter=guaira', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.worldGame?.mapView);
        for (const stage of stages) {
            await page.evaluate(async stage => { await window.worldGame.mountChapter('guaira', stage); }, stage);
            await page.waitForSelector('[data-state="playing"]');
            const canvas = page.locator('#game-canvas'), bounds = await canvas.boundingBox();
            await page.bringToFront(); await canvas.click();
            await page.waitForFunction(() => window.worldGame.time >= 250);
            const beforeX = await page.evaluate(() => window.worldGame.player.data.position.x);
            await page.keyboard.down('ArrowRight'); await page.waitForTimeout(180); await page.keyboard.up('ArrowRight');
            const afterX = await page.evaluate(() => window.worldGame.player.data.position.x);
            if (!(afterX > beforeX)) {
                await page.screenshot({ path: path.join(out,'input-failure.png') });
                console.error(await page.evaluate(() => ({ state:window.worldGame.state,time:window.worldGame.time,
                    player:window.worldGame.player.data,focus:document.activeElement?.id,hasFocus:document.hasFocus(),hidden:document.hidden })));
            }
            assert.ok(afterX > beforeX, stage + ': actual keyboard movement');
            const render = await page.evaluate(() => {
                const game = window.worldGame, times = [];
                const before = JSON.stringify({ p: game.player.data, o: game.objects, b: game.boss, t: game.time });
                for (let i = 0; i < 90; i++) { const start = performance.now(); game.render(); times.push(performance.now() - start); }
                const after = JSON.stringify({ p: game.player.data, o: game.objects, b: game.boss, t: game.time });
                times.sort((a,b) => a-b);
                return { samples: times.length, medianMs: times[45], p95Ms: times[85], pure: before === after };
            });
            assert.ok(render.pure, stage + ': browser painting is read-only');
            if (stage === 'guaira-respiros' || stage === 'relief') {
                // Let the real clock reach a full discharge, so this pause
                // verifies the animated liquid as well as the idle scenery.
                await page.waitForFunction(() => {
                    const objects = window.worldGame.objects;
                    const jet = objects.bodies.find(b => b.kind === 'jet');
                    const t = (objects.time + (jet.phase || 0)) % 4200;
                    return t >= 1940 && t <= 2100;
                });
            }
            await page.locator('#chapter-primary').click(); await page.waitForSelector('[data-state="paused"]');
            const hydraulicTime = await page.evaluate(() => {
                const objects = window.worldGame.objects, jet = objects.bodies.find(b => b.kind === 'jet');
                return (objects.time + (jet?.phase || 0)) % 4200;
            });
            if (stage === 'guaira-respiros' || stage === 'relief') assert.ok(hydraulicTime >= 1920 && hydraulicTime < 2330, 'pause caught actual full-pressure water');
            await page.screenshot({ path: path.join(out, stage + '.png') });
            const paused = await canvas.evaluate(c => c.toDataURL());
            await page.waitForTimeout(220);
            assert.equal(await canvas.evaluate(c => c.toDataURL()), paused, stage + ': paused art is stable');
            assert.deepEqual(await canvas.boundingBox(), bounds, stage + ': canvas does not jump on pause');
            await page.locator('#chapter-map-return').click(); await page.waitForSelector('.world-map:not([hidden])');
            report.checks.push({ stage, keyboardMoved: true, pauseFrozen: true, stableCanvas: true, returnedToMap: true, render,
                ...(stage === 'guaira-respiros' || stage === 'relief' ? { animatedHazardPaused: true, hydraulicTime } : {}) });
        }
        await page.setViewportSize({ width: 844, height: 390 });
        await page.evaluate(async () => { await window.worldGame.mountChapter('guaira','guaira-travessia'); });
        await page.waitForSelector('[data-state="playing"]');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(out,'landscape-844.png') });
        report.checks.push({ viewport:'844x390', overflow:false });
        await context.close(); assert.deepEqual(report.errors,[]); report.passed = true;
    } finally {
        fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
        await browser.close();
    }
    console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
