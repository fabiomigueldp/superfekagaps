import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { WorldGame } from '../src/adventure/WorldGame';
import type { GuairaMayorLab } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { loadGuairaChapterScene, type GuairaChapterRuntime } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { GuairaChapterSession, type GuairaChapterAttempt,
    type GuairaChapterSceneId } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

type Browser = ReturnType<typeof sceneLifecycleBrowser>;
type Recording = { stepMs: number; frames?: number; inputFrames?: number; initialSettleFrames?: number;
    runs: Array<[number, string[]]>; expectedHits?: Array<{ frame: number; health: number }> };
const readRecording = (name: string): Recording => JSON.parse(readFileSync(new URL(`./helpers/${name}.json`, import.meta.url), 'utf8'));
const recordings: Record<GuairaChapterSceneId, Recording> = {
    'guaira-travessia': readRecording('guairaTraversalReplay'),
    'guaira-patio-comportas': readRecording('guairaJunctionReplay'),
    'guaira-respiros': readRecording('guairaRespirosReplay'),
    'guaira-lab': readRecording('guairaLabReplay'),
    'guaira-subida': readRecording('guairaAscentReplay'),
    'guaira-prefeito': readRecording('guairaMayorReplay')
};
const arrivals: Record<GuairaChapterSceneId, string> = {
    'guaira-travessia': 'rice', 'guaira-patio-comportas': 'rice', 'guaira-respiros': 'rice',
    'guaira-lab': 'corral', 'guaira-subida': 'vazao', 'guaira-prefeito': 'vazao'
};

/** These are independent reads of native state, never writes to a completion flag. */
function nativeComplete(game: WorldGame): boolean {
    if (game.stage.id === 'guaira-lab') return game.boss?.phase === 'defeated';
    if (game.stage.id === 'guaira-prefeito') return (game as GuairaMayorLab).mayor.publicWaterOpen;
    return (game as WorldGame & { finished: boolean }).finished;
}
function resultKind(scene: GuairaChapterSceneId) {
    return scene === 'guaira-lab' ? 'defeated-bull' : scene === 'guaira-prefeito' ? 'mayor-water-released' : 'reached-finish';
}
function enter(session: GuairaChapterSession, scene = session.snapshot().selectedScene): GuairaChapterAttempt {
    const selected = session.selectScene(scene, session.snapshot().generation);
    assert.ok(selected, `${scene}: selectable only when earned or recommended`);
    const attempt = session.enterScene(scene, selected.generation);
    assert.ok(attempt);
    return attempt;
}
async function mount(h: Browser, scene: GuairaChapterSceneId) {
    // Exercise the same lazy registry the chapter host calls, not substitute scenes.
    const factory = await loadGuairaChapterScene(scene);
    const runtime = factory(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    assert.ok(runtime.game instanceof WorldGame);
    assert.ok(runtime.game.player instanceof Player);
    assert.ok(runtime.game.input instanceof Input);
    assert.equal(runtime.game.stage.id, scene);
    assert.equal(nativeComplete(runtime.game), false);
    assert.equal(runtime.game.player.data.hasHelmet, true);
    runtime.game.start(); runtime.game.start();
    assert.equal(h.frames.size, 1, 'one real scene clock is owned');
    return runtime;
}

/** Dispatch ordinary keyboard or native canvas touch gestures into the real Input. */
function controls(h: Browser, touch: boolean) {
    let held = new Set<string>();
    return (keys: string[]) => {
        const next = new Set(keys);
        if (touch) {
            const positions: Record<string, number> = { ArrowLeft: .08, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .78, Space: .93 };
            const touches = keys.map((key, index) => {
                assert.ok(key in positions, `known native touch action: ${key}`);
                return { identifier: index + 1, target: h.canvas, clientX: positions[key] * 640, clientY: 330 };
            });
            h.canvas.dispatch(touches.length ? 'touchstart' : 'touchend', { touches });
        } else {
            for (const code of held) if (!next.has(code))
                h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const code of next) if (!held.has(code))
                h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        }
        held = next;
    };
}

function play(h: Browser, session: GuairaChapterSession, runtime: GuairaChapterRuntime,
    attempt: GuairaChapterAttempt, touch: boolean,
    recording = recordings[attempt.sceneId], until = Infinity, expectIntact = true) {
    const setControls = controls(h, touch), game = runtime.game;
    const acceptedBefore = session.snapshot().accepted.length;
    let frame = 0, firstResult: number | null = null, checkpointBeforeFinish = false;
    let previousHealth = game.boss?.health, previousSeals = game.stage.id === 'guaira-prefeito' ? (game as GuairaMayorLab).mayor.sealsRemaining : null;
    const hits: Array<{ frame: number; health: number }> = [], sealFrames: number[] = [];
    const blocks: Array<[number, string[]]> = [[recording.initialSettleFrames ?? 0, []], ...recording.runs];
    for (const [count, keys] of blocks) {
        setControls(keys);
        for (let index = 0; index < count && frame < until; index++) {
            game.update(recording.stepMs); frame++;
            const live = runtime.sample(attempt), completed = nativeComplete(game);
            assert.equal(live.result !== null, completed, `${attempt.sceneId}: native result at frame ${frame}`);
            assert.equal(live.alive, !game.player.data.isDead);
            assert.equal(session.canContinue(attempt, live), completed && live.alive && game.state === 'playing');
            if (completed) {
                firstResult ??= frame;
                assert.deepEqual(live.result, { sceneId: attempt.sceneId, kind: resultKind(attempt.sceneId) });
            } else {
                assert.equal(session.continueFrom(attempt, live), null, `unfinished frame ${frame} cannot advance`);
                checkpointBeforeFinish ||= game.store.save.checkpoint !== null;
            }
            assert.equal(session.snapshot().accepted.length, acceptedBefore, 'sampling success never accepts it');
            if (expectIntact) {
                assert.equal(game.player.data.isDead, false, `${attempt.sceneId}: alive at frame ${frame}`);
                assert.equal(game.player.data.hasHelmet, true, `${attempt.sceneId}: helmet at frame ${frame}`);
            }
            if (game.boss?.health !== previousHealth) {
                hits.push({ frame: frame - 1, health: game.boss!.health }); previousHealth = game.boss?.health;
            }
            if (previousSeals !== null) {
                const seals = (game as GuairaMayorLab).mayor.sealsRemaining;
                if (seals < previousSeals) sealFrames.push(frame);
                previousSeals = seals;
            }
        }
        if (frame === until) break;
    }
    setControls([]);
    if (until === Infinity) assert.equal(frame, (recording.frames ?? recording.inputFrames!) + (recording.initialSettleFrames ?? 0));
    assert.deepEqual(game.store.save.completed, []);
    assert.deepEqual(game.store.save.times, {});
    return { frame, firstResult, checkpointBeforeFinish, hits, sealFrames };
}

function discard(h: Browser, runtime: GuairaChapterRuntime, attempt: GuairaChapterAttempt) {
    const game = runtime.game, pending = [...h.frames.values()], oldSource = game.input.createActionSource();
    const before = structuredClone({ time: game.time, elapsed: game.elapsed, player: game.player.data, complete: nativeComplete(game) });
    game.dispose(); game.dispose();
    assert.equal(game.isDisposed, true); assert.equal(game.input.isDisposed, true);
    assert.equal(game.renderer.isDisposed, true); assert.equal(game.audio.isDisposed, true);
    assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
    assert.equal(h.window.worldGame, undefined); assert.equal(h.window.renderer, undefined);
    assert.ok(h.contexts.every(context => context.state === 'closed'));
    assert.ok(h.contexts.every(context => context.closeCalls === 1));
    const draws = h.drawCount(), contexts = h.contexts.length;
    for (const callback of pending) callback(performance.now() + 1000);
    oldSource.press('jump'); h.key('keydown', 'ArrowRight');
    runtime.togglePause(); game.update(1000); game.render(); game.start(); game.audio.unlock();
    assert.deepEqual(structuredClone({ time: game.time, elapsed: game.elapsed, player: game.player.data, complete: nativeComplete(game) }), before);
    assert.deepEqual(runtime.sample(attempt), { attempt, state: 'disposed', alive: false, result: null });
    assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0); assert.equal(h.drawCount(), draws);
    assert.equal(h.contexts.length, contexts);
}

for (const [opening, touch] of [['guaira-travessia', false], ['guaira-patio-comportas', true]] as const) {
    test(`${opening}: real ${touch ? 'touch' : 'keyboard'} journey earns five native receipts, returns to map and disposes every scene`, async t => {
        const h = sceneLifecycleBrowser(t), session = new GuairaChapterSession({ opening });
        const proof: Array<{ scene: GuairaChapterSceneId; frames: number; resultAt: number | null }> = [];
        const route = session.snapshot().route;
        for (let index = 0; index < route.length; index++) {
            const scene = route[index];
            let attempt = enter(session), runtime = await mount(h, scene);
            assert.equal(runtime.sample(attempt).result, null);
            // Poison navigation metadata only: even a claimed mayor-clear URL is no receipt.
            Object.defineProperty(runtime.game, 'mapReturnHref', { configurable: true,
                get: () => './guaira.html?at=vazao&visit=mayor-clear' });
            assert.equal(runtime.returnArrival(), 'vazao');
            assert.equal(runtime.sample(attempt).result, null);
            assert.equal(session.continueFrom(attempt, runtime.sample(attempt)), null);
            Reflect.deleteProperty(runtime.game, 'mapReturnHref');
            // Merely entering, pausing or leaving a scene cannot satisfy its objective.
            runtime.togglePause(); assert.equal(runtime.game.state, 'paused');
            const pausedTime = runtime.game.time; runtime.game.update(1000);
            assert.equal(runtime.game.time, pausedTime);
            assert.equal(session.continueFrom(attempt, runtime.sample(attempt)), null);
            const abandoned = session.exitToMap(attempt, runtime.sample(attempt));
            assert.ok(abandoned); assert.equal(abandoned.receipt, null); assert.equal(abandoned.newlyAccepted, false);
            assert.equal(session.snapshot().accepted.length, index);
            discard(h, runtime, attempt);

            attempt = enter(session, scene); runtime = await mount(h, scene);
            if (scene === 'guaira-prefeito') {
                // The obsolete crossing fixture really loses its helmet and dies in seam pressure.
                const failed = play(h, session, runtime, attempt, touch, readRecording('guairaMayorOriginalCrossing'), 873, false);
                assert.deepEqual(failed.sealFrames, [322, 622]);
                assert.equal(failed.firstResult, null); assert.equal(runtime.game.player.data.isDead, true);
                assert.equal((runtime.game as GuairaMayorLab).mayor.sealsRemaining, 1);
                assert.equal(session.canContinue(attempt, runtime.sample(attempt)), false);
                assert.equal(session.exitToMap(attempt, runtime.sample(attempt))?.receipt, null);
                assert.equal(session.snapshot().chapterComplete, false); assert.equal(session.snapshot().accepted.length, 4);
                discard(h, runtime, attempt);
                attempt = enter(session, scene); runtime = await mount(h, scene);
            }
            const played = play(h, session, runtime, attempt, touch);
            assert.ok(played.firstResult !== null, `${scene}: complete recorded route earns the actual result`);
            if (scene !== 'guaira-lab') assert.equal(played.checkpointBeforeFinish, true, 'a native checkpoint was observed without awarding completion');
            if (scene === 'guaira-lab') assert.deepEqual(played.hits, recordings[scene].expectedHits);
            if (scene === 'guaira-prefeito') assert.deepEqual(played.sealFrames, [322, 652, 982]);
            assert.equal(runtime.returnArrival(), arrivals[scene]);
            assert.equal(session.snapshot().accepted.length, index);
            proof.push({ scene, frames: played.frame, resultAt: played.firstResult });

            runtime.togglePause();
            assert.equal(session.continueFrom(attempt, runtime.sample(attempt)), null, 'completed pause still blocks Continue');
            // Exercise both explicit acceptance paths, ending the Mayor at the map.
            const useMap = index % 2 === 1 || scene === 'guaira-prefeito';
            if (!useMap) runtime.togglePause();
            const transition = useMap ? session.exitToMap(attempt, runtime.sample(attempt))
                : session.continueFrom(attempt, runtime.sample(attempt));
            assert.ok(transition); assert.equal(transition.newlyAccepted, true);
            assert.equal(transition.receipt?.acceptedVia, useMap ? 'map' : 'continue');
            assert.deepEqual(transition.receipt?.result, { sceneId: scene, kind: resultKind(scene) });
            assert.equal(transition.snapshot.activeAttempt, null, 'return/recommendation cannot auto-enter the next scene');
            assert.equal(transition.snapshot.nextRecommendedScene, route[index + 1] ?? null);
            const staleReady = runtime.sample(attempt);
            assert.equal(session.continueFrom(attempt, staleReady), null);
            assert.equal(session.exitToMap(attempt, staleReady), null);
            discard(h, runtime, attempt);
        }
        const done = session.snapshot();
        assert.equal(done.chapterComplete, true); assert.equal(done.activeAttempt, null);
        assert.deepEqual(done.accepted.map(receipt => receipt.sceneId), route);
        // Replay through a fresh real scene preserves the original receipt and its history.
        const attempt = enter(session, opening), runtime = await mount(h, opening);
        play(h, session, runtime, attempt, touch);
        const repeated = session.continueFrom(attempt, runtime.sample(attempt));
        assert.ok(repeated); assert.equal(repeated.newlyAccepted, false); assert.equal(repeated.receipt, done.accepted[0]);
        assert.deepEqual(session.snapshot().accepted, done.accepted);
        discard(h, runtime, attempt); session.dispose();
        t.diagnostic(JSON.stringify({ opening, input: touch ? 'native touch' : 'keyboard', proof, receipts: done.accepted.length }));
    });
}

test('real victory is invalidated by native retry and live death; stale readiness cannot award a receipt', async t => {
    const h = sceneLifecycleBrowser(t), session = new GuairaChapterSession();
    let attempt = enter(session); const runtime = await mount(h, attempt.sceneId);
    play(h, session, runtime, attempt, false);
    const oldAttempt = attempt, oldReady = runtime.sample(attempt);
    assert.equal(session.canContinue(attempt, oldReady), true);
    attempt = session.retry(attempt)!; assert.ok(attempt);
    runtime.game.load(attempt.sceneId);
    assert.equal(nativeComplete(runtime.game), false);
    assert.equal(runtime.sample(attempt).result, null);
    assert.equal(session.continueFrom(oldAttempt, oldReady), null);
    assert.equal(session.continueFrom(attempt, oldReady), null);
    assert.equal(session.continueFrom(attempt, runtime.sample(attempt)), null);
    play(h, session, runtime, attempt, false);
    assert.equal(nativeComplete(runtime.game), true);
    // Exercise the actual Player death method after an earned result, not a forged flag/sample.
    runtime.game.player.die('fall');
    const dead = runtime.sample(attempt);
    assert.equal(dead.alive, false); assert.ok(dead.result);
    assert.equal(session.canContinue(attempt, dead), false);
    assert.equal(session.continueFrom(attempt, dead), null);
    assert.equal(session.exitToMap(attempt, dead)?.receipt, null);
    assert.deepEqual(session.snapshot().accepted, []);
    discard(h, runtime, attempt); session.dispose();
});
