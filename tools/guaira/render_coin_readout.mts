/** Offline production Canvas proof with real Input/Player pickups, not a browser playtest.
 * node --import tsx tools/guaira/render_coin_readout.mts OUTPUT BASELINE_ROOT
 * COIN_CANVAS_MODULE may point at an already installed @napi-rs/canvas.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Canvas } from '../../tests/helpers/guairaLabHarness';
import { guairaAscentBrowser } from '../../tests/helpers/guairaAscentHarness';
import { guairaTraversalBrowser } from '../../tests/helpers/guairaTraversalHarness';
import { guairaRespirosBrowser } from '../../tests/helpers/guairaRespirosHarness';
import { jetCycleTick } from '../../src/adventure/WorldMachineState';
import { GUAIRA_RESPIROS as G } from '../../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import ascentReplay from '../../tests/helpers/guairaAscentReplay.json';
const out = resolve(process.argv[2]), baseline = resolve(process.argv[3]);
const { createCanvas, GlobalFonts } = createRequire(import.meta.url)(process.env.COIN_CANVAS_MODULE ?? '@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'ProofSans');
const surfaces = new WeakMap(), contexts = new WeakMap();
Canvas.prototype.getContext = function() {
    if (contexts.has(this)) return contexts.get(this);
    const surface = createCanvas(this.width, this.height); surfaces.set(this, surface);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, { configurable: true,
        get: () => surface[key], set: value => { surface[key] = value; } });
    const ctx = surface.getContext('2d'), proxy = new Proxy(ctx, {
        get: (target, key) => key === 'drawImage' ? (image, ...args) => target.drawImage(surfaces.get(image) ?? image, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; }
    });
    contexts.set(this, proxy); return proxy;
};
mkdirSync(out + '/native', { recursive: true }); mkdirSync(out + '/compact', { recursive: true });
const rows = [], report = [], step = 1000 / 60;
for (const [scene, factory, source, exported, expectedCoins] of [
    ['ascent', guairaAscentBrowser, 'GuairaAscent.ts', 'GuairaAscent', 3],
    ['traversal', guairaTraversalBrowser, 'GuairaTraversal.ts', 'GuairaTraversal', 1],
    ['respiros', guairaRespirosBrowser, 'respiros/GuairaRespiros.ts', 'GuairaRespiros', 2]
]) for (const mode of ['keyboard', 'touch', 'reduced-motion']) {
    const beforeClass = (await import(pathToFileURL(`${baseline}/src/adventure/experimental/guaira/${source}`).href))[exported];
    const cleanups = [], h = factory({ after: f => cleanups.push(f) }, { touch: mode === 'touch', reducedMotion: mode === 'reduced-motion' });
    const game = h.create(); game.audio.enabled = false;
    const snapshot = () => JSON.stringify({ player: game.player.data, camera: game.camera, objects: game.objects,
        coins: game.coins, time: game.time, elapsed: game.elapsed, finished: game.finished, save: game.store.save, audio: game.audio.enabled });
    function run(count, keys = []) {
        if (mode === 'touch') {
            const positions = { ArrowLeft: .08, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .78, Space: .93 };
            const touches = keys.map((key, index) => ({ identifier: index + 1, target: h.canvas, clientX: positions[key] * 640, clientY: 330 }));
            h.canvas.dispatch(touches.length ? 'touchstart' : 'touchend', { touches });
        } else h.keys(keys);
        for (let frame = 0; frame < count; frame++) {
            game.update(step); assert.equal(game.player.data.isDead, false); assert.equal(game.player.data.hasHelmet, true);
        }
    }
    function walkUntil(x) {
        for (let frame = 0; frame < 420 && game.player.data.position.x < x; frame++) run(1, ['ArrowRight']);
        assert.ok(game.player.data.position.x >= x);
    }
    function waitForRetraction(id) {
        run(30);
        for (let frame = 0; frame < 252; frame++) {
            const tick = jetCycleTick(game.objects.get(id), game.objects.time);
            if (tick >= 2500 && tick < 2534) return;
            run(1);
        }
        assert.fail('no retracted departure');
    }
    if (scene === 'ascent') {
        for (const [count, keys] of ascentReplay.runs.slice(0, 10)) run(count, keys);
        run(104, ['ArrowRight']); run(50);
    } else if (scene === 'traversal') {
        for (let frame = 0; frame < 120 && game.coins === 0; frame++) run(1, ['ArrowRight']);
        run(15);
    } else {
        run(1); walkUntil(128); waitForRetraction(G.firstJetId);
        walkUntil(G.checkpointX); waitForRetraction(G.secondJetId); walkUntil(578); run(30);
        run(30, ['Space']); run(30);
    }
    assert.equal(game.coins, expectedCoins); assert.equal(game.audio.enabled, false);
    function capture(prior = false) {
        const state = snapshot();
        if (prior) beforeClass.prototype.render.call(game); else game.render();
        assert.equal(snapshot(), state, 'render must not mutate simulation or saved state');
        const native = createCanvas(320, 180), c = native.getContext('2d'); c.imageSmoothingEnabled = false;
        c.drawImage(surfaces.get(h.canvas), 0, 0, 320, 180); return native;
    }
    const before = capture(true), after = capture(), stable = capture();
    assert.deepEqual(after.toBuffer('image/png'), stable.toBuffer('image/png'), 'render has no independent animation/timer');
    const a = before.getContext('2d').getImageData(0, 0, 320, 180).data;
    const b = after.getContext('2d').getImageData(0, 0, 320, 180).data;
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) if ([0, 1, 2, 3].some(channel => a[i + channel] !== b[i + channel])) {
        const x = i / 4 % 320, y = Math.floor(i / 4 / 320); changed++;
        assert.ok(x >= 184 && x < 279 && y >= 4 && y < 20, `only the unused HUD slot changes: ${x},${y}`);
    }
    assert.ok(changed > 200, 'the baseline must be missing the visible native coin and count');
    for (const [label, surface] of [['before', before], ['after', after]]) {
        writeFileSync(`${out}/native/${scene}-${mode}-${label}.png`, surface.toBuffer('image/png'));
        const compact = createCanvas(280, 158), c = compact.getContext('2d'); c.imageSmoothingEnabled = false;
        c.drawImage(surface, 0, 0, 280, 158); writeFileSync(`${out}/compact/${scene}-${mode}-${label}.png`, compact.toBuffer('image/png'));
    }
    rows.push({ scene, mode, before, after });
    report.push({ scene, mode, coins: game.coins, audioEnabled: game.audio.enabled, changedPixels: changed,
        player: game.player.data.position, camera: { x: game.camera.x, y: game.camera.y }, finished: game.finished, status: h.status.textContent });
    for (const cleanup of cleanups) cleanup();
}
const selected = rows.filter(row => row.mode === 'reduced-motion');
const sheet = createCanvas(1280, 1210), c = sheet.getContext('2d');
c.fillStyle = '#241f27'; c.fillRect(0, 0, sheet.width, sheet.height); c.font = '18px ProofSans'; c.fillStyle = '#f0ddae'; c.imageSmoothingEnabled = false;
c.fillText('BEFORE: MUTED + REDUCED MOTION', 12, 27); c.fillText('AFTER: VISIBLE ATTEMPT COINS', 652, 27);
selected.forEach((row, index) => {
    const y = 35 + index * 390; c.fillText(`${row.scene} / actual native pickup state`, 12, y + 20);
    c.drawImage(row.before, 0, y + 30, 640, 360); c.drawImage(row.after, 640, y + 30, 640, 360);
});
writeFileSync(out + '/before-after-contact-sheet.png', sheet.toBuffer('image/png'));
const compact = createCanvas(592, 594), cc = compact.getContext('2d'); cc.imageSmoothingEnabled = false;
cc.fillStyle = '#241f27'; cc.fillRect(0, 0, compact.width, compact.height); cc.font = '14px ProofSans'; cc.fillStyle = '#f0ddae';
selected.forEach((row, index) => {
    const y = index * 198; cc.fillText(`${row.scene}: before / after at 280px`, 8, y + 23);
    cc.drawImage(row.before, 8, y + 34, 280, 158); cc.drawImage(row.after, 304, y + 34, 280, 158);
});
writeFileSync(out + '/compact-before-after.png', compact.toBuffer('image/png'));
writeFileSync(out + '/native-state-proof.json', JSON.stringify({ baseline, method: 'Offline production Canvas; actual native keyboard/touch pickup routes; no actor relocation; all audio muted. Not a browser screenshot or a hardware performance benchmark.', rows: report }, null, 2));
console.log(JSON.stringify({ out, rows: report }));
