import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaQueryHarness, TestMediaQueryListEvent } from './helpers/mediaQueryHarness';
import { DisposalScope } from '../src/engine/DisposalScope';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const motion = '(prefers-reduced-motion: reduce)', pointer = '(pointer: coarse)', anyPointer = '(any-pointer: coarse)';

test('queries and repeated lists have independent identity and live, readonly matches/media', () => {
    const h = createMediaQueryHarness({ [pointer]: true });
    const first = h.matchMedia(motion), second = h.matchMedia(motion), coarse = h.matchMedia(pointer), any = h.matchMedia(anyPointer);
    assert.notEqual(first, second); assert.notEqual(coarse, any);
    assert.deepEqual([first.matches, second.matches, coarse.matches, any.matches], [false, false, true, false]);
    assert.equal(h.matchMedia('(pointer:coarse)').media, pointer);
    assert.equal(Reflect.set(first, 'matches', true), false); assert.equal(Reflect.set(first, 'media', pointer), false);
    const events: boolean[] = [];
    first.addEventListener('change', function (this: EventTarget, event) {
        assert.ok(event instanceof TestMediaQueryListEvent); assert.equal(event.media, motion);
        assert.equal(event.target, first); assert.equal(event.currentTarget, first); assert.equal(this, first);
        assert.equal(second.matches, event.matches); assert.equal(event.bubbles, false); assert.equal(event.cancelable, false);
        events.push(event.matches);
    });
    h.set(motion, true); h.set(motion, true); h.set(motion, false);
    assert.deepEqual(events, [true, false]); assert.equal(coarse.matches, true); assert.equal(any.matches, false);
    h.dispose();
});

test('modern and legacy listeners share identity; onchange replacement retains its order', () => {
    const h = createMediaQueryHarness(), list = h.matchMedia(motion), calls: string[] = [];
    const callback = () => calls.push('shared');
    list.addListener(callback); list.addEventListener('change', callback);
    list.onchange = () => calls.push('old'); list.addListener(() => calls.push('last'));
    list.onchange = () => calls.push('property');
    h.set(motion, true); assert.deepEqual(calls, ['shared', 'property', 'last']);
    list.removeEventListener('change', callback); list.onchange = null; calls.length = 0;
    h.set(motion, false); assert.deepEqual(calls, ['last']);
    h.dispose(); assert.equal(h.listenerCount(), 0);
});

test('capture identity, once, listener objects and abort cleanup follow EventTarget rules', () => {
    const h = createMediaQueryHarness(), list = h.matchMedia(motion), abort = new AbortController();
    let calls = 0; const callback = () => calls++, listener = { handleEvent: callback };
    list.addEventListener('change', callback, true); list.removeEventListener('change', callback, false);
    list.addEventListener('change', listener, { once: true });
    list.addEventListener('change', () => calls += 100, { signal: abort.signal }); abort.abort();
    h.set(motion, true); h.set(motion, false); assert.equal(calls, 3);
    assert.equal(h.listenerCount(), 1); list.removeEventListener('change', callback, true);
    h.set(motion, true); assert.equal(calls, 3); assert.equal(h.listenerCount(), 0); h.dispose();
});

test('legacy-only consumers update and remove listeners without requiring modern methods', () => {
    const h = createMediaQueryHarness({}, true), list = h.matchMedia(motion); let calls = 0;
    assert.equal(typeof list.addEventListener, 'undefined'); assert.equal(typeof list.removeEventListener, 'undefined');
    const callback = () => calls++; list.addListener(callback); h.set(motion, true);
    list.removeListener(callback); h.set(motion, false); assert.equal(calls, 1);
    assert.equal(h.listenerCount(), 0); h.dispose();
});

test('real DisposalScope removes media subscriptions and disposed fixtures cannot emit stale callbacks', () => {
    const h = createMediaQueryHarness(), list = h.matchMedia(motion), scope = new DisposalScope(); let calls = 0;
    scope.listen(list, 'change', () => calls++); h.set(motion, true); assert.equal(calls, 1);
    scope.dispose(); h.set(motion, false); assert.equal(calls, 1); assert.equal(h.listenerCount(), 0);
    list.onchange = () => calls++; h.dispose(); h.set(motion, true); list.notify();
    assert.equal(calls, 1); assert.throws(() => h.matchMedia(motion), /disposed/);
    const fresh = createMediaQueryHarness(); assert.equal(fresh.matchMedia(motion).matches, false); fresh.dispose();
});

test('scene lifecycle fixtures separate reduced motion from pointer queries and count actual subscriptions', t => {
    const h = sceneLifecycleBrowser(t), first = matchMedia(motion), second = h.window.matchMedia(motion);
    const coarse = matchMedia(pointer), any = matchMedia(anyPointer), before = h.listenerCount();
    assert.notEqual(first, second); assert.equal(first.media, motion);
    let calls = 0; const callback = () => calls++;
    first.addEventListener('change', callback); second.addListener(callback);
    assert.equal(h.listenerCount(), before + 2);
    h.media.matches = true; assert.equal(first.matches, true); assert.equal(second.matches, true);
    assert.equal(coarse.matches, false); assert.equal(any.matches, false); assert.equal(calls, 0);
    h.media.dispatch('change'); assert.equal(calls, 2);
    first.removeEventListener('change', callback); second.removeListener(callback);
    assert.equal(h.listenerCount(), before);
    h.mediaQueries.set(pointer, true); assert.equal(coarse.matches, true); assert.equal(any.matches, false);
});

test('real renderer and touch controls read separate live preferences and dispose their subscriptions', async t => {
    const disposables: { dispose(): void }[] = [];
    t.after(() => { for (const item of disposables.reverse()) item.dispose(); });
    const h = sceneLifecycleBrowser(t);
    // Browser globals must exist before TouchMode evaluates its module-level listeners.
    const [{ Renderer }, { Input }, { GuairaTouchControls }] = await Promise.all([
        import('../src/engine/Renderer'), import('../src/engine/Input'),
        import('../src/adventure/experimental/guaira/GuairaTouchControls'),
    ]);
    const canvas = h.canvas as unknown as HTMLCanvasElement, renderer = new Renderer(canvas); disposables.push(renderer);
    const input = new Input(canvas); disposables.push(input);
    const controls = new GuairaTouchControls({ input, isPlaying: () => true, onInteract() {} });
    disposables.push(controls);
    assert.equal(renderer.reducedMotion, false); assert.equal(controls.visible, false);
    assert.equal(h.mediaQueries.listenerCount(anyPointer), 1);
    h.mediaQueries.set(motion, true);
    assert.equal(renderer.reducedMotion, true); assert.equal(controls.visible, false);
    h.window.dispatch('pointerdown', { pointerType: 'touch' }); h.mediaQueries.set(anyPointer, true);
    assert.equal(controls.visible, true);
    h.window.dispatch('keydown', { key: 'a', code: 'KeyA' }); h.mediaQueries.set(anyPointer, false);
    assert.equal(controls.visible, false);
    h.mediaQueries.set(motion, false); assert.equal(renderer.reducedMotion, false);
    controls.dispose(); assert.equal(h.mediaQueries.listenerCount(anyPointer), 0);
    h.mediaQueries.set(anyPointer, true); assert.equal(controls.visible, false);
});
