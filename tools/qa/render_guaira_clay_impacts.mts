/** Offline native Canvas proof using real Gallery/Relief keyboard routes.
 * node --import tsx tools/qa/render_guaira_clay_impacts.mts BASELINE_ROOT OUTPUT
 * BLOCK_CANVAS_MODULE may point to an existing @napi-rs/canvas installation.
 * This proves production painter output, not browser/device or hardware performance.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Canvas } from '../../tests/helpers/guairaLabHarness';
import { blockBrowser, BLOCK_DT } from '../../tests/helpers/blockImpactHarness';
import { GuairaGallery } from '../../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../../src/adventure/experimental/guaira/relief/GuairaRelief';
import gallery from '../../tests/helpers/guairaGalleryReplay.json';
import relief from '../../tests/helpers/guairaReliefReplay.json';
const baseline = resolve(process.argv[2]), out = resolve(process.argv[3]);
const { drawGalleryTerrain: beforeTerrain } = await import(pathToFileURL(`${baseline}/src/adventure/experimental/guaira/gallery/GuairaGalleryArt.ts`).href);
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
const records = [], snapshots = new Map();
const scenes = [['gallery-pound', GuairaGallery, gallery.runs], ['relief-pound', GuairaRelief, relief.maintenance],
    ['relief-head', GuairaRelief, relief.headBump]];
const frames = [0, 3, 6, 12, 24, 32];
for (const [name, Game, runs] of scenes) for (const reducedMotion of [false, true]) {
    const cleanup = [], h = blockBrowser({ after: callback => cleanup.push(callback) }, { reducedMotion });
    const game = new Game(h.canvas, h.status), afterTerrain = game.art.terrain;
    let held = new Set(), contactFrame = 0, found = false;
    const keys = nextKeys => {
        const next = new Set(nextKeys);
        for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        held = next;
    };
    outer: for (const [count, nextKeys] of runs) {
        keys(nextKeys);
        for (let i = 0; i < count; i++) {
            game.update(BLOCK_DT); contactFrame++;
            if (game.level.blockImpacts.active.length) { found = true; break outer; }
        }
    }
    assert.ok(found, 'The real scene route must produce native cover contact.'); keys([]);
    const mode = `${name}${reducedMotion ? '-reduced' : ''}`;
    for (let frame = 0; frame <= 32; frame++) {
        if (frame) game.update(BLOCK_DT);
        if (!frames.includes(frame)) continue;
        const beforeState = JSON.stringify({ player: game.player.data, level: game.level, save: game.store.save, coins: game.coins });
        for (const version of ['before', 'after']) {
            game.art.terrain = version === 'before' ? (c, level, _island, x, y) => beforeTerrain(c, level, x, y) : afterTerrain;
            game.render();
            assert.equal(JSON.stringify({ player: game.player.data, level: game.level, save: game.store.save, coins: game.coins }), beforeState);
            const native = createCanvas(320, 180), c = native.getContext('2d'); c.imageSmoothingEnabled = false;
            c.drawImage(surfaces.get(h.canvas), 0, 0, 320, 180);
            const key = `${mode}-${version}-${frame}`; snapshots.set(key, native);
            writeFileSync(`${out}/${key}.png`, native.toBuffer('image/png'));
        }
        if (frame === 32 || reducedMotion && frame >= 12)
            assert.deepEqual(snapshots.get(`${mode}-before-${frame}`).toBuffer('image/png'), snapshots.get(`${mode}-after-${frame}`).toBuffer('image/png'), 'Expired clay effects leave the original scenery exactly unchanged.');
        records.push({ mode, contactFrame, frameAfterContact: frame, effects: structuredClone(game.level.blockImpacts.active),
            player: structuredClone(game.player.data.position), camera: structuredClone(game.camera), coins: game.coins });
    }
    game.art.terrain = afterTerrain; game.dispose(); for (const clean of cleanup) clean();
}
const sheet = createCanvas(1280, 1420), c = sheet.getContext('2d'); c.imageSmoothingEnabled = false;
c.fillStyle = '#262126'; c.fillRect(0, 0, sheet.width, sheet.height); c.fillStyle = '#f3d7a4'; c.font = '19px ProofSans';
c.fillText('GUAIRA CLAY COVERS: real keyboard contact + production Canvas painters', 16, 28);
c.font = '15px ProofSans'; c.fillText('Offline native Canvas. No browser/device QA. Each pair shares identical collision, camera, player and save state.', 16, 52);
for (const [row, [name]] of scenes.entries()) for (const [col, frame] of [0, 6, 12, 24].entries()) {
    const x = col * 320, y = 75 + row * 450;
    c.fillStyle = '#f3d7a4'; c.fillText(`${name} / ${Math.round(frame * BLOCK_DT)} ms`, x + 8, y + 15);
    c.fillText('BEFORE', x + 8, y + 36); c.drawImage(snapshots.get(`${name}-before-${frame}`), x, y + 45);
    c.fillText('AFTER', x + 8, y + 247); c.drawImage(snapshots.get(`${name}-after-${frame}`), x, y + 258);
}
writeFileSync(`${out}/clay-before-after.png`, sheet.toBuffer('image/png'));
const reduced = createCanvas(1280, 470), rc = reduced.getContext('2d'); rc.imageSmoothingEnabled = false;
rc.fillStyle = '#262126'; rc.fillRect(0, 0, reduced.width, reduced.height); rc.fillStyle = '#f3d7a4'; rc.font = '18px ProofSans';
rc.fillText('REDUCED MOTION: stationary clay flakes fade within 120 ms; no flying fragments', 12, 28);
for (const [row, name] of ['gallery-pound', 'relief-head'].entries()) for (const [col, frame] of [0, 3, 6, 12].entries()) {
    const x = col * 320, y = 52 + row * 205;
    rc.font = '15px ProofSans'; rc.fillText(`${name} / ${Math.round(frame * BLOCK_DT)} ms`, x + 8, y + 15);
    rc.drawImage(snapshots.get(`${name}-reduced-after-${frame}`), x, y + 24);
}
writeFileSync(`${out}/clay-reduced-motion.png`, reduced.toBuffer('image/png'));
writeFileSync(`${out}/report.json`, JSON.stringify({ baseline, method: 'Offline native Canvas with real keyboard routes and production terrain painters; same simulation state rendered before/after. No browser/device/hardware-performance evidence.', records }, null, 2));
console.log(JSON.stringify({ out, comparedFrames: records.length, nativeImages: snapshots.size }));
