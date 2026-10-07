/** Offline production Canvas proof, with a declared block fixture and real World keyboard input.
 * node --import tsx tools/qa/render_block_impacts.mts BASELINE_ROOT OUTPUT
 * BLOCK_CANVAS_MODULE may point to an existing @napi-rs/canvas install.
 * This is not browser/device or hardware-performance evidence.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Canvas } from '../../tests/helpers/guairaLabHarness';
import { WorldGame } from '../../src/adventure/WorldGame';
import { TileType as T } from '../../src/constants';
import { BLOCK_DT, blockStage, blockBrowser } from '../../tests/helpers/blockImpactHarness';
const baseline = resolve(process.argv[2]), out = resolve(process.argv[3]);
const { WorldGame: BeforeGame } = await import(pathToFileURL(`${baseline}/src/adventure/WorldGame.ts`).href);
const { createCanvas, GlobalFonts } = createRequire(import.meta.url)(process.env.BLOCK_CANVAS_MODULE ?? '@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'ProofSans');
const surfaces = new WeakMap(), contexts = new WeakMap();
Canvas.prototype.getContext = function() {
    if (contexts.has(this)) return contexts.get(this);
    const native = createCanvas(this.width, this.height); surfaces.set(this, native);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, { configurable: true,
        get: () => native[key], set: value => { native[key] = value; } });
    const context = native.getContext('2d'), proxy = new Proxy(context, {
        get: (target, key) => key === 'drawImage' ? (image, ...args) => target.drawImage(surfaces.get(image) ?? image, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; }
    });
    contexts.set(this, proxy); return proxy;
};
mkdirSync(out, { recursive: true });
const report = [], snapshots = new Map();
const frames = [0, 2, 6, 12, 24, 32];
for (const mode of ['break', 'bump', 'reduced', 'reduced-bump']) for (const version of ['before', 'after']) {
    const cleanup = [], h = blockBrowser({ after: callback => cleanup.push(callback) }, { reducedMotion: mode.startsWith('reduced') });
    const Game = version === 'before' ? BeforeGame : WorldGame;
    const game = new Game(h.canvas, true), stage = blockStage(mode.endsWith('bump') ? T.BRICK : T.BRICK_BREAKABLE);
    game.load(stage.id, false, stage);
    h.window.dispatch('keydown', { code: 'Space', key: ' ', target: h.canvas });
    // Release on the first actual ceiling collision, before the old held-jump ceiling defect.
    let contactFrame = 0;
    for (; contactFrame < 12; contactFrame++) {
        game.update(BLOCK_DT);
        if (game.player.data.position.y === 112 && game.player.data.velocity.y === 0) break;
    }
    assert.ok(contactFrame < 12, 'The fixture must reach a real ceiling collision.');
    h.window.dispatch('keyup', { code: 'Space', key: ' ', target: h.canvas });
    assert.equal(game.level.getTile(5, 6), mode.endsWith('bump') ? T.BRICK : T.EMPTY);
    for (let frame = 0; frame <= 32; frame++) {
        if (frame) game.update(BLOCK_DT);
        if (!frames.includes(frame)) continue;
        const snapshot = JSON.stringify({ player: game.player.data, level: game.level.data, save: game.store.save, coins: game.coins });
        game.render(); assert.equal(JSON.stringify({ player: game.player.data, level: game.level.data, save: game.store.save, coins: game.coins }), snapshot);
        const native = createCanvas(320, 180), c = native.getContext('2d'); c.imageSmoothingEnabled = false;
        c.drawImage(surfaces.get(h.canvas), 0, 0, 320, 180);
        const key = `${mode}-${version}-${frame}`; snapshots.set(key, native);
        writeFileSync(`${out}/${key}.png`, native.toBuffer('image/png'));
        report.push({ mode, version, frameAfterContact: frame, player: structuredClone(game.player.data.position),
            contactFrame, effect: structuredClone(game.level.blockImpacts?.active ?? []), coins: game.coins, tile: game.level.getTile(5, 6) });
    }
    game.dispose(); for (const run of cleanup) run();
}
for (const mode of ['break', 'bump', 'reduced', 'reduced-bump']) for (const frame of frames) {
    const pair = report.filter(p => p.mode === mode && p.frameAfterContact === frame);
    assert.deepEqual(pair[0].player, pair[1].player, 'Feedback cannot alter the original player trajectory.');
    assert.equal(pair[0].tile, pair[1].tile); assert.equal(pair[0].coins, pair[1].coins);
}
const sheet = createCanvas(1280, 714), c = sheet.getContext('2d');
c.fillStyle = '#202736'; c.fillRect(0, 0, sheet.width, sheet.height); c.fillStyle = '#f3d7a4'; c.font = '18px ProofSans';
c.fillText('BLOCK FRACTURE: native Canvas fixture', 16, 27);
c.fillText('Real keyboard collision + production painters. No browser/device QA.', 16, 53);
c.imageSmoothingEnabled = false;
for (let i = 0; i < 4; i++) {
    const frame = [0, 6, 12, 24][i], x = i * 320;
    c.fillStyle = '#f3d7a4'; c.fillText(`${Math.round(frame * BLOCK_DT)} ms after contact`, x + 8, 88);
    c.font = '14px ProofSans'; c.fillText('BEFORE', x + 8, 113);
    c.drawImage(snapshots.get(`break-before-${frame}`), x, 123);
    c.fillText('AFTER', x + 8, 328);
    c.drawImage(snapshots.get(`break-after-${frame}`), x, 338);
    c.fillText('BEFORE / detail', x + 4, 548); c.fillText('AFTER / detail', x + 164, 548);
    c.drawImage(snapshots.get(`break-before-${frame}`), 48, 55, 96, 82, x + 4, 563, 144, 123);
    c.drawImage(snapshots.get(`break-after-${frame}`), 48, 55, 96, 82, x + 164, 563, 144, 123);
    c.font = '18px ProofSans';
}
writeFileSync(`${out}/before-after-fracture.png`, sheet.toBuffer('image/png'));
const bump = createCanvas(960, 300), bc = bump.getContext('2d'); bc.imageSmoothingEnabled = false;
bc.fillStyle = '#202736'; bc.fillRect(0, 0, 960, 300); bc.font = '16px ProofSans'; bc.fillStyle = '#f3d7a4';
bc.fillText('Intact recoil / reduced motion. Top: BEFORE. Bottom: AFTER.', 12, 22);
for (const [i, [mode, frame]] of [['bump', 2], ['bump', 6], ['bump', 12], ['reduced', 0], ['reduced', 6], ['reduced', 12]].entries()) {
    const x = i * 160; bc.fillText(`${mode} ${Math.round(frame * BLOCK_DT)} ms`, x + 4, 49);
    bc.drawImage(snapshots.get(`${mode}-before-${frame}`), 56, 60, 64, 56, x + 10, 66, 128, 112);
    bc.drawImage(snapshots.get(`${mode}-after-${frame}`), 56, 60, 64, 56, x + 10, 183, 128, 112);
}
writeFileSync(`${out}/bump-reduced-motion.png`, bump.toBuffer('image/png'));
writeFileSync(`${out}/report.json`, JSON.stringify({ baseline, method: 'Offline native Canvas, declared fixture, real World Input/Player/collision and production before/after painters; no browser, display or hardware-performance QA.', records: report }, null, 2));
console.log(JSON.stringify({ out, comparisons: report.length / 2, nativeImages: snapshots.size }));
