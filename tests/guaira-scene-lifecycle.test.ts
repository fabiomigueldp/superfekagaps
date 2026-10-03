import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { WorldAudio } from '../src/adventure/WorldAudio';
import { WorldMapView } from '../src/adventure/WorldMapView';
import { Input } from '../src/engine/Input';
import { DisposalScope } from '../src/engine/DisposalScope';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { GuairaBullLab } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { GuairaAscent } from '../src/adventure/experimental/guaira/GuairaAscent';
import { GuairaMayorLab } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { GuairaTouchControls } from '../src/adventure/experimental/guaira/GuairaTouchControls';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

const scenes: Array<new (canvas: HTMLCanvasElement, status: HTMLElement) => WorldGame> = [GuairaTraversal, GuairaRespiros, GuairaBullLab, GuairaAscent, GuairaMayorLab, GuairaJunction];
function result(game: WorldGame) {
    return { finished: 'finished' in game ? game.finished : undefined,
        boss: game.boss?.phase, water: game instanceof GuairaMayorLab ? game.mayor.publicWaterOpen : undefined };
}

test('all six real adapters mount and discard twice with one live runtime and no stale activity', t => {
    const h = sceneLifecycleBrowser(t);
    for (let pass = 0; pass < 2; pass++) for (const Scene of scenes) {
        const game = h.create(Scene);
        assert.equal(h.listenerCount(), 16, `${Scene.name}: exact scene-owned listeners`);
        assert.equal(h.window.listeners.filter(listener => listener.type === 'pagehide').length, 1);
        assert.equal(h.window.listeners.filter(listener => listener.type === 'orientationchange').length, 1);
        const controls = new GuairaTouchControls({ input: game.input,
            isPlaying: () => !game.isDisposed && game.state === 'playing', onInteract: () => game.audio.unlock() });
        game.addCleanup(() => controls.dispose());
        const observer = new ResizeObserver(() => {}); observer.observe(controls.root);
        game.addCleanup(() => observer.disconnect());
        game.start(); game.start();
        assert.equal(h.frames.size, 1, `${Scene.name}: start does not fork the clock`);
        assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 1);
        const startX = game.player.data.position.x;
        h.key('keydown', 'ArrowRight');
        h.frame(performance.now() + 40); h.key('keyup', 'ArrowRight');
        assert.ok(game.player.data.position.x > startX, `${Scene.name}: fresh real Player responds`);
        assert.ok(h.canvas.drawCalls > 0);
        assert.equal(h.frames.size, 1);
        const button = (controls.root as unknown as LifecycleElement).children[1];
        button.dispatch('pointerdown', { button: 0, pointerId: 17 });
        assert.ok(button.hasPointerCapture(17));
        const staleFrames = [...h.frames.values()];
        const oldSource = game.input.createActionSource(); oldSource.press('jump');
        game.audio.sfx('jet'); game.audio.say('joao', 'A late clip', 'porra_nenhuma');
        const context = h.contexts.at(-1)!;
        assert.ok(context.nodes.some(node => node.started && !node.stopped));
        const beforeResult = result(game), time = game.time;
        game.dispose(); game.dispose(); game.start();
        assert.equal(game.isDisposed, true);
        assert.equal(game.input.isDisposed, true); assert.equal(game.renderer.isDisposed, true);
        assert.equal(game.audio.isDisposed, true);
        assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
        assert.equal(button.hasPointerCapture(17), false);
        assert.ok(h.observers.at(-1)?.disconnected);
        assert.equal((controls.root as unknown as LifecycleElement).parent, null);
        assert.equal(context.closeCalls, 1);
        assert.ok(context.nodes.every(node => node.disconnected));
        assert.ok(context.nodes.filter(node => node.started).every(node => node.stopped));
        assert.equal(h.window.worldGame, undefined); assert.equal(h.window.renderer, undefined);
        const draws = h.drawCount(), nodeCount = context.nodes.length;
        h.key('keydown', 'ArrowRight'); h.key('keydown', ' ');
        h.canvas.dispatch('pointerdown', { clientX: 320, clientY: 10 });
        h.window.dispatch('resize'); h.window.dispatch('blur');
        h.document.hidden = true; h.document.dispatch('visibilitychange'); h.document.hidden = false;
        button.dispatch('pointerdown', { button: 0, pointerId: 18 });
        for (const callback of staleFrames) callback(performance.now() + 200);
        oldSource.press('down'); oldSource.release();
        game.input.createActionSource().press('run'); game.input.update();
        game.update(1000); game.render(); game.load(game.stage.id);
        game.audio.unlock(); game.audio.pause(false); game.audio.sfx('victory'); game.audio.tick(1000);
        assert.equal(game.time, time); assert.deepEqual(result(game), beforeResult);
        assert.ok(Object.values(game.input.getState()).every(value => value === false));
        assert.equal(h.drawCount(), draws, `${Scene.name}: discarded scene paints nothing`);
        assert.equal(context.nodes.length, nodeCount); assert.equal(h.frames.size, 0);
        assert.deepEqual(game.store.save.completed, []);
    }
});

test('blur/hidden release gestures; disposal never clears a newer scene reference or audio', t => {
    const h = sceneLifecycleBrowser(t), old = h.create(GuairaTraversal);
    h.key('keydown', 'ArrowRight'); old.input.update(); assert.equal(old.input.getState().right, true);
    h.window.dispatch('blur'); assert.equal(old.state, 'paused'); assert.equal(old.input.getState().right, false);
    h.key('keydown', 'Escape'); h.key('keyup', 'Escape'); assert.equal(old.state, 'playing');
    const source = old.input.createActionSource(); source.press('jump');
    h.document.hidden = true; h.document.dispatch('visibilitychange');
    assert.equal(old.state, 'paused'); assert.equal(old.input.getState().jump, false);
    h.document.hidden = false;
    const fresh = h.create(GuairaRespiros), freshContext = h.contexts.at(-1)!;
    old.dispose();
    assert.equal(h.window.worldGame, fresh); assert.equal(h.window.renderer, fresh.renderer);
    assert.notEqual(freshContext.state, 'closed'); assert.equal(h.listenerCount(), 16);
    fresh.start(); h.frame(); assert.equal(h.frames.size, 1);
    fresh.dispose(); assert.equal(h.listenerCount(), 0);
});

test('partial adapter construction and disposal from inside a frame release every acquired resource', t => {
    const h = sceneLifecycleBrowser(t);
    class BrokenTraversal extends GuairaTraversal { override load(): void { throw Error('Stage setup failed'); } }
    assert.throws(() => h.create(BrokenTraversal), /Stage setup failed/);
    assert.equal(h.listenerCount(), 0); assert.equal(h.window.worldGame, undefined); assert.equal(h.frames.size, 0);
    class SelfDisposing extends GuairaTraversal { override update(): void { this.dispose(); } }
    const game = h.create(SelfDisposing), beforeDraws = h.drawCount(); game.start(); h.frame(performance.now() + 100);
    assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0); assert.equal(h.drawCount(), beforeDraws);
    const fresh = h.create(GuairaBullLab); fresh.start(); h.frame(); assert.ok(h.drawCount() > 0); fresh.dispose();
});

test('all six adapters roll back base resources if media-query setup throws', t => {
    const h = sceneLifecycleBrowser(t);
    const media = t.mock.method(globalThis, 'matchMedia', () => { throw Error('Media API unavailable'); });
    for (const Scene of scenes) {
        assert.throws(() => h.create(Scene), /Media API unavailable/);
        assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
        assert.equal(h.window.worldGame, undefined); assert.equal(h.window.renderer, undefined);
    }
    media.mock.restore();
    const fresh = h.create(GuairaAscent); fresh.start(); h.frame();
    assert.ok(h.canvas.drawCalls > 0); fresh.dispose();
});

test('Input cancels partial canvas attachment and invalidates saved touch sources and queued listeners', t => {
    const h = sceneLifecycleBrowser(t);
    h.document.getElementById = () => null;
    const input = new Input(); assert.equal(h.frames.size, 1);
    const callback = [...h.frames.values()][0], queuedListener = h.window.listeners.find(entry => entry.type === 'keydown')!.callback;
    const source = input.createActionSource(); source.press('jump');
    input.dispose(); input.dispose(); assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
    h.document.getElementById = () => h.canvas;
    callback(1000);
    const event = new Event('keydown'); Object.assign(event, { key: 'ArrowRight', code: 'ArrowRight' });
    if (typeof queuedListener === 'function') queuedListener(event);
    source.press('down'); source.release(); input.update();
    assert.ok(Object.values(input.getState()).every(value => value === false));
    assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
});

test('Input invalidates sources before reset callbacks and isolates a failing notification', t => {
    const h = sceneLifecycleBrowser(t), input = new Input();
    const warning = t.mock.method(console, 'warn', () => {});
    let notified = 0;
    const rearm = input.createActionSource(() => { rearm.press('right'); throw Error('Faulty control cleanup'); });
    const other = input.createActionSource(() => { notified++; other.press('jump'); });
    rearm.press('run'); other.press('down');
    assert.doesNotThrow(() => input.dispose());
    assert.equal(notified, 1); assert.equal(warning.mock.callCount(), 1);
    rearm.press('run'); other.press('jump'); input.update();
    assert.ok(Object.values(input.getState()).every(value => value === false));
    assert.equal(h.listenerCount(), 0);
    input.dispose(); assert.equal(notified, 1);
});

test('WorldAudio rejects late playback failures and recovers cleanly from partial device initialization', async t => {
    const h = sceneLifecycleBrowser(t), audio = new WorldAudio({ music: .5, effects: .5, voice: .5, shake: true });
    h.failGain(2); audio.unlock();
    const partial = h.contexts[0]; assert.equal(partial.closeCalls, 1); assert.ok(partial.nodes.every(node => node.disconnected));
    assert.equal(audio.getEffectsRoute(), null);
    h.failGain(0); audio.unlock();
    audio.say('joao', 'Old speech', 'porra_nenhuma'); const oldClip = h.clips[0];
    audio.say('feka', 'Current speech'); oldClip.reject(Error('late load')); await Promise.resolve();
    assert.equal((audio as unknown as { speaking: { text: string } }).speaking.text, 'Current speech');
    audio.say('joao', 'Disposed speech', 'porra_nenhuma'); const disposedClip = h.clips[1];
    audio.dispose(); audio.dispose(); disposedClip.reject(Error('after disposal')); await Promise.resolve();
    assert.equal((audio as unknown as { speaking: unknown }).speaking, null);
    assert.equal(disposedClip.pauses, 1); assert.equal(disposedClip.src, ''); assert.equal(disposedClip.loads, 1);
    assert.equal(h.contexts[1].closeCalls, 1);
    audio.unlock(); audio.say('feka', 'No new speech'); assert.equal(h.contexts.length, 2); assert.equal(h.clips.length, 2);
});

test('WorldGame releases the actual map surface, observer and late assets, and accepts subclass cleanup once', async t => {
    const h = sceneLifecycleBrowser(t), game = h.create(GuairaTraversal);
    const map = new WorldMapView(h.canvas as unknown as HTMLCanvasElement, { select() {}, enter() {}, exit() {}, unlockAudio() {} });
    Object.assign(game, { mapView: map });
    assert.ok(h.body.children.some(child => child.classList.contains('world-map')));
    map.render(0, game.store.save, 0, '', '');
    assert.ok(h.requests.length > 0);
    const lateImages = h.images.map(image => image.onload).filter(callback => callback !== null);
    let released = 0; const release = game.addCleanup(() => released++);
    game.dispose(); release(); game.dispose();
    const draws = h.drawCount();
    assert.ok(h.requests.every(request => request.signal?.aborted));
    for (const request of h.requests) request.resolve({ ok: false });
    for (const callback of lateImages) callback();
    await Promise.resolve(); await Promise.resolve();
    map.render(0, game.store.save, 100, '', '');
    assert.equal(h.drawCount(), draws);
    assert.equal(released, 1); assert.ok(h.observers[0].disconnected);
    assert.equal(h.body.children.some(child => child.classList.contains('world-map')), false);
    assert.equal(h.window.listeners.length, 0); assert.equal(h.document.listeners.length, 0); assert.equal(h.media.listeners.length, 0);
    game.addCleanup(() => released++); assert.equal(released, 2, 'Late ownership is immediately released');
});

test('disposal registry suppresses a queued listener even when an event was already selected', () => {
    const target = new EventTarget(), scope = new DisposalScope(); let calls = 0;
    target.addEventListener('leave', () => scope.dispose());
    scope.listen(target, 'leave', () => calls++);
    target.dispatchEvent(new Event('leave')); assert.equal(calls, 0);
});
