import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { SpriteAtlas } from '../src/graphics/pixels';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import { GroundPoundState } from '../src/types';
import { ART } from '../src/graphics/palette';
import { CompletedAvatarPresentation } from '../src/adventure/experimental/guaira/CompletedAvatarPresentation';
import { guairaReliefBrowser } from './helpers/guairaReliefHarness';
import { guairaGalleryBrowser } from './helpers/guairaGalleryHarness';
import { guairaRespirosBrowser } from './helpers/guairaRespirosHarness';
import { guairaJunctionBrowser } from './helpers/guairaJunctionHarness';
import galleryRecording from './helpers/guairaGalleryReplay.json';
import respirosRecording from './helpers/guairaRespirosReplay.json';
import junctionRecording from './helpers/guairaJunctionReplay.json';

const dt = 1000 / 60;
type Game = ReturnType<ReturnType<typeof guairaReliefBrowser>['create']>;
function frozen(g: Pick<Game, 'player' | 'camera' | 'level' | 'objects' | 'store' | 'elapsed' | 'time' | 'finished' | 'coins' | 'renderer'>) {
    return structuredClone({ player: g.player.data, camera: g.camera, tiles: g.level.data.tiles,
        objects: g.objects, save: g.store.save, elapsed: g.elapsed, time: g.time, finished: g.finished,
        coins: g.coins, sparks: (g as unknown as { sparks: unknown[] }).sparks,
        rendererTime: (g.renderer as unknown as { clock: { time: number } }).clock.time });
}
function observeBody(t: TestContext) {
    let paint = { tint: undefined as string | undefined, pose: '' };
    const original = SpriteAtlas.prototype.draw;
    t.mock.method(SpriteAtlas.prototype, 'draw', function (this: SpriteAtlas, ...args: Parameters<typeof original>) {
        if (args[2] === PLAYER_PALETTE && args[1] !== PLAYER_SPRITES.helmet)
            paint = { tint: args[7], pose: Object.entries(PLAYER_SPRITES).find(([, frame]) => frame === args[1])?.[0] ?? 'walk' };
        return original.apply(this, args);
    });
    return () => ({ ...paint });
}

for (const touch of [false, true]) for (const reducedMotion of [false, true])
    test(`real white Relief arrival settles with ${touch ? 'touch' : 'keys'}, reduced motion ${reducedMotion}`, t => {
        const h = guairaReliefBrowser(t, { touch, reducedMotion }), g = h.create(), paint = observeBody(t);
        h.run(g, 47); h.keys(['ArrowRight', 'ShiftLeft']);
        let frame = 47, helmetLost = 0;
        while (!g.finished && frame < 300) {
            g.update(dt); frame++;
            if (!helmetLost && !g.player.data.hasHelmet) helmetLost = frame;
        }
        assert.equal(helmetLost, 163); assert.equal(frame, 213);
        assert.equal(g.finished, true); assert.equal(g.player.data.isDead, false);
        assert.ok(Math.abs(g.player.data.invincibleTimer - 1000 / 6) < .0001);
        g.render(); assert.equal(paint().tint, ART.paper, 'preserve the actual arrival frame');
        const atFinish = frozen(g);
        const update = t.mock.method(g.player, 'update');
        h.key('Escape'); g.update(dt); assert.equal(g.state, 'paused');
        h.run(g, 120); g.render(); assert.equal(paint().tint, ART.paper);
        assert.deepEqual(frozen(g), atFinish, 'pause does not advance even the sprite feedback');
        const enabled = g.audio.enabled;
        h.key('m'); g.update(dt); assert.equal(g.audio.enabled, !enabled);
        assert.deepEqual(frozen(g), atFinish);
        g.toggleReliefPause(); h.keys(['ArrowLeft', 'Space', 'ArrowDown']);
        for (let i = 0; i < 12; i++) {
            g.update(dt); g.render(); assert.deepEqual(frozen(g), atFinish);
        }
        assert.equal(paint().tint, undefined, 'remaining damage feedback has expired in paint only');
        const poses = new Set<string>();
        for (let i = 0; i < 3600; i++) {
            g.update(dt);
            if (i < 220 || i % 120 === 0) {
                g.render(); poses.add(paint().pose); assert.equal(paint().tint, undefined);
                assert.deepEqual(frozen(g), atFinish);
            }
        }
        assert.deepEqual([...poses].sort(), ['blink', 'idle']);
        assert.equal(update.mock.callCount(), 0, 'completed updates never run native Player.update');
        h.keys([]); g.load(g.stage.id); assert.equal(g.finished, false);
        // A fresh attempt cannot inherit the prior completed clock or decayed tint.
        g.player.data.invincibleTimer = 150; g.player.data.landingTimer = 90;
        g.render(); assert.deepEqual(paint(), { tint: ART.paper, pose: 'land' });
        assert.deepEqual(h.storageCalls, []);
    });

const adapters = [
    { name: 'Gallery', make: guairaGalleryBrowser, settle: 0, runs: galleryRecording.runs },
    { name: 'Respiros', make: guairaRespirosBrowser, settle: respirosRecording.initialSettleFrames, runs: respirosRecording.runs },
    { name: 'Junction', make: guairaJunctionBrowser, settle: 0, runs: junctionRecording.runs },
] as const;
for (const adapter of adapters) test(`${adapter.name} completed landing/tint expire without changing the native arrival`, t => {
    const h = adapter.make(t), g = h.create(), paint = observeBody(t);
    for (let i = 0; i < adapter.settle; i++) g.update(dt);
    arrival: for (const [count, keys] of adapter.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let i = 0; i < count; i++) { g.update(dt); if (g.finished) break arrival; }
    }
    assert.equal(g.finished, true); assert.equal(g.player.data.isDead, false);
    g.render();
    if (adapter.name === 'Gallery') assert.equal(paint().pose, 'blink', 'native Gallery route arrives during blink');
    // Conditional feedback fixture only, after the real recorded route finishes.
    // These stages are not claimed to have a natural white-arrival route.
    g.player.data.invincibleTimer = 150; g.player.data.landingTimer = 90;
    const atFinish = frozen(g); g.render();
    assert.deepEqual(paint(), { tint: ART.paper, pose: 'land' });
    h.key('Escape'); g.update(dt); assert.equal(g.state, 'paused');
    for (let i = 0; i < 120; i++) g.update(dt);
    g.render(); assert.deepEqual(paint(), { tint: ART.paper, pose: 'land' });
    const enabled = g.audio.enabled;
    h.key('m'); g.update(dt); assert.equal(g.audio.enabled, !enabled);
    assert.deepEqual(frozen(g), atFinish);
    h.key('Escape'); assert.equal(g.state, 'playing');
    h.keys(['ArrowLeft', 'Space', 'ArrowDown']);
    const poses = new Set<string>();
    for (let i = 0; i < 220; i++) {
        g.update(dt); g.render(); assert.deepEqual(frozen(g), atFinish);
        if (i >= 12) { assert.equal(paint().tint, undefined); poses.add(paint().pose); }
    }
    assert.deepEqual([...poses].sort(), ['blink', 'idle']);
    h.keys([]); g.load(g.stage.id); assert.equal(g.finished, false);
    // Replaying to the next arrival also resets presentation time.
    for (let i = 0; i < adapter.settle; i++) g.update(dt);
    retry: for (const [count, keys] of adapter.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let i = 0; i < count; i++) { g.update(dt); if (g.finished) break retry; }
    }
    assert.equal(g.finished, true);
    g.player.data.invincibleTimer = 150; g.player.data.landingTimer = 90;
    g.render(); assert.deepEqual(paint(), { tint: ART.paper, pose: 'land' });
});

test('completed presentation settles pound recovery, preserves death and never mutates its source', t => {
    const h = guairaReliefBrowser(t), g = h.create(), paint = observeBody(t);
    const presentation = new CompletedAvatarPresentation();
    const p = g.player.data;
    p.groundPoundState = GroundPoundState.RECOVERY; p.groundPoundTimer = 180;
    p.landingTimer = 90; p.invincibleTimer = 150; p.miniFantaTimer = 100;
    const before = structuredClone(p);
    presentation.draw(g.renderer, p, g.camera); assert.deepEqual(paint(), { tint: ART.paper, pose: 'sit' });
    presentation.advance(200); presentation.draw(g.renderer, p, g.camera);
    assert.deepEqual(paint(), { tint: undefined, pose: 'idle' }); assert.deepEqual(p, before);
    presentation.reset(); presentation.draw(g.renderer, p, g.camera);
    assert.deepEqual(paint(), { tint: ART.paper, pose: 'sit' });
    g.player.die('hit'); const dead = structuredClone(p);
    g.renderer.drawPlayer(p, g.camera); const nativeDeath = paint();
    presentation.advance(4000); presentation.draw(g.renderer, p, g.camera);
    assert.deepEqual(paint(), nativeDeath); assert.deepEqual(p, dead); assert.equal(p.isDead, true);
});

test('player painter defaults retain the native clock and palette for active play', t => {
    const h = guairaReliefBrowser(t), g = h.create(), paint = observeBody(t), p = g.player.data;
    g.renderer.advanceClock(3300);
    // VisualClock clamps a single step; use normal ticks to reach the blink phase.
    for (let i = 0; i < 183; i++) g.renderer.advanceClock(dt);
    const before = frozen(g);
    g.renderer.drawPlayer(p, g.camera); const native = paint();
    assert.equal(native.pose, 'blink');
    g.renderer.drawPlayer(p, g.camera, undefined, 0); assert.deepEqual(paint(), native);
    g.render(); assert.deepEqual(paint(), native, 'the WorldGame hook keeps uncompleted rendering identical');
    g.renderer.drawPlayer(p, g.camera, undefined, 200); assert.equal(paint().pose, 'idle');
    assert.deepEqual(frozen(g), before, 'the optional player offset never changes the renderer clock');
});
