import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaMayorModel, MAYOR_ARENA as A, MAYOR_RULES as R } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { drawGuairaMayorStampTarget, MAYOR_PALETTE as P } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { drawGuairaMayorObjects } from '../src/adventure/experimental/guaira/GuairaMayorArenaArt';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';

/** Capture the actual integer paint commands, with no alternative state model. */
function paint(draw: (c: CanvasRenderingContext2D) => void) {
    const ink: Array<{ x: number; y: number; w: number; h: number; color: string }> = [];
    const c = { fillStyle: '', save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
        fillRect(x: number, y: number, w: number, h: number) { ink.push({ x, y, w, h, color: this.fillStyle }); }
    };
    draw(c as unknown as CanvasRenderingContext2D);
    return { ink, at(x: number, y: number) {
        return [...ink].reverse().find(r => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h)?.color;
    } };
}

test('pressure slots advance with the native warning and stay inside its exact future danger', () => {
    const b = new GuairaMayorModel(), access = { valveActive: false, liftReady: false, registerOpened: false };
    const advance = (n: number) => { for (let i = 0; i < n; i++) b.update(R.tickMs, access); };
    advance(R.intro + R.idle);
    const counts: number[] = [];
    for (const ticks of [0, 30, 29]) {
        advance(ticks); assert.equal(b.state, 'warning'); assert.equal(b.danger, null);
        const before = structuredClone(b), normal = paint(c => drawGuairaMayorStampTarget(c, b));
        const reduced = paint(c => drawGuairaMayorStampTarget(c, b, 0, 0, true));
        assert.deepEqual(reduced.ink, normal.ink, 'reduced motion retains the functional countdown');
        assert.deepEqual(structuredClone(b), before, 'drawing cannot advance the warning clock');
        for (const r of normal.ink) {
            assert.ok(r.x >= b.stampTarget.x && r.x + r.w <= b.stampTarget.x + b.stampTarget.width);
            assert.ok(r.y >= b.stampTarget.y && r.y + r.h <= b.stampTarget.y + b.stampTarget.height);
        }
        let lit = 0;
        for (let x = b.stampTarget.x + 4; x < b.stampTarget.x + b.stampTarget.width - 4; x++)
            if (normal.at(x, b.stampTarget.y + b.stampTarget.height - 7) === P.warning) lit++;
        counts.push(lit);
    }
    assert.equal(counts[0], 0); assert.ok(counts[1] > 0); assert.ok(counts[2] > counts[1]);
    advance(1 + R.leap); assert.equal(b.state, 'stamp'); assert.deepEqual(b.danger, b.stampTarget);
    const active = paint(c => drawGuairaMayorStampTarget(c, b));
    assert.ok(active.ink.every(r => r.color !== P.warning), 'the complete active water replaces the countdown');
    advance(R.stamp);
    assert.deepEqual(paint(c => drawGuairaMayorStampTarget(c, b)).ink, [], 'the vent cue clears at recovery');
});

test('register and lift cues reject stale openings, follow actual carry height and reset after missed recovery', t => {
    const h = guairaMayorBrowser(t), g = h.create(), b = g.mayor;
    const art = () => paint(c => drawGuairaMayorObjects(c, g.objects, b, 0, 0));
    const connectColor = () => art().at(100, 220);
    g.objects.activate(A.valveId); h.run(g, R.intro + R.idle);
    assert.equal(g.objects.get(A.valveId)!.active, false, 'the tell drains stale pressure');
    assert.equal(g.objects.get(A.liftId)!.y, A.deckY);
    assert.equal(b.accessRequested, false); assert.equal(connectColor(), P.bronze, 'pre-stamp movement is not a fresh opening');
    h.run(g, R.warning + R.leap + R.stamp + R.returning);
    assert.equal(b.state, 'recover'); assert.equal(b.vulnerable, false);
    assert.equal(art().at(66, 217), P.warning, 'closed recovery highlights the real register plate');
    h.run(g, 1); assert.equal(g.objects.get(A.liftId)!.y, A.floor);
    g.objects.activate(A.valveId); g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    h.run(g, 25);
    assert.equal(b.accessRequested, true); assert.equal(b.vulnerable, false);
    assert.equal(connectColor(), P.water, 'a fresh native activation carries pressure to the lift');
    const lift = g.objects.get(A.liftId)!;
    assert.ok(lift.y > A.deckY && lift.y < A.floor);
    const rising = art();
    assert.equal(rising.at(116, A.floor - 2), P.waterLight);
    assert.notEqual(rising.at(116, Math.floor(lift.y - 2)), P.waterLight, 'pressure cannot run ahead of the physical lift');
    assert.notEqual(rising.at(116, 142), P.waterLight, 'ready lamp remains off in transit');
    h.run(g, 72); assert.equal(b.vulnerable, true);
    assert.equal(art().at(116, 142), P.waterLight, 'the upper lamp lights with actual access readiness');
    g.objects.activate(A.valveId); g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    assert.equal(b.vulnerable, false); assert.equal(connectColor(), P.bronze);
    assert.equal(art().at(66, 217), P.warning, 'closing the register restores the useful ground-pound instruction');
    h.run(g, 25); g.objects.activate(A.valveId); g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    h.run(g, 30); assert.equal(b.vulnerable, true); assert.equal(connectColor(), P.water);
    h.run(g, b.recoveryTicksRemaining);
    assert.equal(b.state, 'idle'); assert.equal(g.objects.get(A.valveId)!.active, true);
    assert.equal(connectColor(), P.bronze, 'an expired opening must not keep the route-ready cue');
    assert.notEqual(art().at(116, 142), P.waterLight);
});

test('recovery readout shares the real deadline across lift travel, reclosure, pressure and hits', () => {
    const b = new GuairaMayorModel();
    const closed = { valveActive: false, liftReady: false, registerOpened: false };
    const advance = (n: number, access = closed) => { for (let i = 0; i < n; i++) b.update(R.tickMs, access); };
    assert.equal(b.recoveryProgress, 0);
    advance(R.intro + R.idle + R.warning + R.leap + R.stamp + R.returning);
    assert.equal(b.state, 'recover'); assert.equal(b.recoveryProgress, 0);
    advance(90);
    assert.equal(b.vulnerable, false); assert.equal(b.recoveryProgress, 90 / R.recover, 'waiting at the valve still consumes recovery');
    advance(1, { valveActive: true, liftReady: false, registerOpened: true });
    advance(70, { valveActive: true, liftReady: false, registerOpened: false });
    assert.ok(b.recoveryProgress>0);
    advance(1, { valveActive: true, liftReady: true, registerOpened: false });
    assert.equal(b.vulnerable, true); assert.equal(b.recoveryProgress,0,'the visible back rail begins when the real lift arrives');
    assert.equal(b.recoveryTicksRemaining,R.minimumOpening);
    advance(1); assert.equal(b.vulnerable, false);
    advance(1, { valveActive: true, liftReady: true, registerOpened: true });
    assert.equal(b.vulnerable, true); assert.equal(b.recoveryProgress,2/R.minimumOpening,'reopening cannot refill the back rail');
    assert.equal(b.contact({ x: 274, y: 100, width: 14, height: 24 }, { x: 274, y: 96, width: 14, height: 24 }, true), 'hit');
    assert.equal(b.recoveryProgress, 0, 'a successful contact clears the readout');
    advance(R.hurt + R.idle + 2 * (R.jetWarning + R.jetBeat) + R.warning + R.leap + R.stamp + R.returning);
    advance(1, { valveActive: true, liftReady: true, registerOpened: true });
    assert.equal(b.counterpressure?.phase, 'warning');
    advance(R.counterpressureWarning, { valveActive: true, liftReady: true, registerOpened: false });
    assert.equal(b.counterpressure?.phase, 'active');
    const active = b.recoveryProgress;
    advance(R.counterpressureActive, { valveActive: true, liftReady: true, registerOpened: false });
    assert.equal(b.counterpressure, null); assert.ok(b.recoveryProgress > active, 'waiting for water consumes the same deadline');
    advance(b.recoveryTicksRemaining - 1, { valveActive: true, liftReady: true, registerOpened: false });
    assert.equal(b.vulnerable, true); assert.ok(b.recoveryProgress < 1 && b.recoveryProgress > .99);
    advance(1, { valveActive: true, liftReady: true, registerOpened: false });
    assert.equal(b.state, 'idle'); assert.equal(b.vulnerable, false); assert.equal(b.recoveryProgress, 0);
});
