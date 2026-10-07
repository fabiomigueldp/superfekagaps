import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaTouchControls } from '../src/adventure/experimental/guaira/GuairaTouchControls';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

for (const entry of ['guaira-lab', 'guaira-travessia', 'guaira-subida', 'guaira-prefeito', 'guaira-patio', 'guaira-respiros']) {
    test(`${entry}: repeated page owners release native and toolbar resources`, async t => {
        const h = sceneLifecycleBrowser(t);
        const visibilityCallbacks: Array<(visible: boolean) => void> = [];
        const sync = GuairaTouchControls.prototype.sync;
        t.mock.method(GuairaTouchControls.prototype, 'sync', function (this: GuairaTouchControls) {
            const callback = (this as unknown as { options: { onVisibilityChange: (visible: boolean) => void } }).options.onVisibilityChange;
            if (!visibilityCallbacks.includes(callback)) visibilityCallbacks.push(callback);
            sync.call(this);
        });
        for (const [name, value] of Object.entries({ innerWidth: 640, innerHeight: 440 })) {
            const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
            Object.defineProperty(globalThis, name, { configurable: true, value });
            t.after(() => { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); });
        }
        const all = () => {
            const walk = (node: typeof h.body): typeof h.body[] => [node, ...node.children.flatMap(walk)];
            return walk(h.body);
        };
        h.document.getElementById = id => all().find(node => node.id === id) ?? null;
        const nav = h.document.createElement('nav');
        Object.assign(h.document, { querySelector: () => nav });
        h.status.id = 'lab-status';
        for (const id of ['lab-pause', 'lab-retry', 'lab-exit', 'lab-ascent', 'traversal-boss', 'junction-boss', 'respiros-boss']) {
            const button = h.document.createElement('button'); button.id = id; nav.append(button);
        }
        h.body.append(nav);
        for (let visit = 0; visit < 2; visit++) {
            await import(`../src/${entry}.ts?visit=${visit}`);
            const game = h.window.worldGame!;
            assert.ok(game);
            assert.equal(h.frames.size, 2, 'One native and one toolbar frame');
            const initialListeners = h.listenerCount();
            const retiredTouchLayout = h.observers.find(observer => observer.targets.some(target => (target as { id?: string }).id === 'guaira-touch-controls'))!.callback;
            const retiredVisibility = visibilityCallbacks.at(-1)!;
            h.window.dispatch('pagehide', { persisted: true });
            assert.equal(game.isDisposed, false, 'BFCache keeps the reusable native instance');
            h.window.dispatch('pageshow', { persisted: true });
            assert.equal(h.window.worldGame, game);
            assert.equal(h.listenerCount(), initialListeners, 'BFCache restores exactly one input host');
            h.body.style.paddingTop = '19px'; h.canvas.style.width = '323px';
            const touchVisibility = t.mock.method(game.renderer, 'setTouchControlsVisible');
            retiredTouchLayout(); retiredVisibility(false); retiredVisibility(true);
            assert.equal(h.body.style.paddingTop, '19px', 'Retired BFCache touch mount cannot relayout its successor');
            assert.equal(h.canvas.style.width, '323px');
            assert.equal(touchVisibility.mock.callCount(), 0, 'Retired touch mount cannot change renderer visibility');
            visibilityCallbacks.at(-1)!(true);
            assert.equal(touchVisibility.mock.callCount(), 1, 'Current BFCache mount retains live visibility updates');
            assert.notEqual(h.body.style.paddingTop, '19px');
            const callbacks = [...h.frames.values()];
            const oldRetry = h.document.getElementById('lab-retry')!.listeners.find(listener => listener.type === 'click')!.callback;
            const oldLayouts = h.observers.map(observer => observer.callback);
            if (visit === 0) game.dispose();
            else h.window.dispatch('pagehide', { persisted: false });
            assert.equal(game.isDisposed, true);
            assert.equal(h.frames.size, 0, 'No toolbar RAF survives terminal disposal');
            assert.equal(h.listenerCount(), 0, 'No page, native or touch listeners survive');
            assert.ok(h.observers.every(observer => observer.disconnected));
            assert.equal(all().filter(node => node.id === 'guaira-touch-controls').length, 0);
            assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0);
            const draws = h.drawCount();
            h.body.style.paddingTop = '17px';
            h.canvas.style.width = '321px';
            callbacks.forEach(callback => callback(performance.now()));
            if (typeof oldRetry === 'function') oldRetry(new Event('click')); else oldRetry.handleEvent(new Event('click'));
            oldLayouts.forEach(callback => callback());
            const visibilityCalls = touchVisibility.mock.callCount();
            visibilityCallbacks.forEach(callback => { callback(false); callback(true); });
            assert.equal(touchVisibility.mock.callCount(), visibilityCalls, 'Late touch visibility leaves the renderer alone');
            assert.equal(h.body.style.paddingTop, '17px', 'Late page layout leaves the next owner alone');
            assert.equal(h.canvas.style.width, '321px');
            h.window.dispatch('pageshow', { persisted: true });
            h.window.dispatch('resize'); h.document.getElementById('lab-retry')!.click();
            assert.equal(h.frames.size, 0, 'Late callbacks do not restart either loop');
            assert.equal(h.listenerCount(), 0, 'Late callbacks do not reinstall input hosts');
            assert.equal(h.drawCount(), draws, 'Retired toolbar callbacks do not paint');
        }
    });
}
