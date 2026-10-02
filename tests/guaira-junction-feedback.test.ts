import assert from 'node:assert/strict';
import test from 'node:test';
import { pixelText } from '../src/graphics/BitmapFont';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { drawGuairaWorker } from '../src/adventure/experimental/guaira/GuairaWorkerArt';
import { drawJunctionBackground, drawJunctionObjects } from '../src/adventure/experimental/guaira/junction/GuairaJunctionArt';
import { GUAIRA_JUNCTION as G, guairaJunctionStage, JunctionRouting } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import { guairaJunctionBrowser } from './helpers/guairaJunctionHarness';
import recording from './helpers/guairaJunctionReplay.json';

type Paint = [string, number, number, number, number];
function recorder() {
    const calls: Paint[] = [];
    const c = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { calls.push([this.fillStyle, x, y, w, h]); },
        save() {}, restore() {}, beginPath() {}, rect() {}, clip() {} };
    return { c: c as unknown as CanvasRenderingContext2D, calls };
}
function glyph(value: string, x: number, y: number, color: string) {
    const r = recorder(); pixelText(r.c, value, x, y, color); return r.calls;
}

test('native replay gives both low riders travel feedback and never calls an airborne approach recovery', t => {
    const h = guairaJunctionBrowser(t), g = h.create();
    let frame = 0, lowA = 0, lowB = 0;
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let n = 0; n < count; n++) {
            g.update(recording.stepMs); frame++;
            if (frame < 149 || frame > 182 && frame < 540 || frame > 556) continue;
            const before = JSON.stringify({ player: g.player.data, objects: g.objects, routing: g.routing });
            g.render();
            assert.equal(JSON.stringify({ player: g.player.data, objects: g.objects, routing: g.routing }), before);
            assert.doesNotMatch(h.status.textContent, /recuperação|volte à esquerda/, `frame ${frame}`);
            if (frame >= 153 && frame <= 182) { assert.match(h.status.textContent, /No tabuleiro A · subindo/); lowA++; }
            if (frame >= 546 && frame <= 556) { assert.match(h.status.textContent, /No tabuleiro B · subindo/); lowB++; }
        }
    }
    assert.equal(lowA, 30); assert.equal(lowB, 11); assert.equal(frame, 893); assert.equal(g.finished, true);
});

test('recovery requires real dry support; partial deck overlap, the dock and airborne feet are distinct', t => {
    const h = guairaJunctionBrowser(t), g = h.create(), p = g.player.data;
    const place = (x: number, feet: number, grounded = true) => {
        p.position.x = x; p.position.y = feet - p.height; p.isGrounded = grounded; g.render();
    };
    place(450, G.recoveryY); assert.match(h.status.textContent, /Piso seco de recuperação/);
    place(110, 352); assert.match(h.status.textContent, /Piso seco de recuperação/);
    place(450, 352); assert.doesNotMatch(h.status.textContent, /recuperação/, 'no tile at this height');
    place(450, G.recoveryY, false); assert.doesNotMatch(h.status.textContent, /recuperação/, 'airborne is not supported');
    place(224 - p.width + .5, G.dockY); assert.match(h.status.textContent, /No tabuleiro A · na doca/);
    place(224 - p.width, G.dockY); assert.match(h.status.textContent, /Piso seco de recuperação/, 'touching the edge is not overlap');
    g.routing.step('a', 1); g.routing.step('a', 400); g.objects.get(G.liftAId)!.active = true;
    place(450, G.recoveryY); assert.match(h.status.textContent, /Piso seco de recuperação/, 'another moving deck cannot hide dry recovery');
});

test('banner prioritizes DESVIO, actual travel at replay frame 500, then the next request at either settled plate', t => {
    const h = guairaJunctionBrowser(t), g = h.create();
    g.render(); // The native renderer has now selected its composed HUD surface.
    const context = g.renderer.getContext(), calls: Paint[] = [];
    const original = context.fillRect.bind(context);
    context.fillRect = (x, y, w, height) => { calls.push([String(context.fillStyle), x, y, w, height]); original(x, y, w, height); };
    const expectBanner = (text: string) => {
        calls.length = 0; g.render();
        const expected = recorder(); pixelText(expected.c, text, 160, 34, '#f3ddb1', 1, 'center');
        assert.deepEqual(calls.slice(-expected.calls.length), expected.calls);
    };
    expectBanner('PULE. NO AR, BAIXO: AGUA PARA A');
    g.routing.step('a', 1); expectBanner('DESVIO PARA A...');
    g.routing.step('a', 399); expectBanner('DESVIO PARA A...');
    g.routing.step('a', 1); g.objects.get(G.liftAId)!.active = true;
    g.objects.get(G.liftBId)!.active = false;
    expectBanner('A SOBE / B DESCE');
    g.objects.get(G.liftAId)!.y = G.middleY; g.objects.get(G.liftBId)!.y = G.dockY;
    expectBanner('PULE. NO AR, BAIXO: AGUA PARA B');
    g.player.data.position.x = 490; g.player.data.position.y = G.middleY - g.player.data.height; g.camera.x = 360; g.camera.y = 156;
    expectBanner('PULE. NO AR, BAIXO: AGUA PARA B');
    g.routing.step('b', 1); expectBanner('DESVIO PARA B...');
    g.routing.step('b', 400);
    g.objects.get(G.liftAId)!.active = false; g.objects.get(G.liftBId)!.active = true;
    expectBanner('B SOBE / A DESCE');
    g.objects.get(G.liftAId)!.y = G.dockY; g.objects.get(G.liftBId)!.y = G.terraceY;
    expectBanner('PULE. NO AR, BAIXO: AGUA PARA A');
    g.load(G.id);
    let frame = 0;
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let n = 0; n < count && frame < 500; n++) { g.update(recording.stepMs); frame++; }
        if (frame === 500) break;
    }
    assert.equal(g.routing.supplied, 'b'); assert.equal(g.routing.warning, false); assert.equal(g.moving, true);
    assert.ok(g.player.data.position.x >= 410 && g.player.data.position.x < 565, 'still near the second plate');
    expectBanner('B SOBE / A DESCE');
});

test('both plate engravings remain A/B while the valve shows actual supply throughout the warning', () => {
    const objects = new WorldObjects(guairaJunctionStage().mechanisms), routing = new JunctionRouting();
    for (const selected of ['b', 'a'] as const) {
        routing.step(selected, 1);
        for (const [cameraX, cameraY, x, y] of [[0, 200, 173, 88], [320, 150, 173, 90]]) {
            const r = recorder(); drawJunctionObjects(r.c, objects, cameraX, cameraY, 0, true, routing);
            const letter = r.calls.filter(([color, px, py]) => color === '#4c4144' && px >= x && px < x + 17 && py >= y && py < y + 7);
            assert.deepEqual(letter, glyph('A/B', x, y, '#4c4144'));
        }
    }
    const r = recorder(); drawJunctionBackground(r.c, 200, 150, 0, true, routing);
    const valve = r.calls.filter(([color, x, y]) => color === '#f2be72' && x >= 101 && x < 106 && y >= 127 && y < 134);
    assert.deepEqual(valve, glyph('B', 101, 127, '#f2be72'));
    assert.equal(routing.selected, 'a'); assert.equal(routing.supplied, 'b');
});

test('each worker observes its own deck, including descending A, warning and the settled dry dock', () => {
    const objects = new WorldObjects(guairaJunctionStage().mechanisms), routing = new JunctionRouting();
    const a = objects.get(G.liftAId)!, b = objects.get(G.liftBId)!;
    const check = (cameraX: number, cameraY: number, x: number, y: number, kind: 'pump' | 'rice', active: boolean, progress: number) => {
        const paint = recorder(), expected = recorder(), before = JSON.stringify({ objects, routing });
        drawJunctionObjects(paint.c, objects, cameraX, cameraY, 1600, true, routing);
        drawGuairaWorker(expected.c, x - cameraX, y - cameraY, kind,
            { activeTimeMs: 1600, valveActive: active, bridgeRise: progress, reducedMotion: true });
        assert.deepEqual(paint.calls.slice(-expected.calls.length), expected.calls);
        assert.equal(JSON.stringify({ objects, routing }), before);
    };
    a.y = a.to!.y; a.active = true; b.y = G.dockY; b.active = false; routing.supplied = routing.selected = 'a';
    check(0, 200, 108, 296, 'pump', true, 1);
    check(320, 150, 421, 248, 'pump', false, 0);
    routing.step('b', 1);
    check(0, 200, 108, 296, 'pump', true, 0);
    check(320, 150, 421, 248, 'pump', true, 0);
    check(700, 70, 848, 200, 'rice', true, 0);
    routing.step('b', 400); a.active = false; b.active = true;
    // Supply already changed, but the descending A keeper must still watch A.
    a.y = 328; b.y = 352;
    check(0, 200, 108, 296, 'pump', true, .5);
    check(320, 150, 421, 248, 'pump', true, .25);
    check(700, 70, 848, 200, 'rice', true, .25);
    a.y = G.dockY; b.y = b.to!.y;
    check(0, 200, 108, 296, 'pump', false, 0);
    check(320, 150, 421, 248, 'pump', true, 1);
    check(700, 70, 848, 200, 'rice', true, 1);
});
