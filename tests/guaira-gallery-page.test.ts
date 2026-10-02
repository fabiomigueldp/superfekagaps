import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import type { GuairaInspectionRoomFactory } from '../src/adventure/experimental/guaira/GuairaInspectionRooms';
import { galleryPageBrowser, flushGalleryPage, savedClick, invokeSaved, deferred } from './helpers/guairaGalleryPageHarness';
import { LifecycleElement } from './helpers/sceneLifecycleHarness';

type Harness = Awaited<ReturnType<typeof galleryPageBrowser>>;
const reliefName = 'Seguir para a Câmara de Alívio, continuação opcional';
/** Ownership-only fixture. Native victory is proven separately without state writes. */
function finishFixture(h: Harness) {
    const game = h.activeGame(); assert.ok(game instanceof GuairaGallery);
    game.finished = true; h.reflect(); assert.equal(h.primary.getAttribute('aria-label'), reliefName); return game;
}

test('free page owns exactly three 44px toolbar actions and native pause/retry/ordinary Bairro exit', async t => {
    const h = await galleryPageBrowser(t); await h.boot(); const first = h.activeGame()!;
    assert.ok(first instanceof GuairaGallery); assert.equal(h.frames.size, 2);
    const listeners = h.listenerCount();
    h.primary.click(); assert.equal(first.state, 'paused'); assert.equal(h.primary.getAttribute('aria-label'), 'Continuar a tentativa');
    h.primary.click(); assert.equal(first.state, 'playing');
    h.key('keydown', 'ArrowRight'); first.input.update(); assert.equal(first.input.getState().right, true);
    h.retry.click(); assert.equal(first.isDisposed, true); assert.equal(first.input.isDisposed, true); assert.equal(first.audio.isDisposed, true);
    await flushGalleryPage(); const second = h.activeGame()!;
    assert.ok(second instanceof GuairaGallery); assert.equal(second.finished, false); assert.equal(second.input.getState().right, false);
    h.retry.click(); await flushGalleryPage(); assert.equal(h.games.length, 3); assert.equal(h.listenerCount(), listeners); assert.equal(h.frames.size, 2);
    assert.equal(h.nav.children.filter(n => n.tagName === 'BUTTON' || n.tagName === 'A').length, 3);
    const html = readFileSync(new URL('../guaira-galeria.html', import.meta.url), 'utf8');
    assert.match(html, /min-height:44px;min-width:44px/); assert.match(html, /aria-live="polite" aria-atomic="true"/);
    for (const node of [h.primary, h.retry, h.map]) assert.equal(node.children.filter(n => n.className === 'lab-action-art').length, 1);
    assert.equal(h.mapHref(), './guaira.html?at=bairro');
    assert.equal(h.map.dispatch('click', { detail: 1, ctrlKey: true }).defaultPrevented, false, 'Ordinary link navigation stays native');
});

test('Gallery requires a living finish and fresh explicit primary; held pointer and Space cannot become ALÍVIO', async t => {
    const h = await galleryPageBrowser(t);
    await h.boot(async id => {
        if (id === 'relief') {
            assert.equal(h.games[0].isDisposed, true); assert.equal(h.games[0].input.isDisposed, true); assert.equal(h.games[0].audio.isDisposed, true);
            assert.equal(h.frames.size, 0); assert.ok(h.observers.every(o => o.disconnected));
            assert.equal(h.all().filter(n => n.id === 'guaira-touch-controls').length, 0);
        }
        return h.factories[id];
    });
    h.primary.click(); assert.equal(h.activeGame()!.state, 'paused'); h.primary.click(); assert.deepEqual(h.loads, ['gallery']);
    h.primary.dispatch('pointerdown', { pointerId: 9 });
    h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.primary, repeat: false });
    const game = finishFixture(h); h.primary.dispatch('click', { detail: 1 }); assert.deepEqual(h.loads, ['gallery']);
    h.primary.click(); assert.deepEqual(h.loads, ['gallery'], 'Space held from PAUSA cannot activate ALÍVIO');
    const old = savedClick(h.primary); game.player.data.isDead = true; invokeSaved(old); assert.deepEqual(h.loads, ['gallery']);
    game.player.data.isDead = false; assert.equal(h.nativeKey('Enter', h.primary, true).defaultPrevented, true);
    game.toggleGalleryPause(); h.reflect(); invokeSaved(old); assert.equal(game.state, 'paused');
    h.primary.click(); assert.equal(game.state, 'playing'); assert.equal(h.activeGame(), game);
    invokeSaved(old); assert.equal(h.activeGame(), game);
    h.nativeKey('Enter'); await flushGalleryPage(); assert.ok(h.activeGame() instanceof GuairaRelief);
    invokeSaved(old); assert.deepEqual(h.loads, ['gallery', 'relief']);
});

for (const interrupt of ['blur', 'hidden'] as const)
test(`${interrupt} invalidates stale primary/retry and held input; fresh resume and retry remain usable`, async t => {
    const h = await galleryPageBrowser(t); await h.boot(); const game = finishFixture(h);
    const oldPrimary = savedClick(h.primary), oldRetry = savedClick(h.retry);
    h.primary.dispatch('pointerdown', { pointerId: 9 }); h.retry.dispatch('pointerdown', { pointerId: 10 });
    game.audio.enabled = false;
    if (interrupt === 'blur') h.window.dispatch('blur'); else { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
    invokeSaved(oldPrimary); invokeSaved(oldRetry); assert.deepEqual(h.loads, ['gallery']);
    if (interrupt === 'blur') h.window.dispatch('focus'); else { h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    h.reflect(); invokeSaved(oldPrimary); invokeSaved(oldRetry);
    h.primary.dispatch('click', { detail: 1 }); h.retry.dispatch('click', { detail: 1 }); assert.deepEqual(h.loads, ['gallery']);
    assert.equal(game.state, 'paused');
    h.primary.click(); assert.equal(game.state, 'playing'); h.primary.click(); await flushGalleryPage();
    assert.ok(h.activeGame() instanceof GuairaRelief); assert.equal(h.activeGame()!.audio.enabled, false);
    if (interrupt === 'blur') { h.window.dispatch('blur'); h.window.dispatch('focus'); }
    else { h.document.hidden = true; h.document.dispatch('visibilitychange'); h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    h.retry.click(); await flushGalleryPage(); assert.deepEqual(h.loads, ['gallery', 'relief', 'relief']);
});

for (const sceneId of ['gallery', 'relief'] as const)
for (const interruption of ['blur', 'hidden'] as const)
test(`${sceneId} pending load remembers ${interruption} and mounts paused even if focus returns first`, async t => {
    const h = await galleryPageBrowser(t), pending = deferred<GuairaInspectionRoomFactory>();
    await h.boot(id => id === sceneId ? pending.promise : Promise.resolve(h.factories[id]));
    if (sceneId === 'relief') { finishFixture(h); h.primary.click(); }
    if (interruption === 'blur') { h.window.dispatch('blur'); h.window.dispatch('focus'); }
    else { h.document.hidden = true; h.document.dispatch('visibilitychange'); h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    pending.resolve(h.factories[sceneId]); await flushGalleryPage(); const game = h.activeGame()!;
    assert.equal(game.state, 'paused'); const elapsed = game.elapsed; h.reflect(); assert.equal(game.elapsed, elapsed);
    h.primary.click(); assert.equal(game.state, 'playing');
    h.retry.click(); await flushGalleryPage(); assert.notEqual(h.activeGame(), game);
});

for (const exit of ['retry', 'pagehide', 'bfcache'] as const)
test(`late Relief import cannot replace current view after ${exit}`, async t => {
    const h = await galleryPageBrowser(t), pending = deferred<GuairaInspectionRoomFactory>(); let reliefLoads = 0, stale = 0;
    await h.boot(id => id === 'gallery' ? Promise.resolve(h.factories.gallery) : ++reliefLoads === 1 ? pending.promise : Promise.resolve(h.factories.relief));
    finishFixture(h); const oldPrimary = savedClick(h.primary); h.primary.click(); const oldRetry = savedClick(h.retry);
    if (exit === 'retry') { h.retry.click(); await flushGalleryPage(); assert.ok(h.activeGame() instanceof GuairaRelief); }
    else { h.window.dispatch('pagehide', { persisted: true }); if (exit === 'bfcache') { h.window.dispatch('pageshow', { persisted: true }); await flushGalleryPage(); assert.ok(h.activeGame() instanceof GuairaGallery); } }
    const game = h.activeGame(); invokeSaved(oldPrimary); invokeSaved(oldRetry);
    pending.resolve(() => { stale++; throw Error('Retired factory'); }); await flushGalleryPage();
    assert.equal(stale, 0); assert.equal(h.activeGame(), game);
    if (exit === 'pagehide') h.checkDisposed();
});

for (const failure of ['import', 'constructor', 'controls', 'toolbar', 'bitmap', 'wrong-room'] as const)
test(`Relief ${failure} failure retires ownership and TENTAR retries the current room`, async t => {
    const h = await galleryPageBrowser(t); t.mock.method(console, 'error', () => {}); let fail = true;
    await h.boot(async id => {
        if (id === 'gallery') return h.factories.gallery;
        if (failure === 'import' && fail) throw Error('Import failed');
        return failure === 'wrong-room' && fail ? h.factories.gallery : h.factories.relief;
    });
    finishFixture(h); let restore = () => {};
    if (failure === 'constructor') {
        const patch = t.mock.method(GuairaRelief.prototype, 'load', () => { throw Error('Stage failed'); }); restore = () => patch.mock.restore();
    } else if (failure === 'bitmap') {
        const patch = t.mock.method(LifecycleElement.prototype, 'getContext', () => { throw Error('Canvas failed'); }); restore = () => patch.mock.restore();
    } else if (failure === 'controls' || failure === 'toolbar') {
        const observe = ResizeObserver.prototype.observe;
        const patch = t.mock.method(ResizeObserver.prototype, 'observe', function (this: ResizeObserver, target: Element) {
            observe.call(this, target); const node = target as unknown as LifecycleElement;
            if (failure === 'controls' ? node.id === 'guaira-touch-controls' : node.tagName === 'NAV') throw Error('Observation failed');
        }); restore = () => patch.mock.restore();
    }
    h.primary.click(); await flushGalleryPage();
    assert.equal(h.activeGame(), undefined); assert.equal(h.status.getAttribute('role'), 'alert'); assert.equal(h.frames.size, 0);
    assert.match(h.status.textContent, /Câmara de Alívio/); assert.equal(h.retry.textContent, 'TENTAR'); assert.equal(h.map.textContent, 'MAPA');
    assert.equal(h.mapHref(), './guaira.html?at=bairro'); assert.ok(h.contexts.every(c => c.state === 'closed')); assert.ok(h.observers.every(o => o.disconnected));
    assert.equal(h.all().filter(n => n.id === 'guaira-touch-controls').length, 0);
    restore(); fail = false; h.retry.click(); await flushGalleryPage(); assert.ok(h.activeGame() instanceof GuairaRelief);
    assert.equal(h.status.getAttribute('role'), 'status'); assert.equal(h.frames.size, 2);
});

test('pagehide and repeated bfcache restore always create fresh Gallery attempts and retire all callbacks/resources', async t => {
    const h = await galleryPageBrowser(t); await h.boot(); finishFixture(h); h.primary.click(); await flushGalleryPage();
    const first = h.activeGame()!, oldRetry = savedClick(h.retry), frames = [...h.frames.values()];
    h.window.dispatch('pagehide', { persisted: true }); assert.equal(first.isDisposed, true); h.checkDisposed();
    for (const frame of frames) frame(performance.now() + 1000); invokeSaved(oldRetry); h.checkDisposed();
    h.window.dispatch('pageshow', { persisted: true }); await flushGalleryPage(); const second = h.activeGame();
    assert.ok(second instanceof GuairaGallery); assert.equal(second.finished, false); assert.equal(second.state, 'playing');
    h.window.dispatch('pageshow', { persisted: true }); await flushGalleryPage(); assert.equal(second.isDisposed, true);
    assert.ok(h.activeGame() instanceof GuairaGallery); assert.equal(h.frames.size, 2);
});

test('reentrant factory retires itself and cannot replace newer Relief attempt', async t => {
    const h = await galleryPageBrowser(t); let count = 0;
    await h.boot(async id => id === 'gallery' || ++count > 1 ? h.factories[id] : (canvas, status) => {
        const runtime = h.factories.relief(canvas, status); h.retry.click(); return runtime;
    });
    finishFixture(h); h.primary.click(); await flushGalleryPage();
    assert.ok(h.activeGame() instanceof GuairaRelief); assert.equal(h.games[1].isDisposed, true); assert.equal(h.games.length, 3); assert.equal(h.frames.size, 2);
});

for (const interrupt of ['blur', 'hidden'] as const)
for (const phase of ['loading', 'error'] as const)
test(`${phase} retry recovers after ${interrupt} with a fresh press while saved/held activation remains retired`, async t => {
    const h = await galleryPageBrowser(t), pending = deferred<GuairaInspectionRoomFactory>(); let attempts = 0;
    t.mock.method(console, 'error', () => {});
    await h.boot(async id => {
        if (++attempts > 1) return h.factories[id];
        if (phase === 'error') throw Error('Load failed');
        return pending.promise;
    });
    const oldRetry = savedClick(h.retry);
    h.retry.dispatch('pointerdown', { pointerId: 10 });
    h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.retry, repeat: false });
    if (interrupt === 'blur') h.window.dispatch('blur'); else { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
    if (interrupt === 'blur') h.window.dispatch('focus'); else { h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    invokeSaved(oldRetry); h.retry.dispatch('click', { detail: 1 }); h.retry.click(); assert.equal(attempts, 1);
    h.nativeKey('Enter', h.retry); await flushGalleryPage(); assert.ok(h.activeGame() instanceof GuairaGallery);
    pending.resolve(() => { assert.fail('Retired load must not be constructed'); }); await flushGalleryPage();
    assert.equal(attempts, 2);
});

for (const failure of ['wrong-room', 'reentrant'] as const)
test(`muted Gallery preference survives ${failure} factory disposal before runtime acceptance`, async t => {
    const h = await galleryPageBrowser(t); let attempts = 0;
    t.mock.method(console, 'error', () => {});
    await h.boot(async id => {
        if (id === 'gallery' || ++attempts > 1) return h.factories[id];
        if (failure === 'wrong-room') return h.factories.gallery;
        return (canvas, status) => { const runtime = h.factories.relief(canvas, status); h.retry.click(); return runtime; };
    });
    const first = finishFixture(h); first.audio.enabled = false; h.primary.click(); await flushGalleryPage();
    if (failure === 'wrong-room') { assert.equal(h.status.getAttribute('role'), 'alert'); h.retry.click(); await flushGalleryPage(); }
    assert.ok(h.activeGame() instanceof GuairaRelief); assert.equal(h.activeGame()!.audio.enabled, false);
    assert.ok(h.games.slice(0, -1).every(game => game.isDisposed));
});

for (const kind of ['pointer', 'keyboard'] as const)
test(`primary and retry gestures held across retry cannot act on the replacement scene (${kind})`, async t => {
    const h = await galleryPageBrowser(t); await h.boot(); finishFixture(h);
    if (kind === 'pointer') {
        h.primary.dispatch('pointerdown', { pointerId: 7 }); h.retry.dispatch('pointerdown', { pointerId: 8 });
    } else {
        h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.primary, repeat: false });
        h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.retry, repeat: false });
    }
    const retry = savedClick(h.retry);
    // A second, explicit modality requests restart while the original remains held.
    if (kind === 'pointer') h.retry.click(); else h.retry.dispatch('click', { detail: 1 });
    await flushGalleryPage(); const game = h.activeGame()!; assert.equal(game.state, 'playing');
    h.primary.dispatch('click', { detail: kind === 'pointer' ? 1 : 0 });
    h.retry.dispatch('click', { detail: kind === 'pointer' ? 1 : 0 }); invokeSaved(retry);
    assert.equal(h.activeGame(), game); assert.equal(game.state, 'playing'); assert.deepEqual(h.loads, ['gallery', 'gallery']);
});
