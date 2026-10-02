import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import galleryRecording from './helpers/guairaGalleryReplay.json';
import reliefRecordings from './helpers/guairaReliefReplay.json';
import { galleryPageBrowser, flushGalleryPage, invokeSaved } from './helpers/guairaGalleryPageHarness';
import type { LifecycleElement } from './helpers/sceneLifecycleHarness';

const callbacks = (node: LifecycleElement) => node.listeners.filter(item => item.type === 'click').map(item => item.callback);

test('native Relief completion, pause/resume, focus and replacement retire both displayed replay actions and held gestures', async t => {
    const h = await galleryPageBrowser(t); await h.boot();
    h.play(h.activeGame()!, { runs: galleryRecording.runs as Array<[number, string[]]> }); h.reflect();
    h.primary.click(); await flushGalleryPage();
    const first = h.activeGame(); assert.ok(first instanceof GuairaRelief);
    const earlyRetry = callbacks(h.retry);
    h.primary.dispatch('pointerdown', { pointerId: 8 });
    h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.primary });
    h.play(first, { runs: reliefRecordings.maintenance as Array<[number, string[]]> }); h.reflect();
    earlyRetry.forEach(invokeSaved);
    h.primary.dispatch('click', { detail: 1 }); h.primary.click();
    assert.equal(h.activeGame(), first, 'A gesture begun on PAUSA cannot become OUTRA ROTA');
    for (const interruption of ['pause', 'blur', 'hidden'] as const) {
        const old = [...callbacks(h.primary), ...callbacks(h.retry)];
        if (interruption === 'pause') { first.toggleReliefPause(); first.toggleReliefPause(); }
        if (interruption === 'blur') { h.window.dispatch('blur'); old.forEach(invokeSaved); h.window.dispatch('focus'); }
        if (interruption === 'hidden') {
            h.document.hidden = true; h.document.dispatch('visibilitychange'); old.forEach(invokeSaved);
            h.document.hidden = false; h.document.dispatch('visibilitychange');
        }
        old.forEach(invokeSaved); h.reflect();
        if (first.state === 'paused') h.primary.click();
        h.reflect(); old.forEach(invokeSaved);
        assert.equal(h.activeGame(), first, `${interruption} invalidates captured replay callbacks`);
    }
    h.primary.click(); await flushGalleryPage();
    const second = h.activeGame(); assert.ok(second instanceof GuairaRelief);
    assert.equal(second.routes.snapshot.goal, 'keep-lid-and-helmet');
    const old = [...callbacks(h.primary), ...callbacks(h.retry)];
    h.primary.dispatch('pointerdown', { pointerId: 8 }); h.retry.dispatch('pointerdown', { pointerId: 9 });
    h.retry.click(); await flushGalleryPage();
    const third = h.activeGame(); assert.ok(third instanceof GuairaRelief);
    assert.equal(third.routes.snapshot.goal, 'keep-lid-and-helmet');
    h.primary.dispatch('click', { detail: 1 }); h.retry.dispatch('click', { detail: 1 }); old.forEach(invokeSaved);
    assert.equal(h.activeGame(), third); assert.equal(third.state, 'playing');
    const disposed = [...callbacks(h.primary), ...callbacks(h.retry)];
    h.window.dispatch('pagehide'); disposed.forEach(invokeSaved); h.checkDisposed();
});
