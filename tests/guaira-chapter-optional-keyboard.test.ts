import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import reliefRecordings from './helpers/guairaReliefReplay.json';
import type { LifecycleElement } from './helpers/sceneLifecycleHarness';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { loadGuairaChapterExcursion } from '../src/adventure/experimental/guaira/chapter/GuairaChapterExcursions';
import { chapterExcursionBrowser, chapterRecording, flushChapter } from './helpers/chapterExcursionHarness';

// The real host, Player and route mechanisms run recorded inputs; only device,
// asset and DOM boundaries are instrumented. Button default clicks are emitted
// explicitly after Space keyup (or Enter keydown), as in native activation.
type Harness = ReturnType<typeof chapterExcursionBrowser>;

async function gallery(t: TestContext) {
    const h = chapterExcursionBrowser(t);
    // Resolve real lazy factories before the microtask-only interaction flushes;
    // those flushes cannot wait for module loading on every supported Node runtime.
    const [galleryFactory, reliefFactory] = await Promise.all([
        loadGuairaChapterExcursion('gallery'), loadGuairaChapterExcursion('relief')
    ]);
    const app = h.create({ loadExcursion: async id => id === 'gallery' ? galleryFactory : reliefFactory });
    await flushChapter(); h.frames(2);
    h.button('Ver a jornada de Guaíra').click();
    h.button('Bairro da Vala Seca / Galeria dos Remendos: desvio opcional').click();
    h.frames(1200);
    h.button('Entrar na Galeria dos Remendos, percurso opcional').click(); await flushChapter();
    const game = app.activeGame; assert.ok(game instanceof GuairaGallery);
    return { h, app, game, primary: h.byId('chapter-primary') };
}
function press(h: Harness, key = ' ') {
    h.byId('chapter-primary').focus();
    return h.window.dispatch('keydown', { key, code: key === 'Enter' ? 'Enter' : 'Space', repeat: false, target: h.byId('chapter-primary') });
}
function release(h: Harness, key = ' ') {
    h.window.dispatch('keyup', { key, code: key === 'Enter' ? 'Enter' : 'Space', target: h.byId('chapter-primary') });
    h.byId('chapter-primary').click();
}

for (const reflected of [false, true]) test(`Gallery held Space does not cross native completion (${reflected ? 'reflected' : 'before reflection'})`, async t => {
    const { h, app, game, primary } = await gallery(t);
    const recording = chapterRecording('guairaGalleryReplay');
    h.play(game, { runs: recording.runs.slice(0, -1) }); h.frames();
    assert.equal(game.finished, false); assert.equal(primary.getAttribute('aria-label'), 'Pausar');
    press(h);
    h.play(game, { runs: recording.runs.slice(-1) });
    assert.equal(game.finished, true, 'The recorded inputs reach the real Gallery exit');
    if (reflected) h.frames();
    release(h); await flushChapter();
    assert.ok(app.activeGame === game, 'Space begun on PAUSA cannot enter Relief');
    h.frames(); primary.click(); await flushChapter();
    assert.ok(app.activeGame instanceof GuairaRelief, 'A fresh accessible click works immediately after the stale release');
});

const clickCallbacks = (button: LifecycleElement) => button.listeners.filter(item => item.type === 'click').map(item => item.callback);
function invoke(callbacks: EventListenerOrEventListenerObject[], detail = 0) {
    const event = Object.assign(new Event('click'), { detail });
    callbacks.forEach(callback => typeof callback === 'function' ? callback(event) : callback.handleEvent(event));
}
function interrupt(h: Harness, kind: 'blur' | 'hidden') {
    if (kind === 'blur') { h.window.dispatch('blur'); h.window.dispatch('focus'); }
    else {
        h.document.hidden = true; h.document.dispatch('visibilitychange');
        h.document.hidden = false; h.document.dispatch('visibilitychange');
    }
}

for (const scene of ['gallery', 'relief'] as const)
for (const stage of ['playing', 'finished', 'resume'] as const)
for (const interruption of ['blur', 'hidden'] as const)
test(`${scene} ${stage}: held Space cannot resume after ${interruption} and return`, async t => {
    const { h, app, game: initial } = await gallery(t);
    if (scene === 'relief' || stage === 'finished') {
        h.play(initial, chapterRecording('guairaGalleryReplay')); h.frames();
    }
    if (scene === 'relief') { h.byId('chapter-primary').click(); await flushChapter(); }
    const game = app.activeGame; assert.ok(game);
    if (scene === 'relief' && stage === 'finished') {
        assert.ok(game instanceof GuairaRelief);
        h.play(game, { runs: reliefRecordings.maintenance as Array<[number, string[]]> }); h.frames();
    }
    const primary = h.byId('chapter-primary');
    if (stage === 'resume') primary.click();
    const before = app.snapshot;
    press(h); interrupt(h, interruption);
    assert.equal(game.state, 'paused');
    release(h); await flushChapter();
    assert.equal(game.state, 'paused', 'Returning does not authorize the old keyboard release');
    assert.ok(app.activeGame === game); assert.deepEqual(app.snapshot, before);
    primary.click();
    assert.equal(game.state, 'playing', 'A fresh accessible click resumes immediately');
});

test('an older optional callback cannot clear a newer gesture across another action revision', async t => {
    const { h, game, primary } = await gallery(t);
    const oldPause = clickCallbacks(primary);
    h.play(game, chapterRecording('guairaGalleryReplay')); h.frames();
    press(h);
    game.toggleGalleryPause(); h.frames();
    invoke(oldPause);
    release(h);
    assert.equal(game.state, 'paused', 'Saved PAUSA cannot clear the newer ALÍVIO gesture and let it resume');
    primary.click(); assert.equal(game.state, 'playing');
});

function activate(h: Harness, key: string) {
    const down = press(h, key);
    assert.equal(down.defaultPrevented, false, 'Fresh native activation remains available');
    if (key === 'Enter') {
        h.byId('chapter-primary').click();
        h.window.dispatch('keyup', { key, code: 'Enter', target: h.byId('chapter-primary') });
    } else release(h, key);
}
for (const key of ['Enter', ' ', 'Spacebar'])
test(`fresh ${JSON.stringify(key)} and accessible clicks retain Gallery/Relief actions and route ownership`, async t => {
    const { h, app, game, primary } = await gallery(t), before = app.snapshot;
    activate(h, key); assert.equal(game.state, 'paused');
    activate(h, key); assert.equal(game.state, 'playing');
    primary.click(); assert.equal(game.state, 'paused', 'A detail=0 click without keydown still pauses');
    primary.click(); assert.equal(game.state, 'playing');
    h.play(game, chapterRecording('guairaGalleryReplay')); h.frames();
    activate(h, key); await flushChapter();
    const relief = app.activeGame; assert.ok(relief instanceof GuairaRelief);
    activate(h, key); assert.equal(relief.state, 'paused');
    activate(h, key); assert.equal(relief.state, 'playing');
    h.play(relief, { runs: reliefRecordings.maintenance as Array<[number, string[]]> }); h.frames();
    assert.equal(relief.finished, true);
    const next = relief.routes.capture('other-route'); assert.ok(next);
    activate(h, key); await flushChapter();
    const alternate = app.activeGame; assert.ok(alternate instanceof GuairaRelief);
    assert.ok(alternate !== relief); assert.equal(alternate.routes.snapshot.goal, next.options.routeGoal);
    assert.equal(relief.isDisposed, true); assert.equal(next.consume(), null);
    h.byId('chapter-retry').click(); await flushChapter();
    assert.ok(app.activeGame instanceof GuairaRelief); assert.ok(app.activeGame !== alternate);
    assert.equal(app.activeGame.routes.snapshot.goal, next.options.routeGoal);
    assert.deepEqual(app.snapshot, before);
});

for (const key of ['Enter', ' ', 'Spacebar'])
test(`repeated ${JSON.stringify(key)} cannot acquire the new Gallery action`, async t => {
    const { h, app, game, primary } = await gallery(t);
    press(h, key);
    h.play(game, chapterRecording('guairaGalleryReplay')); h.frames();
    const repeated = h.window.dispatch('keydown', { key, code: key === 'Enter' ? 'Enter' : 'Space', repeat: true, target: primary });
    assert.equal(repeated.defaultPrevented, true, 'Auto-repeat cannot synthesize a new native activation');
    release(h, key); await flushChapter();
    assert.ok(app.activeGame === game, 'Auto-repeat cannot refresh the held action revision');
    activate(h, key); await flushChapter();
    assert.ok(app.activeGame instanceof GuairaRelief, 'The next real keydown is fresh');
});

for (const reflected of [false, true])
test(`Gallery pointer guard survives optional keyboard tracking (${reflected ? 'reflected' : 'before reflection'})`, async t => {
    const { h, app, game, primary } = await gallery(t);
    primary.dispatch('pointerdown', { pointerId: 8, button: 0 });
    h.play(game, chapterRecording('guairaGalleryReplay'));
    if (reflected) h.frames();
    primary.dispatch('click', { detail: 1 }); await flushChapter();
    assert.ok(app.activeGame === game, 'A pointer begun on PAUSA cannot enter Relief');
    h.frames(); primary.click(); await flushChapter();
    assert.ok(app.activeGame instanceof GuairaRelief, 'A rejected pointer cannot block a fresh accessible activation');
});

test('cancelled pointer and keyboard gestures retain independent ownership', async t => {
    const { h, game, primary } = await gallery(t);
    primary.dispatch('pointerdown', { pointerId: 8, button: 0 });
    primary.dispatch('pointercancel', { pointerId: 8 });
    press(h);
    primary.dispatch('click', { detail: 1 });
    assert.equal(game.state, 'playing');
    release(h); assert.equal(game.state, 'paused', 'Rejecting a pointer cannot consume the keyboard gesture');
    primary.dispatch('pointerdown', { pointerId: 9, button: 0 });
    primary.dispatch('click', { detail: 1 }); assert.equal(game.state, 'playing', 'Fresh pointer remains usable');
});
