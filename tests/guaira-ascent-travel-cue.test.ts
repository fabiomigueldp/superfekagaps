import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldLevel, WorldObjects, type MovingBody } from '../src/adventure/WorldPhysics';
import { guairaAscentStage, GUAIRA_ASCENT as G } from '../src/adventure/experimental/guaira/GuairaAscent';
import { drawGuairaAscentObjects } from '../src/adventure/experimental/guaira/GuairaAscentArt';
import { ascentTravelDirection } from '../src/adventure/experimental/guaira/GuairaAscentTravelCue';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import recording from './helpers/guairaAscentReplay.json';

class Raster {
    fillStyle = '#010203';
    readonly pixels = Array<string>(320 * 180).fill('');
    private stack: string[] = [];
    get depth() { return this.stack.length; }
    save() { this.stack.push(this.fillStyle); }
    restore() { this.fillStyle = this.stack.pop()!; }
    beginPath() {}
    rect() {}
    clip() {}
    fillRect(x: number, y: number, w: number, h: number) {
        assert.ok([x, y, w, h].every(Number.isInteger));
        assert.ok(w >= 0 && h >= 0);
        for (let yy = Math.max(0, y); yy < Math.min(180, y + h); yy++)
            for (let xx = Math.max(0, x); xx < Math.min(320, x + w); xx++) this.pixels[yy * 320 + xx] = this.fillStyle;
    }
    get context() { return this as unknown as CanvasRenderingContext2D; }
    crop(x: number, y: number, w: number, h: number) {
        return Array.from({ length: h }, (_, row) => this.pixels.slice((y + row) * 320 + x, (y + row) * 320 + x + w));
    }
}
function fixture() {
    const stage = guairaAscentStage();
    return { level: new WorldLevel(stage.level), objects: new WorldObjects(stage.mechanisms) };
}
function render(objects: WorldObjects, body: MovingBody, reduced = false, running = true, time = objects.time) {
    const raster = new Raster(), cx = Math.round(body.x) - 100, cy = Math.round(body.y) - 70;
    drawGuairaAscentObjects(raster.context, objects, cx, cy, time, reduced, running);
    assert.equal(raster.depth, 0); assert.equal(raster.fillStyle, '#010203');
    return { raster, dial: raster.crop(100 + Math.floor(body.width / 2) - 6, 70 + body.height, 13, 11) };
}

test('travel direction uses only actual axis displacement and is neutral at rest, pause and invalid input', () => {
    const { objects } = fixture(), body = objects.get(G.plankId)!;
    assert.equal(ascentTravelDirection(body, 'x'), 0);
    body.x += .004;
    assert.equal(ascentTravelDirection(body, 'x'), 1, 'slow endpoint departure remains readable');
    assert.equal(ascentTravelDirection(body, 'y'), 0, 'orthogonal displacement is ignored');
    body.px = body.x + .004; assert.equal(ascentTravelDirection(body, 'x'), -1);
    assert.equal(ascentTravelDirection(body, 'x', false), 0);
    body.px = body.x + 1e-8; assert.equal(ascentTravelDirection(body, 'x'), 0);
    for (const invalid of [NaN, Infinity, -Infinity]) {
        body.px = invalid; assert.equal(ascentTravelDirection(body, 'x'), 0);
        body.px = 240; body.x = invalid; assert.equal(ascentTravelDirection(body, 'x'), 0);
    }
});

test('all three real mechanisms show both actual directions over two cycles, with no physics mutation', () => {
    const { level, objects } = fixture();
    const directions = new Map(objects.bodies.map(body => [body.id, new Set<number>()]));
    for (let frame = 0; frame < 1200; frame++) {
        objects.update(1000 / 60, level, 700);
        for (const body of objects.bodies) {
            const axis = body.id === G.liftId ? 'y' : 'x', delta = body[axis] - (axis === 'x' ? body.px : body.py);
            const direction = ascentTravelDirection(body, axis);
            assert.equal(direction, Math.abs(delta) <= 1e-6 ? 0 : Math.sign(delta));
            directions.get(body.id)!.add(direction);
        }
        if (frame % 29 !== 0) continue;
        const state = structuredClone(objects);
        for (const body of objects.bodies) {
            const normal = render(objects, body), reduced = render(objects, body, true);
            assert.deepEqual(normal.dial, reduced.dial, 'semantic direction survives reduced motion');
            assert.deepEqual(reduced.dial, render(objects, body, true, true, 9e9).dial, 'no blinking or independent clock');
            for (let x = 100; x < 100 + body.width; x++) for (const y of [70, 71])
                assert.equal(normal.raster.pixels[y * 320 + x], '#f2d69b', 'the real walkable cap is untouched');
        }
        assert.deepEqual(structuredClone(objects), state);
    }
    for (const seen of directions.values()) assert.deepEqual([...seen].sort(), [-1, 1]);
});

test('outbound and returning vehicles at the same world position have opposite readable shapes', () => {
    const { level, objects } = fixture(), body = objects.get(G.plankId)!;
    for (let frame = 0; frame < 150; frame++) objects.update(1000 / 60, level, 700);
    const x = body.x, outbound = render(objects, body, true).dial;
    assert.equal(ascentTravelDirection(body, 'x'), 1);
    for (let frame = 0; frame < 300; frame++) objects.update(1000 / 60, level, 700);
    assert.ok(Math.abs(body.x - x) < 1e-8); assert.equal(ascentTravelDirection(body, 'x'), -1);
    const inbound = render(objects, body, true).dial;
    assert.notDeepEqual(outbound, inbound);
    assert.deepEqual(outbound.map(row => [...row].reverse()), inbound, 'left and right are distinct mirrored glyphs');
    assert.notDeepEqual(inbound, render(objects, body, true, false).dial, 'rest never implies either destination');
});

for (const reducedMotion of [false, true]) test(`production adapter neutralizes entry, pause and completion and restores on resume (${reducedMotion ? 'reduced' : 'normal'})`, t => {
    const h = guairaAscentBrowser(t, { reducedMotion }), game = h.create();
    const bodyDial = (body: MovingBody) => {
        const raster = new Raster(), cx = Math.round(body.x) - 100, cy = Math.round(body.y) - 70;
        const before = structuredClone(game.objects);
        game.art.objects(raster.context, game.objects, cx, cy, game.time);
        assert.deepEqual(structuredClone(game.objects), before);
        return raster.crop(100 + Math.floor(body.width / 2) - 6, 70 + body.height, 13, 11);
    };
    const plank = game.objects.get(G.plankId)!;
    const neutral = bodyDial(plank);
    h.run(game, 120);
    const moving = bodyDial(plank); assert.notDeepEqual(moving, neutral);
    game.toggleAscentPause(); assert.deepEqual(bodyDial(plank), neutral);
    const frozen = structuredClone(game.objects); h.run(game, 90);
    assert.deepEqual(structuredClone(game.objects), frozen); assert.deepEqual(bodyDial(plank), neutral);
    game.toggleAscentPause(); assert.deepEqual(bodyDial(plank), moving);
    h.run(game, 1); assert.deepEqual(bodyDial(plank), moving);
    game.load(G.id); assert.deepEqual(bodyDial(game.objects.get(G.plankId)!), neutral);
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        h.run(game, count, keys); assert.equal(game.player.data.isDead, false);
    }
    assert.equal(game.finished, true); assert.equal(game.store.save.checkpoint?.index, 1);
    for (const body of game.objects.bodies) {
        assert.deepEqual(bodyDial(body), render(game.objects, body, reducedMotion, false).dial);
    }
    h.keys([]); game.load(G.id);
    assert.equal(game.objects.time, 0); assert.equal(game.finished, false);
    for (const body of game.objects.bodies) assert.equal(ascentTravelDirection(body, body.id === G.liftId ? 'y' : 'x'), 0);
});

for (const reducedMotion of [false, true]) test(`full render keeps pause, death, respawn and completion dials neutral (${reducedMotion ? 'reduced' : 'normal'})`, t => {
    const h = guairaAscentBrowser(t, { reducedMotion }), game = h.create();
    let frame = 0;
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        const steps = Math.min(count, 220 - frame); h.run(game, steps, keys); frame += steps;
        if (frame === 220) break;
    }
    const body = game.objects.get(G.plankId)!, originalPainter = game.art.objects;
    let dial: string[][] | undefined;
    // Spy on the actual Canvas calls made inside game.render(), before the pause
    // overlay. Do not call the adapter separately with a different state/context.
    game.art.objects = (c, objects, cx, cy, time, world) => {
        const raster = new Raster(), fillRect = c.fillRect;
        c.fillRect = (x, y, w, h) => {
            raster.fillStyle = c.fillStyle as string; raster.fillRect(x, y, w, h);
            fillRect.call(c, x, y, w, h);
        };
        try { originalPainter(c, objects, cx, cy, time, world); } finally { c.fillRect = fillRect; }
        const x = Math.round(body.x) + Math.floor(body.width / 2) - 6 - cx;
        const y = Math.round(body.y) + body.height - cy;
        assert.ok(x >= 0 && x + 13 <= 320 && y >= 23 && y + 11 <= 180, 'native ride keeps the actual dial in frame');
        dial = raster.crop(x, y, 13, 11);
    };
    const state = () => structuredClone({ objects: game.objects, player: game.player.data, state: game.state, time: game.time });
    game.render(); const moving = dial;
    assert.deepEqual(moving, render(game.objects, body, reducedMotion).dial);
    game.toggleAscentPause(); const paused = state(); game.render();
    assert.deepEqual(dial, render(game.objects, body, reducedMotion, false).dial, 'full paused render is neutral');
    assert.notDeepEqual(dial, moving); assert.deepEqual(state(), paused);
    game.render(); assert.deepEqual(state(), paused); assert.equal(game.state, 'paused');
    game.toggleAscentPause(); game.render(); assert.deepEqual(dial, moving, 'resume restores actual direction');
    game.finished = true; game.render();
    assert.deepEqual(dial, render(game.objects, body, reducedMotion, false).dial, 'full completion render is neutral');
    game.finished = false; game.player.data.respawnRevealTimer = 100;
    const beforeReveal = structuredClone(game.objects); h.run(game, 1); game.render();
    assert.deepEqual(structuredClone(game.objects), beforeReveal, 'reveal really freezes mechanism updates');
    assert.deepEqual(dial, render(game.objects, body, reducedMotion, false).dial, 'full respawn-freeze render is neutral');
    game.player.data.respawnRevealTimer = 0; game.player.die('fall');
    const beforeDeath = structuredClone(game.objects); h.run(game, 1); const dying = state(); game.render();
    assert.equal(game.player.data.isDead, true); assert.equal(game.state, 'playing');
    assert.deepEqual(structuredClone(game.objects), beforeDeath, 'death really freezes mechanism updates');
    assert.deepEqual(dial, render(game.objects, body, reducedMotion, false).dial, 'full death render is neutral');
    assert.deepEqual(state(), dying, 'render leaves the real death/freeze state untouched');
    game.art.objects = originalPainter;
});
