import assert from 'node:assert/strict';
import test from 'node:test';
import { drawWorldCheckpoint, drawWorldGoal, WORLD_FLAG_HOIST_MS, type WorldFlagMotion } from '../src/adventure/WorldCheckpointArt';
import { WorldGame } from '../src/adventure/WorldGame';
import { ink } from '../src/adventure/WorldPainting';
import { guairaBrowser } from './helpers/guairaLabHarness';

type Paint = [number, number, number, number, string];
function paint(draw: (c: CanvasRenderingContext2D) => void): Paint[] {
    const calls: Paint[] = [];
    const c = { fillStyle: '', fillRect: (x: number, y: number, w: number, h: number) =>
        calls.push([x, y, w, h, c.fillStyle]) };
    draw(c as unknown as CanvasRenderingContext2D); return calls;
}
function flagPaint(x: number, y: number, reached: boolean, motion: WorldFlagMotion = {}): Paint[] {
    return paint(c => drawWorldCheckpoint(c, x, y, reached, motion));
}
function pixels(calls: Paint[]) {
    const pixels = new Map<string, string>();
    for (const [x, y, w, h, color] of calls)
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixels.set(`${xx},${yy}`, color);
    return pixels;
}

test('checkpoint statuses retain different high-contrast symbols on the cloth in every frame', () => {
    for (const time of [0, 180, 360, 540]) {
        const unreached = pixels(flagPaint(0, 35, false, { time }));
        const reached = pixels(flagPaint(0, 35, true, { time }));
        assert.notDeepEqual([...unreached], [...reached]);
        const darkMark = (map: Map<string, string>, top: number) => [...map]
            .filter(([key, color]) => { const [x, y] = key.split(',').map(Number); return color === ink && x >= 8 && x <= 14 && y >= top + 3 && y <= top + 9; }).length;
        assert.ok(darkMark(unreached, 9) >= 8, 'Ready exclamation survives the cloth wave.');
        assert.ok(darkMark(reached, 2) >= 10, 'Reached check survives the cloth wave.');
    }
    const luminance = (hex: string) => [0, 2, 4].map(i => parseInt(hex.slice(i + 1, i + 3), 16) / 255)
        .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    assert.ok((luminance('#86d2ad') + .05) / (luminance(ink) + .05) >= 7);
});

test('flags use four deterministic native-grid frames, a finite hoist and bounded paint', () => {
    const frames = [0, 180, 360, 540].map(time => flagPaint(3.4, 48.4, true, { time }));
    assert.equal(new Set(frames.map(frame => JSON.stringify(frame))).size, 4);
    assert.deepEqual(frames[0], flagPaint(3.4, 48.4, true, { time: 720 }));
    assert.notDeepEqual(flagPaint(0, 40, true, { activationAge: 0 }), flagPaint(0, 40, true, { activationAge: WORLD_FLAG_HOIST_MS }));
    assert.deepEqual(flagPaint(0, 40, true, { activationAge: 650 }), flagPaint(0, 40, true));
    for (const goal of [false, true]) for (const reached of [false, true]) for (const time of [0, 180, 360, 540]) {
        const calls = paint(c => goal ? drawWorldGoal(c, 3.4, 8.4, false, false, reached, { time, activationAge: 200 })
            : drawWorldCheckpoint(c, 3.4, 48.4, reached, { time, activationAge: 200 }));
        assert.ok(calls.length < 150, 'Bounded strip/symbol paint; no particles or extra surfaces.');
        for (const [x, y, w, h] of calls) assert.ok([x, y, w, h].every(Number.isInteger));
    }
});

test('reduced motion retains static raised checks and distinct locked, normal and secret goals', () => {
    for (const reached of [false, true]) {
        const stable = flagPaint(0, 40, reached, { reducedMotion: true, time: 0, activationAge: 0 });
        for (const time of [180, 360, 540, 8000])
            assert.deepEqual(stable, flagPaint(0, 40, reached, { reducedMotion: true, time, activationAge: time }));
    }
    const variants: Paint[][] = [];
    for (const secret of [false, true]) for (const locked of [false, true]) for (const complete of [false, true]) {
        if (locked && complete) continue;
        const first = paint(c => drawWorldGoal(c, 0, 0, secret, locked, complete, { reducedMotion: true, time: 0, activationAge: 0 }));
        assert.deepEqual(first, paint(c => drawWorldGoal(c, 0, 0, secret, locked, complete, { reducedMotion: true, time: 720, activationAge: 720 })));
        if (!locked) variants.push(first);
    }
    assert.equal(new Set(variants.map(v => JSON.stringify(v))).size, 4);
});

for (const reducedMotion of [false, true]) for (const muted of [false, true])
test(`native checkpoint activation, pause and resume preserve mechanics; reduced ${reducedMotion}, mute ${muted}`, t => {
    const h = guairaBrowser(t, { reducedMotion });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.load('1-1', false); game.audio.enabled = !muted;
    const sounds: string[] = [];
    t.mock.method(game.audio, 'sfx', (sound: string) => sounds.push(sound));
    const c = game.renderer.getContext(), calls: Paint[] = [];
    const fill = c.fillRect.bind(c);
    t.mock.method(c, 'fillRect', (x: number, y: number, w: number, height: number) => {
        calls.push([x, y, w, height, String(c.fillStyle)]); fill(x, y, w, height);
    });
    const internal = game as unknown as { checkpointActivatedAt: number | null };
    function renderAndCheck(reachedIndex: number) {
        const state = JSON.stringify({ save: game.store.save, player: game.player.data, camera: game.camera, activatedAt: internal.checkpointActivatedAt, coins: game.coins });
        const soundCount = sounds.length;
        calls.length = 0; game.render();
        assert.equal(JSON.stringify({ save: game.store.save, player: game.player.data, camera: game.camera, activatedAt: internal.checkpointActivatedAt, coins: game.coins }), state);
        assert.equal(sounds.length, soundCount, 'Painting must never replay activation audio.');
        game.stage.checkpoints.forEach((cp, i) => {
            const x = cp.x * 16 - Math.round(game.camera.x), y = cp.y * 16 - Math.round(game.camera.y);
            if (x < -40 || x > 335 || y < -16 || y > 224) return;
            const expected = flagPaint(x, y, i <= reachedIndex, { time: game.time, reducedMotion,
                activationAge: i === reachedIndex && internal.checkpointActivatedAt != null ? game.time - internal.checkpointActivatedAt : null });
            const start = calls.findIndex(call => JSON.stringify(call) === JSON.stringify(expected[0]));
            assert.ok(start >= 0, `Checkpoint ${i} was not drawn.`);
            assert.deepEqual(calls.slice(start, start + expected.length), expected);
        });
    }
    function reach(index: number) {
        const cp = game.stage.checkpoints[index], p = game.player.data;
        p.position = { x: cp.x * 16, y: cp.y * 16 - p.height };
        p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
        game.update(1000 / 60);
        assert.equal(game.store.save.checkpoint?.index, index);
        assert.equal(internal.checkpointActivatedAt, game.time);
    }
    renderAndCheck(-1);
    reach(0); renderAndCheck(0); renderAndCheck(0);
    const activatedAt = internal.checkpointActivatedAt, time = game.time;
    game.state = 'paused'; game.update(500); renderAndCheck(0);
    assert.equal(game.time, time); assert.equal(internal.checkpointActivatedAt, activatedAt);
    game.state = 'playing'; game.update(1000 / 60);
    assert.equal(internal.checkpointActivatedAt, activatedAt, 'Standing at an earned checkpoint must not restart its hoist.');
    reach(1); renderAndCheck(1);
    game.load('1-1', true); renderAndCheck(1);
    assert.equal(internal.checkpointActivatedAt, null, 'Saved checkpoints are already raised without replaying activation.');
    assert.equal(sounds.filter(sound => sound === 'checkpoint').length, 2);
});

for (const reducedMotion of [false, true]) test(`native exit completion pays and saves immediately once; reduced ${reducedMotion}`, t => {
    const h = guairaBrowser(t, { reducedMotion }), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.load('1-1');
    const sounds: string[] = []; t.mock.method(game.audio, 'sfx', (s: string) => sounds.push(s));
    const exit = game.stage.exits.find(exit => exit.id === 'normal')!, p = game.player.data;
    p.position = { x: exit.x, y: exit.y + exit.height - p.height }; p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
    game.update(1000 / 60);
    assert.equal(game.state, 'clear'); assert.ok(game.store.save.completed.includes('1-1'));
    const save = JSON.stringify(game.store.save), elapsed = game.elapsed, coins = game.coins;
    const c = game.renderer.getContext(), calls: Paint[] = [], fill = c.fillRect.bind(c);
    t.mock.method(c, 'fillRect', (x: number, y: number, w: number, height: number) => {
        calls.push([x, y, w, height, String(c.fillStyle)]); fill(x, y, w, height);
    });
    for (const age of [0, 500]) {
        if (age) game.update(age);
        calls.length = 0; game.render();
        const expected = paint(ctx => drawWorldGoal(ctx, 237, 101, false, false, true, {
            time: game.time, reducedMotion, activationAge: age,
        }));
        const start = calls.findIndex(call => JSON.stringify(call) === JSON.stringify(expected[0]));
        assert.ok(start >= 0, 'The instant result panel has its own visible earned flag.');
        assert.deepEqual(calls.slice(start, start + expected.length), expected);
        assert.ok(expected.every(([x, y, w, h]) => x >= 32 && x + w <= 288 && y >= 38 && y + h <= 147), 'Result flag and glints stay within the panel.');
    }
    assert.equal(JSON.stringify(game.store.save), save); assert.equal(game.elapsed, elapsed); assert.equal(game.coins, coins);
    assert.equal(sounds.filter(s => s === 'victory').length, 1);
});
