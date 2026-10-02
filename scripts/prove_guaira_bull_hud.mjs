// Offline native Canvas proof. This does not start a server or manufacture combat states.
// node --import tsx scripts/prove_guaira_bull_hud.mjs REPO OUTPUT CANVAS_MODULE
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repoArg, outputArg, canvasModule = '@napi-rs/canvas'] = process.argv.slice(2);
assert.ok(repoArg && outputArg, 'Provide source checkout and output directory');
const repo = resolve(repoArg), output = resolve(outputArg);
mkdirSync(output, { recursive: true });
const { Canvas, guairaBrowser } = await import(pathToFileURL(`${repo}/tests/helpers/guairaLabHarness.ts`).href);
const { GuairaBullLab } = await import(pathToFileURL(`${repo}/src/adventure/experimental/guaira/GuairaBullLab.ts`).href);
const { createCanvas } = createRequire(import.meta.url)(canvasModule);
const surfaces = new WeakMap(), contexts = new WeakMap();
function context(surface) {
    const c = surface.getContext('2d');
    return new Proxy(c, {
        get: (target, key) => key === 'drawImage' ? (source, ...args) => target.drawImage(surfaces.get(source) ?? source, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; },
    });
}
Canvas.prototype.getContext = function () {
    if (contexts.has(this)) return contexts.get(this);
    const surface = createCanvas(this.width, this.height); surfaces.set(this, surface);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, {
        configurable: true, get: () => surface[key], set: value => { surface[key] = value; },
    });
    const c = context(surface); contexts.set(this, c); return c;
};
const hash = value => createHash('sha256').update(value).digest('hex');
const state = game => JSON.stringify({ player: game.player.data, boss: game.boss.model, camera: game.camera,
    time: game.time, elapsed: game.elapsed, state: game.state, save: game.store.save, objects: game.objects,
    lives: game.lives, coins: game.coins, score: game.score });
const report = { kind: 'actual-engine-offline-canvas', browserQA: false, repo, cases: [] };
const actor = createCanvas(320, 180), hud = createCanvas(320, 180), ac = context(actor), hc = context(hud);
function measure(game) {
    ac.clearRect(0, 0, 320, 180); hc.clearRect(0, 0, 320, 180);
    const shake = game.store.save.preferences.shake && game.camera.shakeTimer > 0 ? (Math.floor(game.time / 40) % 2 ? 1 : -1) : 0;
    game.renderer.drawPlayer(game.player.data, { ...game.camera, x: game.camera.x + shake }, ac);
    // Include the existing opaque header for both revisions, plus each revision's encounter HUD.
    hc.fillStyle = '#382b35'; hc.fillRect(0, 0, 320, 23); game.renderEncounterHud(hc);
    const a = ac.getImageData(0, 0, 320, 180).data, b = hc.getImageData(0, 0, 320, 180).data;
    let actorPixels = 0, coveredPixels = 0, minimumActorY = 180;
    for (let i = 3; i < a.length; i += 4) if (a[i]) {
        actorPixels++; minimumActorY = Math.min(minimumActorY, Math.floor((i - 3) / 4 / 320));
        if (b[i]) coveredPixels++;
    }
    return { actorPixels, coveredPixels, minimumActorY, actorSha256: hash(a) };
}
function nativeFrame(game, h) {
    const before = state(game); game.render(); assert.equal(state(game), before, 'render changed gameplay');
    const native = createCanvas(320, 180), c = native.getContext('2d');
    c.imageSmoothingEnabled = false; c.drawImage(surfaces.get(h.canvas), 0, 0, 320, 180);
    return native;
}
function controls(h) {
    let held = new Set();
    return codes => {
        const next = new Set(codes);
        for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { key: code === 'Space' ? ' ' : code, code, target: h.canvas });
        for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { key: code === 'Space' ? ' ' : code, code, target: h.canvas });
        held = next;
    };
}
function run(name, reducedMotion, scenario) {
    const cleanups = [], h = guairaBrowser({ after: f => cleanups.push(f) }, { reducedMotion });
    const game = new GuairaBullLab(h.canvas, h.status, 'CONTINUAR: VOLTAR A MAQUETE');
    const rows = [], images = [], set = controls(h);
    function sample(frame, label) {
        const native = nativeFrame(game, h), metrics = measure(game);
        rows.push({ frame, state: game.boss.model.state, hint: game.boss.hint, helmet: game.player.data.hasHelmet,
            dead: game.player.data.isDead, ...metrics, stateSha256: hash(state(game)) });
        if (label) {
            const file = `${name}-${label}.png`; writeFileSync(`${output}/${file}`, native.toBuffer('image/png'));
            images.push({ frame, label, file, state: game.boss.model.state, hint: game.boss.hint, ...metrics });
        }
        return native;
    }
    scenario({ game, h, set, sample });
    report.cases.push({ name, reducedMotion, frameCount: rows.length, overlapFrames: rows.filter(r => r.coveredPixels).length,
        worst: rows.reduce((a, b) => a.coveredPixels >= b.coveredPixels ? a : b),
        minimumActorY: Math.min(...rows.map(r => r.minimumActorY)), digest: hash(JSON.stringify(rows.map(r => r.stateSha256))), rows, images });
    // This minimal harness restores its synthetic browser boundaries between cases.
    for (const f of cleanups) f();
}
for (const reducedMotion of [false, true]) {
    for (const hold of [1, 34]) run(`${hold === 1 ? 'short' : 'held'}${reducedMotion ? '-reduced' : ''}`, reducedMotion, ({ game, set, sample }) => {
        for (let frame = 1; frame <= 65; frame++) {
            set(frame <= hold ? ['Space'] : []); game.update(1000 / 60);
            sample(frame, [1, 13, 21, 23, 31, 40].includes(frame) ? String(frame).padStart(2, '0') : null);
        }
    });
    run(`winning${reducedMotion ? '-reduced' : ''}`, reducedMotion, ({ game, h, set, sample }) => {
        const recording = JSON.parse(readFileSync(`${repo}/tests/helpers/guairaLabReplay.json`, 'utf8'));
        const seen = new Set(), hits = []; let frame = 0;
        for (const [count, codes] of recording.runs) {
            set(codes);
            for (let n = 0; n < count; n++, frame++) {
                const health = game.boss.health; game.update(recording.stepMs);
                assert.equal(game.player.data.hasHelmet, true); assert.equal(game.player.data.isDead, false);
                const phase = game.boss.model.state;
                const hit = game.boss.health < health;
                if (hit) hits.push({ frame, health: game.boss.health });
                const label = hit ? `hit-${hits.length}` : !seen.has(phase) ? phase : null;
                sample(frame, label); seen.add(phase);
            }
        }
        assert.deepEqual(hits, recording.expectedHits); assert.equal(frame, recording.frames);
        assert.equal(game.boss.phase, 'defeated'); assert.equal(game.canAdvanceToAscent, true);
        assert.deepEqual(game.store.save.completed, []);
        sample(frame, 'victory');
        game.toggleLabPause(); const frozen = state(game);
        const first = sample(frame, 'victory-paused').toBuffer('image/png');
        for (let i = 0; i < 4; i++) { game.update(100); assert.equal(state(game), frozen);
            assert.deepEqual(nativeFrame(game, h).toBuffer('image/png'), first); }
    });
}
run('pause-jump', false, ({ game, h, set, sample }) => {
    set(['Space']); for (let frame = 1; frame <= 21; frame++) { game.update(1000 / 60); sample(frame, frame === 21 ? 'active' : null); }
    game.toggleLabPause(); const frozen = state(game), first = sample(21, 'paused').toBuffer('image/png');
    for (let i = 0; i < 4; i++) { game.update(100); assert.equal(state(game), frozen);
        assert.deepEqual(nativeFrame(game, h).toBuffer('image/png'), first); }
    game.toggleLabPause(); assert.equal(game.state, 'playing'); sample(21, 'resumed');
});
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.cases.map(({ rows, images, ...summary }) => summary), null, 2));
