import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GuairaChapterWater, hasAcceptedPublicWater } from '../src/adventure/experimental/guaira/chapter/GuairaChapterWater';
import { GuairaChapterSession, type GuairaChapterOpening, type GuairaChapterLiveResult } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { loadGuairaChapterScene } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import type { GuairaMayorLab } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { loadGuairaChapterExcursion } from '../src/adventure/experimental/guaira/chapter/GuairaChapterExcursions';
import type { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import { GUAIRA_WATER_CONTRACT } from '../src/adventure/experimental/guaira/GuairaWaterMotion';
import data from '../src/adventure/experimental/guaira/chapter/GuairaBairroWaterData.json';

type Browser = ReturnType<typeof sceneLifecycleBrowser>;
const recording = JSON.parse(readFileSync(new URL('./helpers/guairaMayorReplay.json', import.meta.url), 'utf8'));
/** Only prerequisite receipts are fixtures. The payoff always comes from a real
 * Prefeito game, input recording, adapter and accepted transition below. */
function mayorSession(opening: GuairaChapterOpening = 'guaira-travessia') {
    const session = new GuairaChapterSession({ opening });
    for (const sceneId of session.snapshot().route.slice(0, 4)) {
        const attempt = session.enterScene(sceneId, session.snapshot().generation)!;
        const result = sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' } as const
            : { sceneId, kind: 'reached-finish' } as GuairaChapterLiveResult['result'];
        assert.ok(session.continueFrom(attempt, { attempt, alive: true, state: 'playing', result }));
    }
    assert.equal(hasAcceptedPublicWater(session.snapshot()), false); return session;
}
function play(h: Browser, game: GuairaMayorLab | GuairaRelief, runs = recording.runs, sample = () => {}) {
    let held = new Set<string>();
    for (const [count, keys] of [[recording.initialSettleFrames ?? 0, []], ...runs] as Array<[number, string[]]>) {
        const next = new Set(keys);
        for (const code of held) if (!next.has(code)) h.key('keyup', code === 'Space' ? ' ' : code);
        for (const code of next) if (!held.has(code)) h.key('keydown', code === 'Space' ? ' ' : code);
        held = next;
        for (let i = 0; i < count; i++) { game.update(recording.stepMs); sample(); }
    }
    for (const code of held) h.key('keyup', code === 'Space' ? ' ' : code);
}
async function mayor(h: Browser) {
    const factory = await loadGuairaChapterScene('guaira-prefeito');
    const runtime = factory(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    runtime.game.start(); return runtime;
}

for (const [opening, action] of [['guaira-travessia', 'continue'], ['guaira-patio-comportas', 'map']] as const) {
    test(`${opening}: only accepted native Prefeito ${action} wets water; replay, selection and optional geography preserve receipt`, async t => {
        const h = sceneLifecycleBrowser(t), session = mayorSession(opening), water = new GuairaChapterWater();
        const attempt = session.enterScene('guaira-prefeito', session.snapshot().generation)!;
        const runtime = await mayor(h), game = runtime.game as GuairaMayorLab;
        const partial = new Set<number>();
        play(h, game, recording.runs, () => {
            water.update(session.snapshot()); assert.equal(water.released, false, 'native readiness alone cannot paint the map');
            if (game.mayor.sealsRemaining > 0) {
                partial.add(game.mayor.sealsRemaining); assert.equal(runtime.sample(attempt).result, null);
                assert.equal(session.continueFrom(attempt, runtime.sample(attempt)), null);
            }
        });
        assert.deepEqual([...partial].sort(), [1, 2, 3]); assert.equal(game.mayor.publicWaterOpen, true);
        assert.equal(game.player.data.isDead, false);
        const ready = runtime.sample(attempt);
        assert.equal(session.continueFrom(attempt, { ...ready, result: { sceneId: 'guaira-lab', kind: 'defeated-bull' } }), null);
        assert.equal(session.continueFrom(attempt, { ...ready, result: { sceneId: 'guaira-prefeito', kind: 'reached-finish' } } as unknown as GuairaChapterLiveResult), null);
        assert.equal(session.continueFrom(attempt, { ...ready, attempt: { ...attempt, sessionId: attempt.sessionId + 1 } }), null);
        assert.equal(water.released, false);
        if (action === 'map') { runtime.togglePause(); assert.equal(runtime.game.state, 'paused'); assert.equal(session.continueFrom(attempt, runtime.sample(attempt)), null); }
        const transition = action === 'map' ? session.exitToMap(attempt, runtime.sample(attempt)) : session.continueFrom(attempt, runtime.sample(attempt));
        assert.ok(transition?.newlyAccepted); assert.equal(transition.receipt?.acceptedVia, action);
        water.update(transition.snapshot); assert.equal(water.released, true); assert.deepEqual(water.regions, [{ bounds: data.bounds }]);
        assert.equal(session.continueFrom(attempt, ready), null); assert.equal(session.exitToMap(attempt, ready), null);
        game.dispose(); assert.equal(runtime.sample(attempt).result, null);
        const original = transition.receipt;
        if (action === 'continue') {
            const selectedMayor = session.selectScene('guaira-prefeito', session.snapshot().generation)!;
            const replayMayor = session.enterScene('guaira-prefeito', selectedMayor.generation)!;
            const replayRuntime = await mayor(h);
            play(h, replayRuntime.game as GuairaMayorLab);
            const replayReady = replayRuntime.sample(replayMayor);
            const duplicate = session.continueFrom(replayMayor, replayReady)!;
            assert.equal(duplicate.newlyAccepted, false); assert.equal(duplicate.receipt, original);
            assert.equal(duplicate.snapshot.accepted.length, 5); assert.equal(hasAcceptedPublicWater(duplicate.snapshot), true);
            assert.equal(session.continueFrom(replayMayor, replayReady), null);
            replayRuntime.game.dispose();
        }
        const selected = session.selectScene(opening, session.snapshot().generation)!;
        assert.notEqual(original!.attempt.generation, selected.generation.generation);
        water.update(selected); assert.equal(water.released, true, 'historical accepted generation remains valid');
        const replay = session.enterScene(opening, selected.generation)!, retry = session.retry(replay)!;
        session.exitToMap(retry, { attempt: retry, alive: false, state: 'dead', result: null });
        water.update(session.snapshot()); assert.equal(water.released, true); assert.equal(session.snapshot().accepted[4], original);
        const restarted = session.restartChapter(session.snapshot().generation)!;
        water.update(session.snapshot()); assert.equal(water.released, false, 'disposed old session is never wet');
        water.update(restarted.snapshot()); assert.equal(water.released, false);
        water.update(new GuairaChapterSession({ opening }).snapshot()); assert.equal(water.released, false, 'reload has no receipt');
        assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
        assert.ok(h.contexts.every(context => context.state === 'closed' && context.closeCalls === 1));
        water.dispose(); assert.equal(water.active, false); assert.deepEqual(water.regions, []);
    });
}

test('native retry retires an earned-but-unaccepted result; native death and disposed adapter stay dry', async t => {
    const h = sceneLifecycleBrowser(t), session = mayorSession(), runtime = await mayor(h), game = runtime.game as GuairaMayorLab;
    let attempt = session.enterScene('guaira-prefeito', session.snapshot().generation)!;
    play(h, game); const old = attempt, ready = runtime.sample(old); assert.ok(ready.result);
    attempt = session.retry(attempt)!; game.load('guaira-prefeito');
    assert.equal(game.mayor.publicWaterOpen, false); assert.equal(runtime.sample(attempt).result, null);
    assert.equal(session.continueFrom(old, ready), null); assert.equal(session.continueFrom(attempt, ready), null);
    assert.equal(hasAcceptedPublicWater(session.snapshot()), false);
    play(h, game); assert.equal(game.mayor.publicWaterOpen, true);
    game.player.die('fall'); assert.equal(runtime.sample(attempt).alive, false);
    assert.equal(session.continueFrom(attempt, runtime.sample(attempt)), null);
    assert.equal(session.exitToMap(attempt, runtime.sample(attempt))?.receipt, null);
    assert.equal(hasAcceptedPublicWater(session.snapshot()), false);
    game.dispose(); assert.equal(runtime.sample(attempt).result, null); assert.equal(h.frames.size, 0);
});

test('real optional Relief cap and misleading geography cannot release chapter water', async t => {
    const h = sceneLifecycleBrowser(t), session = mayorSession();
    const factory = await loadGuairaChapterExcursion('relief');
    const runtime = factory(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    const game = runtime.game as GuairaRelief;
    const relief = JSON.parse(readFileSync(new URL('./helpers/guairaReliefReplay.json', import.meta.url), 'utf8'));
    play(h, game, relief.maintenance);
    assert.equal(game.reliefOpened, true); assert.equal(game.finished, true);
    assert.equal(hasAcceptedPublicWater(session.snapshot()), false); assert.equal(session.snapshot().accepted.length, 4);
    game.dispose();
    const native = await mayor(h), attempt = session.enterScene('guaira-prefeito', session.snapshot().generation)!;
    Object.defineProperty(native.game, 'mapReturnHref', { get: () => './guaira.html?at=bairro&visit=mayor-clear' });
    assert.equal(native.returnArrival(), 'bairro'); assert.equal(native.sample(attempt).result, null);
    session.exitToMap(attempt, native.sample(attempt)); assert.equal(hasAcceptedPublicWater(session.snapshot()), false);
    native.game.dispose(); assert.equal(h.frames.size, 0);
});

test('final authored bowl and fall stay bounded, and compose irrigation regions without extra resources', () => {
    const [x, y, w, h] = data.bounds;
    assert.ok(data.bounds.every(Number.isInteger)); assert.ok(w > 0 && w <= 80 && h > 0 && h <= 80);
    assert.ok(data.bowl.length >= 3 && data.fall.length >= 3);
    for (const point of [...data.bowl, ...data.fall]) {
        assert.ok(point.every(Number.isFinite)); assert.ok(point[0] >= x && point[0] <= x + w && point[1] >= y && point[1] <= y + h);
    }
    const effect = new GuairaChapterWater();
    const irrigation = { regions: GUAIRA_WATER_CONTRACT.regions, draw() {} };
    effect.setIrrigation(irrigation); assert.equal(effect.regions, irrigation.regions);
    effect.update(new GuairaChapterSession().snapshot()); assert.equal(effect.regions, irrigation.regions);
    effect.dispose(); assert.equal(effect.active, false); assert.deepEqual(effect.regions, []);
});
