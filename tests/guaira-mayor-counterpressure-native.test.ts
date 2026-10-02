import assert from 'node:assert/strict';
import test from 'node:test';
import type { GuairaMayorLab } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { MAYOR_ARENA as A, MAYOR_RULES as R, mayorOverlaps } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { textWidth } from '../src/graphics/BitmapFont';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';
import waitRoute from './helpers/guairaMayorReplay.json';
import jumpRoute from './helpers/guairaMayorJumpPulseReplay.json';
import unchangedRoute from './helpers/guairaMayorOriginalCrossing.json';

type Harness = ReturnType<typeof guairaMayorBrowser>;
type Recording = { frames: number; stepMs: number; runs: (number | string[])[][] };
function play(h: Harness, g: GuairaMayorLab, route: Recording, touch = false, until = route.frames) {
    let frame = 0, warningTicks = 0, activeTicks = 0, firstHelmetLoss: number | null = null;
    const hits: number[] = [], recoveryTicks: number[] = [], warningStarts: number[] = [], activeStarts: number[] = [];
    let phase = g.mayor.counterpressure?.phase;
    for (const [count, keys] of route.runs as Array<[number, string[]]>) {
        assert.ok(keys.every(key => ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'Space'].includes(key)), 'the routes never sprint');
        if (touch) {
            const touches = keys.map((key, identifier) => ({ identifier: identifier + 1, target: h.canvas,
                clientX: (key === 'ArrowLeft' ? .07 : key === 'ArrowRight' ? .22 : key === 'ArrowDown' ? .5 : .93) * 640,
                clientY: 330 }));
            h.canvas.dispatch('touchstart', { touches });
        } else h.keys(keys);
        for (let n = 0; n < count && frame < until; n++) {
            const seals = g.mayor.sealsRemaining, recoveryTick = g.mayor.stateTick;
            g.update(route.stepMs); frame++;
            const b = g.mayor, pulse = b.counterpressure, p = g.player.data;
            if (b.sealsRemaining === 3) assert.equal(pulse, null, 'first seal has no seam pulse');
            if (pulse) {
                assert.equal(b.vulnerable, true); assert.equal(g.objects.get(A.liftId)!.y, A.deckY);
                assert.equal(g.objects.get(A.valveId)!.active, true);
                assert.ok(textWidth(g.boss!.hint) <= 224); assert.doesNotMatch(g.boss!.hint, /AGORA/);
                if (pulse.phase === 'warning') warningTicks++; else activeTicks++;
                if (pulse.phase !== phase) (pulse.phase === 'warning' ? warningStarts : activeStarts).push(frame);
            }
            phase = pulse?.phase;
            if (!p.hasHelmet && firstHelmetLoss === null) {
                firstHelmetLoss = frame;
                assert.equal(pulse?.phase, 'active'); assert.ok(mayorOverlaps(g.player.getRect(), A.seam));
            }
            if (b.sealsRemaining < seals) { hits.push(frame); recoveryTicks.push(recoveryTick); }
            if (route !== unchangedRoute) {
                assert.equal(p.hasHelmet, true, `helmet at ${frame}`); assert.equal(p.isDead, false, `alive at ${frame}`);
                const visualTop = Math.round(p.position.y) - Math.round(g.camera.y) - 4;
                assert.ok(visualTop >= 26, `helmet clears the HUD at ${frame}`);
            }
        }
        if (frame === until) break;
    }
    return { frame, hits, recoveryTicks, warningTicks, activeTicks, warningStarts, activeStarts, firstHelmetLoss };
}

for (const touch of [false, true]) for (const reducedMotion of [false, true]) {
    for (const [name, route, expectedHits, expectedWarnings] of [
        ['wait', waitRoute, [322, 652, 982], [502, 832]],
        ['early jump', jumpRoute, [322, 624, 926], [502, 804]]
    ] as const) test(`${touch ? 'touch' : 'keyboard'} ${name} route releases three seals with helmet (reduced motion ${reducedMotion})`, t => {
        const h = guairaMayorBrowser(t, { touch, reducedMotion }), g = h.create();
        const result = play(h, g, route, touch);
        assert.equal(result.frame, route.frames); assert.deepEqual(result.hits, expectedHits);
        assert.deepEqual(result.warningStarts, expectedWarnings);
        assert.deepEqual(result.activeStarts, expectedWarnings.map(frame => frame + 60));
        assert.equal(result.warningTicks, 120); assert.equal(result.activeTicks, 48);
        assert.equal(result.firstHelmetLoss, null); assert.ok(result.recoveryTicks.every(tick => tick < R.recover - 100));
        assert.equal(g.mayor.publicWaterOpen, true); assert.equal(g.mayor.counterpressure, null);
        assert.equal(g.player.data.isGrounded, true); assert.ok(g.player.data.position.x < 100);
        assert.equal(g.player.data.position.y + g.player.data.height, A.floor);
        assert.deepEqual(g.store.save.completed, []); assert.deepEqual(g.store.save.times, {});
        assert.deepEqual(h.storageCalls, []); g.render();
    });
}

for (const touch of [false, true]) test(`${touch ? 'touch' : 'keyboard'} unchanged crossing really loses the helmet, then dies on the next seam pulse`, t => {
    const h = guairaMayorBrowser(t, { touch }), g = h.create();
    const result = play(h, g, unchangedRoute, touch, 873);
    assert.deepEqual(result.hits, [322, 622]); assert.equal(result.firstHelmetLoss, 573);
    assert.equal(g.player.data.isDead, true); assert.equal(g.mayor.sealsRemaining, 1);
    assert.equal(g.mayor.counterpressure, null, 'death clears the painted seam on the same update');
    const deadPlayer = g.player;
    h.run(g, 90);
    assert.notEqual(g.player, deadPlayer); assert.equal(g.mayor.state, 'intro');
    assert.equal(g.mayor.sealsRemaining, 3); assert.equal(g.mayor.counterpressure, null);
    assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.position.x, 48);
    assert.equal(g.objects.get(A.valveId)!.active, false); assert.deepEqual(h.storageCalls, []);
});

for (const reducedMotion of [false, true]) for (const at of [502, 562])
    test(`all native pause paths freeze pressure at frame ${at} (reduced motion ${reducedMotion})`, t => {
        const h = guairaMayorBrowser(t, { reducedMotion }), g = h.create(); play(h, g, waitRoute, false, at);
        for (const pause of [() => g.toggleLabPause(), () => { h.key('Escape'); h.run(g, 1); },
            () => h.window.dispatch('blur'), () => h.hidden(true)]) {
            pause(); assert.equal(g.state, 'paused');
            const frozen = structuredClone({ mayor: g.mayor, player: g.player.data, objects: g.objects, camera: g.camera });
            h.run(g, 90); g.render();
            assert.deepEqual(structuredClone({ mayor: g.mayor, player: g.player.data, objects: g.objects, camera: g.camera }), frozen);
            assert.match(h.status.textContent, /Pausado/);
            h.hidden(false); g.toggleLabPause();
        }
        const ticks = g.mayor.counterpressure!.ticksRemaining;
        h.run(g, 1); assert.equal(g.mayor.counterpressure!.ticksRemaining, ticks - 1);
        assert.ok(textWidth(g.boss!.hint) <= 224); assert.match(g.boss!.hint, /EMENDA/);
    });

test('native reclosure cancels the pulse; reopening does not restart it and retry restores the tutorial', t => {
    const h = guairaMayorBrowser(t), g = h.create(); play(h, g, waitRoute, false, 520);
    assert.equal(g.mayor.counterpressure!.phase, 'warning');
    g.objects.activate(A.valveId); g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    assert.equal(g.mayor.counterpressure, null); assert.equal(g.mayor.vulnerable, false);
    h.run(g, 25); assert.equal(g.objects.activate(A.valveId), true); g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    h.run(g, 90); assert.equal(g.mayor.vulnerable, true); assert.equal(g.mayor.counterpressure, null);
    assert.equal(g.player.data.hasHelmet, true); assert.equal(g.boss!.hint, 'AGORA! GOLPE POR CIMA');
    g.load(A.id); assert.equal(g.mayor.state, 'intro'); assert.equal(g.mayor.sealsRemaining, 3);
    assert.equal(g.mayor.counterpressure, null); assert.equal(g.objects.get(A.valveId)!.active, false);
    assert.deepEqual(h.storageCalls, []);
});

test('a real native top hit clears active pressure before its hit stop, whose ticks cannot revive it', t => {
    const h = guairaMayorBrowser(t), g = h.create(); play(h, g, waitRoute, false, 562);
    // Set up only the contact under test; Player gravity, collision and hit stop remain native.
    g.player.data.position = { x: 274, y: 95.8 }; g.player.data.velocity = { x: 0, y: .5 };
    g.player.data.isGrounded = false; h.run(g, 1);
    assert.equal(g.mayor.state, 'hurt'); assert.equal(g.mayor.sealsRemaining, 1);
    assert.equal(g.mayor.counterpressure, null); assert.equal(g.player.data.hasHelmet, true);
    const tick = g.mayor.tick, stateTick = g.mayor.stateTick;
    h.run(g, 5); assert.equal(g.mayor.tick, tick); assert.equal(g.mayor.stateTick, stateTick);
    assert.equal(g.mayor.counterpressure, null); h.run(g, 1); assert.equal(g.mayor.tick, tick + 1);
});
