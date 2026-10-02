import assert from 'node:assert/strict';
import test from 'node:test';
import galleryRecording from './helpers/guairaGalleryReplay.json';
import reliefRecordings from './helpers/guairaReliefReplay.json';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { galleryPageBrowser, flushGalleryPage } from './helpers/guairaGalleryPageHarness';

/** Every victory comes from the real page's installed keyboard/DOM touch input.
 * No player position, result, mechanism, checkpoint, receipt or storage writes. */
for (const touch of [false, true])
for (const route of ['maintenance', 'interval'] as const)
test(`free Gallery → Relief ${route} → native Bairro exit (${touch ? 'DOM touch' : 'keyboard'})`, async t => {
    const h = await galleryPageBrowser(t); await h.boot();
    const gallery = h.activeGame(); assert.ok(gallery instanceof GuairaGallery);
    h.play(gallery, { runs: galleryRecording.runs as Array<[number, string[]]> }, touch); h.reflect();
    assert.equal(gallery.finished, true); assert.equal(gallery.player.data.isDead, false);
    assert.equal(h.primary.getAttribute('aria-label'), 'Seguir para a Câmara de Alívio, continuação opcional');
    assert.match(h.status.textContent, /Câmara de Alívio/); assert.deepEqual(h.loads, ['gallery'], 'Arrival never enters automatically');
    gallery.toggleGalleryPause(); h.reflect();
    h.primary.click(); assert.equal(h.activeGame(), gallery); assert.equal(gallery.state, 'playing', 'Paused primary resumes Gallery first');
    if (touch) { h.primary.dispatch('pointerdown', { pointerId: 8, pointerType: 'touch', button: 0 }); h.primary.dispatch('click', { detail: 1 }); }
    else h.nativeKey('Enter');
    await flushGalleryPage(); const relief = h.activeGame(); assert.ok(relief instanceof GuairaRelief);
    assert.equal(gallery.isDisposed, true); assert.equal(gallery.input.isDisposed, true); assert.equal(gallery.audio.isDisposed, true);
    assert.equal(relief.finished, false); assert.equal(relief.store.save.checkpoint, null);
    h.play(relief, { runs: reliefRecordings[route] as Array<[number, string[]]> }, touch); h.reflect();
    assert.equal(relief.finished, true); assert.equal(relief.reliefOpened, route === 'maintenance');
    assert.match(h.status.textContent, route === 'maintenance' ? /alívio aberto, grelha sem pressão/ : /alívio intacto, grelha mantém o ciclo/);
    assert.equal(h.mapHref(), './guaira.html?at=bairro'); assert.equal(h.map.dispatch('click', { detail: touch ? 1 : 0 }).defaultPrevented, false);
    assert.equal(relief.store.save.completed.length, 0); assert.equal(gallery.store.save.completed.length, 0);
    h.window.dispatch('pagehide'); h.checkDisposed();
    h.window.dispatch('pageshow', { persisted: true }); await flushGalleryPage();
    const fresh = h.activeGame(); assert.ok(fresh instanceof GuairaGallery); assert.equal(fresh.finished, false); assert.equal(fresh.store.save.checkpoint, null);
});
