import assert from 'node:assert/strict';
import test from 'node:test';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import { guairaGalleryBrowser } from './helpers/guairaGalleryHarness';
import tapes from './helpers/guairaReadableRoutesReplays.json';

type Run = [number, string[]];
const dt = 1000 / 60;
const factories = { subida: guairaAscentBrowser, galeria: guairaGalleryBrowser };
type Harness = ReturnType<typeof guairaAscentBrowser> | ReturnType<typeof guairaGalleryBrowser>;
type Game = ReturnType<Harness['create']>;
const feet = (g: Game) => g.player.data.position.y + g.player.data.height;
function visible(g: Game, x: number, y: number, width = 16) {
    assert.ok(x + width > g.camera.x && x < g.camera.x + 320, `x${x} visible`);
    assert.ok(y - g.camera.y >= 24 && y - g.camera.y <= 172, `y${y} visible at ${y - g.camera.y}`);
}
function input(h: Harness, keys: string[], touch: boolean) {
    if (!touch) { h.keys(keys); return; }
    const x: Record<string, number> = { ArrowLeft: .08, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .78, Space: .93 };
    const touches = keys.map((key, i) => ({ identifier: i + 1, target: h.canvas, clientX: x[key] * 640, clientY: 330 }));
    h.canvas.dispatch(touches.length ? 'touchstart' : 'touchend', { touches });
}
function play(h: Harness, g: Game, runs: Run[], stop = Infinity, touch = false, observe = (_frame: number) => {}) {
    let frame = 0;
    for (const [count, keys] of runs) {
        input(h, keys, touch);
        for (let i = 0; i < count && frame < stop; i++) { g.update(dt); observe(++frame); }
        if (frame >= stop) break;
    }
    return frame;
}

for (const name of ['subida', 'galeria'] as const) for (const touch of [false, true]) for (const reducedMotion of [false, true])
    test(`${name}: readable exploration completes with native ${touch ? 'touch' : 'keys'}, reduced=${reducedMotion}`, t => {
        const h = factories[name](t, { touch, reducedMotion }), g = h.create();
        const contacts = new Set<number>(); let lastY = g.camera.y;
        const frame = play(h, g, tapes[name].runs as Run[], Infinity, touch, n => {
            const p = g.player.data;
            assert.equal(p.isDead, false); assert.equal(p.hasHelmet, true);
            assert.ok(p.position.y - 10 - g.camera.y >= 23, `helmet at ${n}`);
            assert.ok(feet(g) - g.camera.y <= 172, `feet at ${n}`);
            assert.ok(Math.abs(g.camera.y - lastY) <= 8.001, `camera continuity at ${n}`); lastY = g.camera.y;
            if (p.isGrounded) contacts.add(Math.round(feet(g)));
            if (name === 'subida') {
                if (n === 84) visible(g, 224, 368, 272); // See a safe floor before stepping off.
                if (n === 200) { visible(g, 448, 336, 48); visible(g, 496, 304, 160); }
                if (n === 407) visible(g, 768, 144, 112); // Balcony previews the lift's destination.
                if (n === 972 || n === 1014) { visible(g, 960, 96, 48); visible(g, 1040, 192, 48); }
                if (n === 972) visible(g, 964, 70); // Reward is visible before the lookout jump.
                if (n === 1014) { g.render(); assert.match(h.status.textContent, /salte à direita.*recuperar um salto curto/); }
            } else {
                if (n === 211) { visible(g, 256, 352, 96); visible(g, 320, 288, 32); }
                if (n === 364) { assert.equal(g.store.save.checkpoint, null); visible(g, 320, 288, 32); }
                if (n === 400) { assert.equal(g.store.save.checkpoint?.index, 0); visible(g, 384, 288, 48); }
            }
        });
        assert.equal(frame, tapes[name].frames); assert.equal(g.finished, true);
        assert.equal(g.coins, name === 'subida' ? 7 : 5);
        for (const y of name === 'subida' ? [368, 336, 304, 256, 144, 96] : [352, 320, 288, 336, 384, 192])
            assert.ok(contacts.has(y), `used actual support at ${y}`);
        assert.deepEqual(g.store.save.completed, []); assert.deepEqual(h.storageCalls, []);
        const snapshot = () => JSON.stringify({ p: g.player.data, o: g.objects, tiles: g.level.data.tiles, camera: g.camera, coins: g.coins, t: g.time });
        const before = snapshot(); g.render(); g.render(); assert.equal(snapshot(), before);
    });

for (const hold of [2, 4, 8]) test(`missed lookout transfer with ${hold}-frame jump returns through visible right step`, t => {
    const h = guairaAscentBrowser(t), g = h.create();
    play(h, g, tapes.subida.runs as Run[], 1014);
    h.run(g, hold, ['Space', 'ArrowRight']); h.run(g, 55 - hold, ['ArrowRight']); h.run(g, 30);
    assert.equal(g.player.data.isDead, false); assert.equal(g.player.data.hasHelmet, true);
    assert.equal(feet(g), 192); visible(g, 1040, 192, 48); visible(g, 1088, 144, 256);
    h.run(g, 40, ['Space', 'ArrowRight']); h.run(g, 120, ['ArrowRight']);
    assert.equal(g.finished, true); assert.ok(g.coins >= 7); assert.equal(g.store.save.checkpoint?.index, 1);
});

for (const hold of [4, 6, 8]) test(`service loop accepts ${hold}-frame jumps without helmet or timing dependence`, t => {
    const h = guairaGalleryBrowser(t), g = h.create();
    play(h, g, tapes.galeria.runs as Run[], 330);
    // Focused equipment fixture: the full native entry is played above.
    g.player.data.hasHelmet = false;
    for (let jump = 0; jump < 2; jump++) { h.run(g, hold, ['Space']); h.run(g, 35); }
    assert.equal(feet(g), 288); assert.equal(g.store.save.checkpoint?.index, 0);
    assert.equal(g.player.data.hasHelmet, false); assert.equal(g.player.data.isDead, false);
    assert.equal(g.openings.second, false, 'loop rejoins before the required second cover');
    h.run(g, 31, ['ArrowRight']); h.run(g, 20); h.run(g, 8, ['Space']); h.run(g, 40, ['ArrowDown']);
    assert.equal(g.openings.second, true, 'native ground pound still opens the required route without helmet');
});

for (const name of ['subida', 'galeria'] as const) test(`${name}: new decision point settles, pauses and restores the native checkpoint`, t => {
    const h = factories[name](t), g = h.create();
    play(h, g, tapes[name].runs as Run[], name === 'subida' ? 1014 : 400);
    input(h, [], false); for (let n = 0; n < 90; n++) g.update(dt);
    const y = g.camera.y; for (let n = 0; n < 30; n++) g.update(dt);
    assert.ok(Math.abs(g.camera.y - y) < .001, 'stationary framing does not pump');
    const toggle = () => 'toggleAscentPause' in g ? g.toggleAscentPause() : g.toggleGalleryPause();
    toggle(); const frozen = JSON.stringify({ p: g.player.data, camera: g.camera, o: g.objects, t: g.time });
    for (let n = 0; n < 90; n++) g.update(dt); g.render();
    assert.equal(JSON.stringify({ p: g.player.data, camera: g.camera, o: g.objects, t: g.time }), frozen);
    toggle(); const old = g.player, coins = g.coins; old.die('fall');
    for (let n = 0; n < 180 && g.player === old; n++) g.update(dt);
    assert.notEqual(g.player, old); assert.equal(g.player.data.position.x, name === 'subida' ? 800 : 320);
    assert.equal(feet(g), name === 'subida' ? 144 : 288); assert.equal(g.coins, coins);
    g.load(g.stage.id); assert.equal(g.coins, 0); assert.equal(g.store.save.checkpoint, null);
});
