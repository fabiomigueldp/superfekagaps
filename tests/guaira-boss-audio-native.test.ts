import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GuairaBullLab } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { GuairaMayorLab } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { sceneLifecycleBrowser, type DeviceNode } from './helpers/sceneLifecycleHarness';
import bullRoute from './helpers/guairaLabReplay.json';
import mayorRoute from './helpers/guairaMayorReplay.json';

type Browser = ReturnType<typeof sceneLifecycleBrowser>;
type Scene = GuairaBullLab | GuairaMayorLab;
type Route = { stepMs: number; frames: number; runs: (number | string[])[][] };

/** Real Input, Player, model and WorldAudio; only browser/audio device boundaries are fake. */
function replay(h: Browser, game: Scene, route: Route) {
    const frames = (route.runs as Array<[number, string[]]>).flatMap(([count, keys]) => Array<string[]>(count).fill(keys));
    let frame = 0, held = new Set<string>();
    return {
        get frame() { return frame; },
        to(until = route.frames, after?: () => void) {
            while (frame < until) {
                const next = new Set(frames[frame]);
                for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
                for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
                held = next; frame++; game.update(route.stepMs); after?.();
            }
        }
    };
}
function fixture(t: TestContext, Scene: new (canvas: HTMLCanvasElement, status: HTMLElement) => Scene, route: Route, reduced = false) {
    const h = sceneLifecycleBrowser(t); h.media.matches = reduced;
    const game = h.create(Scene), run = replay(h, game, route), context = h.contexts[0];
    const cues: Array<{ frame: number; kind: string; sources: DeviceNode[] }> = [];
    const sfx = game.audio.sfx.bind(game.audio);
    t.mock.method(game.audio, 'sfx', (kind: string) => {
        const before = context.nodes.length; sfx(kind);
        cues.push({ frame: run.frame, kind, sources: context.nodes.slice(before).filter(node => node.started) });
    });
    const warnings = () => cues.filter(cue => cue.kind === 'warning');
    return { h, game, run, context, cues, warnings };
}

for (const reduced of [false, true]) for (const boss of ['bull', 'mayor'] as const)
    test(`${boss}: native warning audio matches every committed tell once (reduced motion ${reduced})`, t => {
        const route = boss === 'bull' ? bullRoute : mayorRoute;
        const { game, run, warnings } = fixture(t, boss === 'bull' ? GuairaBullLab : GuairaMayorLab, route, reduced);
        const warningFrames: number[] = [], hits: number[] = [];
        let warned = false, health = game.boss!.health;
        run.to(route.frames, () => {
            // Independent model/phase observation, not the adapter's audio getter.
            const nextWarning = game.boss!.phase === 'warning' || game instanceof GuairaMayorLab && game.mayor.counterpressure?.phase === 'warning';
            if (nextWarning && !warned) warningFrames.push(run.frame);
            warned = nextWarning;
            if (game.boss!.health < health) hits.push(run.frame);
            health = game.boss!.health;
            assert.equal(game.player.data.isDead, false); assert.equal(game.player.data.hasHelmet, true);
        });
        assert.deepEqual(warnings().map(cue => cue.frame), warningFrames);
        assert.ok(warnings().every(cue => cue.sources.length === 2 && cue.sources.every(node => node.frequency.value === 180)),
            'pending sample fetches use the real two-tone warning fallback');
        if (game instanceof GuairaMayorLab) {
            assert.deepEqual(warningFrames, [102, 402, 502, 732, 832]);
            assert.deepEqual(hits, [322, 652, 982]); assert.equal(game.mayor.publicWaterOpen, true);
        } else {
            assert.equal(warningFrames.length, 6);
            assert.deepEqual(hits, bullRoute.expectedHits.map(hit => hit.frame + 1));
            assert.equal(game.boss!.phase, 'defeated');
        }
        assert.deepEqual(game.store.save.completed, []); assert.deepEqual(game.store.save.times, {});
    });

for (const mode of ['mute', 'effects-off'] as const)
    test(`mayor: ${mode} drops the seam warning and restoring audio never plays it late`, t => {
        const { h, game, run, context, warnings } = fixture(t, GuairaMayorLab, mayorRoute);
        run.to(501);
        if (mode === 'mute') { h.key('keydown', 'm'); h.key('keyup', 'm'); }
        else { game.audio.preferences.effects = 0; game.audio.volume(); }
        run.to(502);
        assert.equal((game as GuairaMayorLab).mayor.counterpressure?.phase, 'warning');
        assert.equal(warnings().at(-1)!.frame, 502); assert.deepEqual(warnings().at(-1)!.sources, []);
        const count = context.nodes.filter(node => node.started).length;
        if (mode === 'mute') { h.key('keydown', 'm'); h.key('keyup', 'm'); }
        else { game.audio.preferences.effects = .6; game.audio.volume(); }
        run.to(503);
        assert.equal(context.nodes.filter(node => node.started).length, count);
        assert.deepEqual(warnings().map(cue => cue.frame), [102, 402, 502]);
    });

test('mayor: pause, blur, hidden and repeated rendering cancel or freeze the seam cue without replay', t => {
    const { h, game, run, context, warnings } = fixture(t, GuairaMayorLab, mayorRoute);
    run.to(502); const cue = warnings().at(-1)!;
    assert.equal(cue.frame, 502); assert.equal(cue.sources.length, 2);
    const sharedBoss = t.mock.method(game.art, 'boss');
    const sharedArena = t.mock.method(game.art, 'arena');
    const before = structuredClone({ model: (game as GuairaMayorLab).mayor, player: game.player.data, objects: game.objects });
    const count = context.nodes.filter(node => node.started).length;
    for (const pause of [() => game.toggleLabPause(), () => h.window.dispatch('blur'),
        () => { h.document.hidden = true; h.document.dispatch('visibilitychange'); }]) {
        pause(); assert.equal(game.state, 'paused'); assert.equal(context.state, 'suspended');
        assert.ok(cue.sources.every(node => node.stopped && node.disconnected));
        for (let index = 0; index < 5; index++) { game.update(mayorRoute.stepMs); game.render(); }
        assert.deepEqual(structuredClone({ model: (game as GuairaMayorLab).mayor, player: game.player.data, objects: game.objects }), before);
        h.document.hidden = false; game.toggleLabPause(); game.render();
        assert.equal(context.nodes.filter(node => node.started).length, count);
    }
    assert.equal(sharedBoss.mock.callCount(), 0, 'the audio getter cannot paint native ground-wave arrows');
    assert.equal(sharedArena.mock.callCount(), 0);
    assert.deepEqual(warnings().map(cue => cue.frame), [102, 402, 502]);
    game.update(mayorRoute.stepMs);
    assert.deepEqual(warnings().map(cue => cue.frame), [102, 402, 502]);
    assert.equal(context.nodes.filter(node => node.started).length, count);
});

for (const boundary of ['retry', 'paused-retry', 'dispose', 'mute'] as const)
    test(`mayor: ${boundary} cancels the live seam warning sources`, t => {
        const { h, game, run, context, warnings } = fixture(t, GuairaMayorLab, mayorRoute);
        run.to(502); const cue = warnings().at(-1)!;
        assert.equal(cue.frame, 502); assert.equal(cue.sources.length, 2);
        if (boundary === 'retry' || boundary === 'paused-retry') {
            if (boundary === 'paused-retry') game.toggleLabPause();
            game.load(game.stage.id);
        }
        else if (boundary === 'dispose') game.dispose();
        else { h.key('keydown', 'm'); h.key('keyup', 'm'); game.update(mayorRoute.stepMs); }
        assert.ok(cue.sources.every(node => node.stopped && node.disconnected));
        const count = warnings().length;
        if (boundary === 'retry' || boundary === 'paused-retry') {
            const mayor = game as GuairaMayorLab;
            assert.equal(mayor.mayor.counterpressure, null); assert.equal(mayor.boss!.shockWarning, false);
            const retried = replay(h, game, mayorRoute);
            retried.to(101); assert.equal(warnings().length, count);
            retried.to(102); assert.equal(warnings().length, count + 1);
            assert.equal(mayor.mayor.counterpressure, null, 'the first seal keeps its original teaching cycle');
            assert.equal(mayor.boss!.phase, 'warning');
        } else {
            const sources = context.nodes.filter(node => node.started).length;
            for (let index = 0; index < 5; index++) game.update(mayorRoute.stepMs);
            assert.equal(warnings().length, count);
            assert.equal(context.nodes.filter(node => node.started).length, sources);
        }
    });

for (const boundary of ['pause', 'retry', 'mute', 'dispose'] as const)
    test(`mayor: a prepared warning sample uses the same ${boundary} cancellation path`, async t => {
        const { game, run, h, context, warnings } = fixture(t, GuairaMayorLab, mayorRoute);
        // Exercise real sample selection/scheduling with decoded bytes represented
        // by a device-boundary buffer. This is not a listening or codec test.
        Object.assign(context, { decodeAudioData: async () => ({ duration: .3, sampleRate: 100 }) });
        run.to(1);
        for (const request of h.requests) request.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
        for (let index = 0; index < 8; index++) await Promise.resolve();
        run.to(502);
        const cue = warnings().at(-1)!;
        assert.equal(cue.frame, 502); assert.equal(cue.sources.length, 1); assert.ok(cue.sources[0].buffer);
        if (boundary === 'pause') game.toggleLabPause();
        if (boundary === 'retry') game.load(game.stage.id);
        if (boundary === 'mute') { h.key('keydown', 'm'); h.key('keyup', 'm'); game.update(mayorRoute.stepMs); }
        if (boundary === 'dispose') game.dispose();
        assert.ok(cue.sources.every(node => node.stopped && node.disconnected));
        if (boundary === 'pause') game.toggleLabPause();
        if (boundary === 'mute') { h.key('keydown', 'm'); h.key('keyup', 'm'); game.update(mayorRoute.stepMs); }
        const count = warnings().length;
        for (let index = 0; index < 5; index++) game.update(mayorRoute.stepMs);
        assert.equal(warnings().length, count, 'no stale warning is emitted after the boundary');
    });
