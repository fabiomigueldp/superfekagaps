/** Offline QA only: native Input, Player, camera and production render methods.
 * Usage: node --import tsx tools/guaira/render_traversal_guidance.mts RUNTIME OUT BASELINE_ROOT
 * TRAVERSAL_CANVAS_MODULE may point at an already installed @napi-rs/canvas.
 * BASELINE_ROOT is a checkout before the overlap guard. Output stays outside public/.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(process.argv[2]), out = resolve(process.argv[3]), baseline = resolve(process.argv[4]);
const load = (file: string) => import(pathToFileURL(file).href);
const { Canvas } = await load(root + '/tests/helpers/guairaLabHarness.ts');
const { guairaTraversalBrowser } = await load(root + '/tests/helpers/guairaTraversalHarness.ts');
const { GuairaTraversal: PriorTraversal } = await load(baseline + '/src/adventure/experimental/guaira/GuairaTraversal.ts');
const { createCanvas, GlobalFonts } = createRequire(import.meta.url)(process.env.TRAVERSAL_CANVAS_MODULE ?? '@napi-rs/canvas');
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
const rows = [], report = [];
for (const mode of ['keyboard', 'touch', 'reduced-motion']) {
    const cleanups = [], h = guairaTraversalBrowser({ after: f => cleanups.push(f) },
        { touch: mode === 'touch', reducedMotion: mode === 'reduced-motion' }), game = h.create();
    const snapshot = () => JSON.stringify({ player: game.player.data, camera: game.camera, objects: game.objects,
        time: game.time, elapsed: game.elapsed, finished: game.finished, save: game.store.save });
    function capture(prior = false) {
        const before = snapshot();
        if (prior) PriorTraversal.prototype.render.call(game); else game.render();
        assert.equal(snapshot(), before, 'render cannot advance or change simulation');
        const native = createCanvas(320, 180), c = native.getContext('2d'); c.imageSmoothingEnabled = false;
        c.drawImage(surfaces.get(h.canvas), 0, 0, 320, 180); return native;
    }
    function actorCoverage(final) {
        const actor = new Canvas(); actor.width = 320; actor.height = 180;
        game.renderer.drawPlayer(game.player.data, game.camera, actor.getContext('2d'));
        const expected = surfaces.get(actor).getContext('2d').getImageData(0, 0, 320, 180).data;
        const actual = final.getContext('2d').getImageData(0, 0, 320, 180).data;
        let opaque = 0, missing = 0;
        for (let pixel = 0; pixel < expected.length; pixel += 4) if (expected[pixel + 3] === 255) {
            opaque++; if ([0, 1, 2, 3].some(channel => actual[pixel + channel] !== expected[pixel + channel])) missing++;
        }
        return { opaqueActorPixels: opaque, pixelsDifferentFromIsolatedActor: missing };
    }
    h.run(game, 92, ['ArrowRight', 'ShiftLeft']); h.run(game, 12);
    for (let frame = 0; frame <= 45; frame++) {
        if (frame > 0) {
            if (mode === 'touch') {
                if (frame === 1) h.canvas.dispatch('touchstart', { touches: [{ identifier: 1, clientX: .93 * 640, clientY: 330, target: h.canvas }] });
                game.update(1000 / 60);
            } else h.run(game, 1, ['Space']);
        }
        if (!(mode === 'keyboard' ? [0, 7, 8, 17, 29, 30, 45].includes(frame) : frame === 17)) continue;
        const prior = capture(true), current = capture(false);
        const priorCoverage = actorCoverage(prior), currentCoverage = actorCoverage(current);
        if (frame === 17) {
            assert.ok(priorCoverage.pixelsDifferentFromIsolatedActor > 100, 'baseline must reproduce actual actor occlusion');
            assert.equal(currentCoverage.pixelsDifferentFromIsolatedActor, 0, 'the production painter must retain every opaque actor pixel');
            assert.match(h.status.textContent, /Pule.*baixo.*placa/);
        }
        for (const [label, surface] of [['before', prior], ['after', current]]) {
            writeFileSync(`${out}/native/${mode}-${frame}-${label}.png`, surface.toBuffer('image/png'));
            const compact = createCanvas(280, 158), c = compact.getContext('2d'); c.imageSmoothingEnabled = false;
            c.drawImage(surface, 0, 0, 280, 158); writeFileSync(`${out}/compact/${mode}-${frame}-${label}.png`, compact.toBuffer('image/png'));
        }
        rows.push({ mode, frame, prior, current });
        report.push({ mode, jumpFrame: frame, priorCoverage, currentCoverage, player: structuredClone(game.player.data.position),
            camera: { x: game.camera.x, y: game.camera.y }, velocityY: game.player.data.velocity.y, status: h.status.textContent });
    }
    for (const cleanup of cleanups) cleanup();
}
const selected = rows.filter(row => row.mode === 'keyboard' && [0, 8, 17, 30].includes(row.frame));
const sheet = createCanvas(1280, selected.length * 390 + 40), c = sheet.getContext('2d');
c.fillStyle = '#241f27'; c.fillRect(0, 0, sheet.width, sheet.height); c.font = '19px ProofSans'; c.fillStyle = '#f0ddae'; c.imageSmoothingEnabled = false;
c.fillText('BASELINE PRODUCTION PAINTER', 12, 28); c.fillText('ACTOR-AWARE PRODUCTION PAINTER', 652, 28);
selected.forEach((row, i) => { const y = 40 + i * 390; c.font = '16px ProofSans';
    c.fillText(`Native jump frame ${row.frame}`, 12, y + 20); c.fillText(`Same native state • frame ${row.frame}`, 652, y + 20);
    c.drawImage(row.prior, 0, y + 30, 640, 360); c.drawImage(row.current, 640, y + 30, 640, 360); });
writeFileSync(out + '/before-after-contact-sheet.png', sheet.toBuffer('image/png'));
const apex = rows.find(row => row.mode === 'keyboard' && row.frame === 17), compact = createCanvas(592, 202), cc = compact.getContext('2d');
cc.fillStyle = '#241f27'; cc.fillRect(0, 0, 592, 202); cc.fillStyle = '#f0ddae'; cc.font = '14px ProofSans'; cc.imageSmoothingEnabled = false;
cc.fillText('Before • 280px wide', 8, 23); cc.fillText('After • 280px wide', 304, 23);
cc.drawImage(apex.prior, 8, 34, 280, 158); cc.drawImage(apex.current, 304, 34, 280, 158);
writeFileSync(out + '/compact-before-after.png', compact.toBuffer('image/png'));
writeFileSync(out + '/native-state-proof.json', JSON.stringify({ runtime: root, baseline, method: 'Offline native Canvas, real Player/input/camera and actual before/after render methods; not a browser screenshot', coverageNote: 'Pixel differences at non-apex frames may include existing pickup sparks and landing effects. The frame-17 isolated actor comparison proves the banner occlusion and its removal.', approach: [[92, ['ArrowRight', 'ShiftLeft']], [12, []]], rows: report }, null, 2));
console.log(JSON.stringify({ out, rows: report.length, apex: report.filter(row => row.jumpFrame === 17) }));
