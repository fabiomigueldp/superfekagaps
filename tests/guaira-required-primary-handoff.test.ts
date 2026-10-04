import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { loadGuairaChapterScene } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { chapterExcursionBrowser, chapterRecording, flushChapter } from './helpers/chapterExcursionHarness';

async function mount(t: Parameters<typeof chapterExcursionBrowser>[0]) {
    const h = chapterExcursionBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia');
    const app = h.create({ loadScene: async () => factory });
    await flushChapter(); h.frames(2);
    h.button('Entrar: Travessia da Vala Seca').click(); await flushChapter();
    const game = app.activeGame; assert.ok(game instanceof GuairaTraversal);
    return { h, app, game, primary: h.byId('chapter-primary') };
}

// Real host, map, native runtime and recorded inputs. No completion flag,
// receipt, player coordinate, stage or physics state is injected.
for (const gesture of ['pointer', 'Space'] as const)
for (const reflected of [false, true])
test(`required primary ${gesture} PAUSA press cannot become ${reflected ? 'reflected' : 'unreflected'} CONTINUAR navigation after native completion`, async t => {
    const { h, app, game, primary } = await mount(t);
    const recording = chapterRecording('guairaTraversalReplay');
    h.play(game, { ...recording, runs: recording.runs.slice(0, -2) }); h.frames();
    assert.equal(game.finished, false);
    assert.equal(primary.getAttribute('aria-label'), 'Pausar');
    primary.focus();
    if (gesture === 'pointer') primary.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0 });
    else h.window.dispatch('keydown', { key: ' ', code: 'Space', target: primary, repeat: false });
    h.play(game, { ...recording, runs: recording.runs.slice(-2) });
    assert.equal(game.finished, true);
    if (reflected) h.frames();
    assert.equal(primary.getAttribute('aria-label'), reflected ? 'Continuar a jornada pelo mapa' : 'Pausar');
    if (gesture === 'pointer') primary.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0 });
    else h.window.dispatch('keyup', { key: ' ', code: 'Space', target: primary });
    // Browser default-button click boundary, after native pointerup / Space keyup.
    primary.dispatch('click', { detail: gesture === 'pointer' ? 1 : 0 });
    assert.equal(app.mode, 'game', 'Release of a PAUSA press must not navigate to the map');
    assert.equal(app.activeGame, game); assert.equal(game.isDisposed, false);
    h.frames(); assert.equal(app.snapshot.accepted.length, 1, 'Native completion still earns its durable receipt');
    if (gesture === 'Space' && !reflected) {
        // A rejected keyup already consumed that gesture. Accessibility activation
        // may subsequently produce a fresh detail=0 click without another keydown.
        primary.click();
    } else {
        primary.dispatch('pointerdown', { pointerId: 2, pointerType: 'mouse', button: 0 });
        primary.dispatch('pointerup', { pointerId: 2, pointerType: 'mouse', button: 0 });
        primary.dispatch('click', { detail: 1 });
    }
    assert.equal(app.mode, 'map', 'A fresh explicit Continue still navigates');
    assert.equal(app.snapshot.accepted.length, 1);
});

for (const interruption of ['blur', 'hidden'] as const)
test(`required primary cannot resume from a background click after ${interruption}`, async t => {
    const { h, app, game, primary } = await mount(t);
    const before = app.snapshot;
    const saved = primary.listeners.find(listener => listener.type === 'click')!.callback;
    const invokeSaved = () => {
        if (typeof saved === 'function') saved(new Event('click')); else saved.handleEvent(new Event('click'));
    };
    if (interruption === 'blur') h.window.dispatch('blur');
    else { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
    assert.equal(game.state, 'paused');
    invokeSaved();
    primary.click();
    assert.equal(game.state, 'paused', 'Inactive page action must not restart the native scene');
    assert.deepEqual(app.snapshot, before);
    if (interruption === 'blur') h.window.dispatch('focus');
    else { h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    h.frames(); invokeSaved(); assert.equal(game.state, 'paused', 'Saved action remains stale after focus returns');
    primary.click();
    assert.equal(game.state, 'playing', 'Fresh focused Resume still works');
});

for (const interruption of ['blur', 'hidden'] as const)
for (const gesture of ['pointer', 'Space'] as const)
test(`required primary ${gesture} press begun before ${interruption} cannot resume after focus restoration`, async t => {
    const { h, game, primary } = await mount(t);
    if (gesture === 'pointer') primary.dispatch('pointerdown', { pointerId: 3, pointerType: 'mouse', button: 0 });
    else h.window.dispatch('keydown', { key: ' ', code: 'Space', target: primary, repeat: false });
    if (interruption === 'blur') { h.window.dispatch('blur'); h.window.dispatch('focus'); }
    else { h.document.hidden = true; h.document.dispatch('visibilitychange'); h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    h.frames(); assert.equal(game.state, 'paused');
    if (gesture === 'pointer') primary.dispatch('pointerup', { pointerId: 3, pointerType: 'mouse', button: 0 });
    else h.window.dispatch('keyup', { key: ' ', code: 'Space', target: primary });
    primary.dispatch('click', { detail: gesture === 'pointer' ? 1 : 0 });
    assert.equal(game.state, 'paused', 'A pre-interruption press is stale after return');
    primary.dispatch('pointerdown', { pointerId: 4, pointerType: 'mouse', button: 0 });
    primary.dispatch('click', { detail: 1 });
    assert.equal(game.state, 'playing');
});

test('required primary rejects pointercancel and saved callbacks; fresh Enter/Space pause and resume without extra loops', async t => {
    const { h, game, primary } = await mount(t);
    const requestFrame = requestAnimationFrame; let framesRequested = 0;
    t.mock.method(globalThis, 'requestAnimationFrame', (callback: FrameRequestCallback) => { framesRequested++; return requestFrame(callback); });
    const savedPause = primary.listeners.find(listener => listener.type === 'click')!.callback;
    const activate = (key: 'Enter' | ' ', repeat = false) => {
        const event = h.window.dispatch('keydown', { key, code: key === ' ' ? 'Space' : key, target: primary, repeat });
        if (key === ' ') h.window.dispatch('keyup', { key, code: 'Space', target: primary });
        if (!event.defaultPrevented) primary.click();
        return event;
    };
    primary.dispatch('pointerdown', { pointerId: 5 });
    primary.dispatch('pointercancel', { pointerId: 5 });
    primary.dispatch('click', { detail: 1 });
    assert.equal(game.state, 'playing', 'Cancelled pointer cannot pause');
    assert.equal(activate('Enter', true).defaultPrevented, true);
    assert.equal(game.state, 'playing', 'Repeated Enter has no native button activation');
    activate('Enter'); assert.equal(game.state, 'paused');
    assert.equal(primary.getAttribute('aria-label'), 'Retomar a tentativa');
    if (typeof savedPause === 'function') savedPause(new Event('click')); else savedPause.handleEvent(new Event('click'));
    assert.equal(game.state, 'paused', 'Saved Pause callback cannot become Resume');
    activate(' '); assert.equal(game.state, 'playing');
    assert.equal(primary.getAttribute('aria-label'), 'Pausar');
    assert.equal(framesRequested, 0, 'Changing a primary action adds no reflection clock');
});

test('required primary resumes completed native scene before a fresh keyboard Continue navigates once', async t => {
    const { h, app, game, primary } = await mount(t);
    h.play(game, chapterRecording('guairaTraversalReplay')); h.frames();
    assert.equal(game.finished, true); assert.equal(app.snapshot.accepted.length, 1);
    h.window.dispatch('blur'); h.window.dispatch('focus'); h.frames();
    assert.equal(game.state, 'paused');
    h.window.dispatch('keydown', { key: 'Enter', code: 'Enter', target: primary, repeat: false }); primary.click();
    assert.equal(game.state, 'playing'); assert.equal(app.mode, 'game');
    assert.equal(primary.getAttribute('aria-label'), 'Continuar a jornada pelo mapa');
    h.window.dispatch('keydown', { key: ' ', code: 'Space', target: primary, repeat: false });
    h.window.dispatch('keyup', { key: ' ', code: 'Space', target: primary }); primary.click();
    assert.equal(app.mode, 'map'); assert.equal(game.isDisposed, true);
    assert.equal(app.snapshot.accepted.length, 1);
    primary.click(); assert.equal(app.mode, 'map'); assert.equal(app.snapshot.accepted.length, 1);
});
