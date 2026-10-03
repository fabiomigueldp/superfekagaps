import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { TileType } from '../src/constants';
import { GuairaRelief, GUAIRA_RELIEF as G } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { reliefChallengeMessage, type GuairaReliefOptions } from '../src/adventure/experimental/guaira/relief/GuairaReliefChallenge';
import { loadGuairaInspectionRoom } from '../src/adventure/experimental/guaira/GuairaInspectionRooms';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import recording from './helpers/guairaReliefReplay.json';

/** Real event removal/audio ownership as well as native Input/Player. */
function guairaReliefBrowser(t: TestContext, options: { touch?: boolean; reducedMotion?: boolean } = {}) {
    const h = sceneLifecycleBrowser(t); h.media.matches = !!options.reducedMotion;
    let held = new Set<string>();
    const keys = (nextKeys: string[]) => {
        const next = new Set(nextKeys);
        if (options.touch) {
            const positions: Record<string, number> = { ArrowLeft: .08, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .78, Space: .93 };
            const touches = [...next].map(key => ({ identifier: Object.keys(positions).indexOf(key) + 1,
                target: h.canvas, clientX: positions[key] * 640, clientY: 330 }));
            h.canvas.dispatch(touches.length ? 'touchstart' : 'touchend', { touches });
        } else {
            for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        }
        held = next;
    };
    const run = (game: GuairaRelief, count: number, nextKeys: string[] = []) => {
        keys(nextKeys); for (let i = 0; i < count; i++) game.update(1000 / 60);
    };
    const hidden = (value: boolean) => { h.document.hidden = value; h.document.dispatch('visibilitychange'); };
    return { ...h, keys, run, hidden };
}
type Harness = ReturnType<typeof guairaReliefBrowser>;
type Route = keyof Omit<typeof recording, 'description'>;
function create(h: Harness, options: GuairaReliefOptions = {}) {
    return new GuairaRelief(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement, options);
}
function play(h: Harness, game: GuairaRelief, name: Route) {
    for (const [count, keys] of recording[name] as [number, string[]][]) h.run(game, count, keys);
    h.keys([]);
    assert.equal(game.finished, true);
}
function nativeSnapshot(game: GuairaRelief) {
    return structuredClone({ player: game.player.data, objects: game.objects, tiles: game.level.data.tiles,
        checkpoint: game.store.save.checkpoint, elapsed: game.elapsed, time: game.time, finished: game.finished });
}

for (const touch of [false, true]) for (const reducedMotion of [false, true]) {
    test(`optional routes use native maintenance, interval and partial head bump (${touch}/${reducedMotion})`, t => {
        const h = guairaReliefBrowser(t, { touch, reducedMotion });
        let game = create(h);
        assert.equal(game.routes.capture('other-route'), null, 'no premature challenge invitation');
        play(h, game, 'maintenance');
        assert.equal(game.routes.snapshot.verdict, 'unselected');
        const historical = game.routes.snapshot;
        assert.equal(historical.evidence.lidOpened, true);
        const action = game.routes.capture('other-route')!;
        assert.equal(action.options.routeGoal, 'keep-lid-and-helmet');
        assert.match(action.objective!, /capacete/);
        const before = nativeSnapshot(game), options = action.consume(); assert.ok(options);
        assert.deepEqual(nativeSnapshot(game), before, 'consuming does not start or modify gameplay');
        assert.equal(action.consume(), null, 'an action is single-use');
        assert.equal(game.routes.capture('other-route'), null, 'the host must complete the pending transition');
        game.dispose(); game = create(h, options);
        play(h, game, 'interval');
        assert.equal(game.routes.snapshot.verdict, 'met');
        assert.deepEqual(game.routes.snapshot.evidence, { lidOpened: false, helmetLost: false,
            died: false, reconstructed: false, arrived: true, reliefOpenAtArrival: false });
        game.render(); assert.match(h.status.textContent, /tampa e capacete conservados/);
        assert.deepEqual(game.store.save.completed, []); assert.equal(game.coins, 0);
        const maintenance = game.routes.capture('other-route')!.consume(); assert.ok(maintenance);
        assert.equal(maintenance.routeGoal, 'open-relief');
        game.dispose(); game = create(h, maintenance);
        play(h, game, 'headBump');
        assert.equal(game.routes.snapshot.verdict, 'met');
        assert.equal(game.level.getTile(17, 10), TileType.BRICK_BREAKABLE, 'the rightmost tile need not be opened');
        assert.match(reliefChallengeMessage(game.routes.snapshot)!, /alívio aberto e saída alcançada/);
        assert.equal(historical.evidence.lidOpened, true, 'old snapshots are immutable history');
        assert.ok(Object.isFrozen(historical) && Object.isFrozen(historical.evidence));
        game.dispose();
        assert.equal(game.routes.capture('retry'), null);
        assert.equal(game.routes.snapshot.evidence.arrived, false);
        assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
        assert.ok(h.contexts.every(context => context.state === 'closed'));
    });
}

for (const touch of [false, true]) {
    test(`an opening is not an arrival and defeats the intact-lid goal even without damage (${touch})`, t => {
        const h = guairaReliefBrowser(t, { touch }), game = create(h, { routeGoal: 'open-relief' });
        for (const [count, keys] of recording.maintenance.slice(0, 12) as [number, string[]][]) h.run(game, count, keys);
        h.keys([]);
        assert.equal(game.reliefOpened, true); assert.equal(game.finished, false);
        assert.equal(game.routes.snapshot.verdict, 'in-progress');
        assert.equal(game.routes.capture('other-route'), null);
        h.run(game, 180, ['ArrowRight']); h.keys([]);
        assert.equal(game.routes.snapshot.verdict, 'met'); game.dispose();
        const intact = create(h, { routeGoal: 'keep-lid-and-helmet' });
        play(h, intact, 'maintenance');
        assert.equal(intact.player.data.hasHelmet, true); assert.equal(intact.finished, true);
        assert.equal(intact.routes.snapshot.evidence.helmetLost, false);
        assert.equal(intact.routes.snapshot.verdict, 'missed'); intact.dispose();
    });

    test(`helmet-assisted arrival is valid but misses the optional goal (${touch})`, t => {
        const h = guairaReliefBrowser(t, { touch }), game = create(h, { routeGoal: 'keep-lid-and-helmet' });
        h.run(game, 300, ['ArrowRight']); h.keys([]);
        assert.equal(game.finished, true); assert.equal(game.reliefOpened, false);
        assert.equal(game.player.data.hasHelmet, false);
        assert.equal(game.routes.snapshot.evidence.helmetLost, true);
        assert.equal(game.routes.snapshot.verdict, 'missed');
        game.render(); assert.match(h.status.textContent, /PASSAGEM INSPECIONADA.*objetivo opcional não cumprido/);
        assert.doesNotMatch(h.status.textContent, /conservados|pelo intervalo/);
        const retry = game.routes.capture('retry')!;
        const oldOther = game.routes.capture('other-route')!;
        const options = retry.consume(); assert.ok(options);
        assert.equal(options.routeGoal, 'keep-lid-and-helmet'); assert.equal(oldOther.consume(), null);
        game.dispose();
        const next = create(h, options);
        assert.equal(next.routes.snapshot.verdict, 'in-progress');
        assert.equal(next.routes.snapshot.evidence.helmetLost, false);
        play(h, next, 'skipFlag');
        assert.equal(next.store.save.checkpoint, null, 'checkpoint is not a challenge prerequisite');
        assert.equal(next.routes.snapshot.verdict, 'met');
        assert.equal(retry.consume(), null); next.dispose();
    });

    test(`native death and helmet restoration cannot erase path evidence (${touch})`, t => {
        const h = guairaReliefBrowser(t, { touch }), game = create(h, { routeGoal: 'keep-lid-and-helmet' });
        h.run(game, 154, ['ArrowRight']); h.run(game, 80); h.run(game, 45, ['ArrowRight']); h.keys([]);
        const beforeDeath = game.routes.capture('retry')!, objects = game.objects;
        for (let i = 0; i < 650 && game.objects === objects; i++) h.run(game, 1);
        assert.notEqual(game.objects, objects, 'real death rebuilt at the native checkpoint');
        assert.equal(game.player.data.hasHelmet, true, 'the checkpoint restores equipment');
        assert.equal(game.routes.snapshot.evidence.helmetLost, true);
        assert.equal(game.routes.snapshot.evidence.died, true);
        assert.equal(game.routes.snapshot.evidence.reconstructed, true);
        assert.equal(game.routes.snapshot.verdict, 'missed');
        assert.equal(beforeDeath.consume(), null);
        // Continue from the actual restored checkpoint; position is only read.
        h.run(game, 60);
        for (let i = 0; i < 200 && game.player.data.position.x < 320; i++) h.run(game, 1, ['ArrowRight']);
        h.run(game, 30);
        let sawWater = false;
        for (let i = 0; i < 510; i++) {
            h.run(game, 1); const danger = game.objects.jetDanger(game.objects.get(G.jetId)!);
            sawWater ||= !!danger; if (sawWater && !danger) break;
        }
        assert.equal(sawWater, true); h.run(game, 160, ['ArrowRight']); h.keys([]);
        assert.equal(game.finished, true); assert.equal(game.player.data.hasHelmet, true);
        assert.equal(game.routes.snapshot.verdict, 'missed', 'a clean final state is insufficient');
        game.load(G.id);
        assert.equal(game.routes.snapshot.verdict, 'in-progress');
        assert.equal(game.routes.snapshot.evidence.died, false, 'only explicit fresh retry clears evidence');
        play(h, game, 'interval'); assert.equal(game.routes.snapshot.verdict, 'met'); game.dispose();
    });
}

for (const interruption of ['pause', 'blur', 'hidden', 'retry', 'dispose'] as const) {
    test(`captured replay cannot survive ${interruption} or authorize another instance`, t => {
        const h = guairaReliefBrowser(t), game = create(h);
        play(h, game, 'maintenance');
        const action = game.routes.capture('other-route')!, retry = game.routes.capture('retry')!;
        const revision = game.routes.revision;
        if (interruption === 'pause') { game.toggleReliefPause(); assert.equal(game.routes.capture('other-route'), null); game.toggleReliefPause(); }
        if (interruption === 'blur') { h.window.dispatch('blur'); assert.equal(game.routes.capture('retry'), null); h.window.dispatch('focus'); game.toggleReliefPause(); }
        if (interruption === 'hidden') { h.hidden(true); assert.equal(game.routes.capture('retry'), null); h.hidden(false); game.toggleReliefPause(); }
        if (interruption === 'retry') game.load(G.id);
        if (interruption === 'dispose') game.dispose();
        assert.ok(game.routes.revision > revision, 'host can refresh both displayed actions');
        assert.equal(action.consume(), null); assert.equal(retry.consume(), null);
        game.dispose(); const fresh = create(h);
        play(h, fresh, 'maintenance');
        assert.equal(action.consume(), null); assert.equal(retry.consume(), null);
        assert.ok(fresh.routes.capture('other-route')); fresh.dispose();
    });
}

test('a pause freezes evidence; completion and a fresh load retire earlier retry callbacks', t => {
    const h = guairaReliefBrowser(t), game = create(h, { routeGoal: 'open-relief' });
    h.run(game, 40, ['ArrowRight']); h.keys([]); game.toggleReliefPause();
    const before = game.routes.snapshot, pausedRetry = game.routes.capture('retry')!;
    h.run(game, 200); game.render(); assert.deepEqual(game.routes.snapshot, before);
    game.toggleReliefPause(); assert.equal(pausedRetry.consume(), null);
    game.load(G.id); const earlyRetry = game.routes.capture('retry')!;
    play(h, game, 'interval'); assert.equal(game.routes.snapshot.verdict, 'missed');
    assert.equal(game.finished, true); assert.equal(earlyRetry.consume(), null); game.dispose();
});

test('native simulation is identical with and without an optional goal', t => {
    const h = guairaReliefBrowser(t), ordinary = create(h);
    play(h, ordinary, 'maintenance'); const before = nativeSnapshot(ordinary); ordinary.dispose();
    const optional = create(h, { routeGoal: 'open-relief' }); play(h, optional, 'maintenance');
    assert.deepEqual(nativeSnapshot(optional), before); optional.dispose();
});

test('the room factory accepts consumed replay options without changing existing callers', async t => {
    const h = guairaReliefBrowser(t), factory = await loadGuairaInspectionRoom('relief');
    const canvas = h.canvas as unknown as HTMLCanvasElement, status = h.status as unknown as HTMLElement;
    const first = factory(canvas, status); assert.equal(first.sceneId, 'relief');
    if (first.sceneId !== 'relief') assert.fail('relief factory');
    assert.ok(first.routes); assert.equal(first.routes.snapshot.goal, null);
    assert.ok(first.game instanceof GuairaRelief); play(h, first.game, 'interval');
    const options = first.routes.capture('other-route')!.consume(); assert.ok(options);
    first.game.dispose(); const next = factory(canvas, status, options);
    assert.equal(next.sceneId, 'relief');
    if (next.sceneId !== 'relief') assert.fail('relief factory');
    assert.equal(next.routes?.snapshot.goal, 'open-relief');
    assert.ok(next.game instanceof GuairaRelief); play(h, next.game, 'maintenance');
    assert.equal(next.routes?.snapshot.verdict, 'met'); next.game.dispose();
});
