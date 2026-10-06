/** Production host/bitmap behavior and CSS contracts; layout needs real browser QA. */
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import type { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import { labActionSize } from '../src/adventure/experimental/JuiceLabToolbar';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

function browser(t: TestContext, canvasAvailable = true) {
    let dispose = () => {};
    t.after(() => dispose());
    const h = sceneLifecycleBrowser(t), writes: string[] = [];
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => null, setItem: (key: string) => writes.push(key)
    } });
    const doc = h.document as unknown as { activeElement: LifecycleElement | null };
    const decorate = (element: LifecycleElement) => {
        element.focus = () => { doc.activeElement = element; };
        Object.assign(element, { showModal() {}, close() {} });
        if (!canvasAvailable) element.getContext = () => (element.className === 'lab-action-art'
            ? null : element.context) as unknown as CanvasRenderingContext2D;
        return element;
    };
    const create = h.document.createElement;
    h.document.createElement = tag => decorate(create(tag));
    decorate(h.canvas);
    const require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    t.after(() => { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; });
    const { FactoryCampaign } = require('../src/adventure/factory/FactoryCampaign.ts') as typeof import('../src/adventure/factory/FactoryCampaign');
    const game = new FactoryCampaign(h.canvas as unknown as HTMLCanvasElement);
    dispose = () => game.dispose();
    game.load(FACTORY_SALON.stage);
    Object.assign(game.player.data.position, { x: FACTORY_SALON.door.x, y: FACTORY_SALON.support.y - game.player.data.height });
    game.player.data.isGrounded = true;
    const descendants = (element: LifecycleElement): LifecycleElement[] => [element, ...element.children.flatMap(descendants)];
    const shell = () => h.body.children.find(child => child.className === 'factory-salon')!;
    const button = (name: string) => descendants(shell()).find(child => child.tagName === 'BUTTON' && child.getAttribute('aria-label') === name)!;
    const session = () => (game as unknown as { salon: FactorySalonSession }).salon;
    return { ...h, game, doc, writes, shell, button, session };
}

test('real salon toolbar retains native actions, bitmap labels and pause/retry/return behavior', t => {
    const h = browser(t), initialSave = JSON.stringify(h.game.store.save), initialWrites = h.writes.length;
    for (let visit = 0; visit < 2; visit++) {
        h.game.enterSalon();
        const salon = h.session(), canvas = h.shell().children.find(child => child.tagName === 'CANVAS')!;
        for (const [name, label] of [['Apresentar pose', 'POSE'], ['Pular cena', 'PULAR CENA'],
            ['Reiniciar tentativa', 'REINICIAR'], ['Pausar', 'PAUSA'], ['Voltar à fase', 'VOLTAR']]) {
            const button = h.button(name), [art, text] = button.children;
            assert.ok(button.getAttribute('aria-label')!.toLocaleLowerCase('pt-BR').includes(label.toLocaleLowerCase('pt-BR')),
                `The accessible name must contain the visible ${label} label for voice activation`);
            assert.equal(button.title, name); assert.equal(text.textContent, name);
            assert.equal(art.getAttribute('aria-hidden'), 'true');
            assert.equal(art.width, labActionSize(label).width * 2); assert.equal(art.height, 44);
        }
        assert.equal(h.button('Reiniciar tentativa').hidden, true);
        h.button('Pular cena').click(); h.game.render();
        assert.equal(salon.labMode, 'combat'); assert.equal(h.doc.activeElement, canvas);
        assert.equal(h.button('Pular cena').hidden, true); assert.equal(h.button('Reiniciar tentativa').hidden, false);
        h.button('Pausar').click(); h.game.render();
        assert.equal(salon.state, 'paused'); assert.equal(h.button('Continuar').children[0].width, labActionSize('CONTINUAR').width * 2);
        assert.ok(h.button('Continuar').getAttribute('aria-label')!.toLocaleLowerCase('pt-BR').includes('CONTINUAR'.toLocaleLowerCase('pt-BR')));
        h.button('Continuar').click(); h.game.render();
        assert.equal(salon.state, 'playing'); assert.equal(h.button('Pausar').children.length, 2);
        h.button('Reiniciar tentativa').click(); h.game.render();
        assert.equal(salon.labMode, 'combat'); assert.equal(salon.state, 'playing');
        h.button('Voltar à fase').click();
        assert.equal(h.shell(), undefined); assert.equal(h.doc.activeElement, h.canvas);
        assert.equal(h.game.state, 'playing'); assert.equal(h.canvas.id, 'game-canvas');
    }
    assert.equal(JSON.stringify(h.game.store.save), initialSave); assert.equal(h.writes.length, initialWrites);
});

test('canvas-unavailable toolbar exposes the full native button names', t => {
    const h = browser(t, false); h.game.enterSalon();
    for (const name of ['Apresentar pose', 'Pular cena', 'Reiniciar tentativa', 'Pausar', 'Voltar à fase']) {
        const [art, text] = h.button(name).children;
        assert.equal(art.hidden, true); assert.equal(text.className, ''); assert.equal(text.textContent, name);
    }
    h.button('Pausar').click(); h.game.render();
    assert.equal(h.button('Continuar').children[1].textContent, 'Continuar');
});

test('toolbar art keeps native dimensions, 44px targets, focus and forced-colors names', () => {
    const css = readFileSync(new URL('../src/adventure/factory/factory-salon.css', import.meta.url), 'utf8');
    assert.match(css, /\.factory-salon > canvas \{[^}]*aspect-ratio: 16 \/ 9/);
    assert.doesNotMatch(css, /\.factory-salon canvas\s*\{/);
    assert.match(css, /\.factory-salon nav \{[^}]*flex-wrap: wrap/);
    assert.match(css, /\.factory-salon button \{[^}]*min-width: 44px; min-height: 44px/);
    assert.match(css, /\.factory-salon button:focus-visible \{[^}]*outline: 3px[^}]*outline-offset: 2px/);
    assert.match(css, /\.factory-salon \[hidden\]/);
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    assert.match(forced, /\.lab-action-art \{ display: none/);
    assert.match(forced, /\.lab-sr \{[^}]*position: static;[^}]*clip-path: none;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere/);
    assert.match(forced, /border: 1px solid ButtonText/);
    for (const labels of [['PULAR CENA', 'PAUSA', 'VOLTAR'], ['REINICIAR', 'PAUSA', 'VOLTAR']])
        assert.ok(labels.reduce((width, label) => width + labActionSize(label).width * 2, 0) + 12 + 20 <= 320,
            'ordinary three-control rows fit 320px; longer paused/pose rows can wrap');
});


test('retired salon Return cannot close a newer visit through a detached button or saved callback', t => {
    const h = browser(t);
    h.game.enterSalon();
    const previous = h.session(), back = h.button('Voltar à fase');
    const callback = back.listeners.find(listener => listener.type === 'click')!.callback;
    h.game.leaveSalon(); h.game.enterSalon();
    const current = h.session(), shell = h.shell();
    assert.notEqual(current, previous); assert.equal(previous.isDisposed, true);
    back.click();
    assert.ok(h.session() === current, 'A detached Return belongs only to its retired visit');
    const event = new Event('click');
    if (typeof callback === 'function') callback(event); else callback.handleEvent(event);
    assert.ok(h.session() === current, 'A retained dispatch callback cannot close the replacement visit');
    assert.equal(h.shell(), shell); assert.equal(current.isDisposed, false);
    h.button('Voltar à fase').click();
    assert.equal(h.shell(), undefined); assert.equal(h.game.state, 'playing');
});

test('repeated salon exits release every shell, toolbar and canvas listener', t => {
    const h = browser(t), baseline = h.listenerCount();
    const descendants = (element: LifecycleElement): LifecycleElement[] => [element, ...element.children.flatMap(descendants)];
    for (let visit = 0; visit < 4; visit++) {
        h.game.enterSalon(); const nodes = descendants(h.shell());
        assert.ok(h.listenerCount() > baseline);
        h.game.leaveSalon();
        assert.equal(nodes.reduce((count, node) => count + node.listeners.length, 0), 0,
            `Visit ${visit + 1} releases all mounted DOM listeners`);
        assert.equal(h.listenerCount(), baseline, 'Each exit restores the campaign listener baseline');
    }
    h.game.dispose();
    assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
    assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0);
});

test('campaign disposal retires salon actions before a stale Return can republish the disposed game', t => {
    const h = browser(t); h.game.enterSalon();
    const back = h.button('Voltar à fase'), callback = back.listeners.find(listener => listener.type === 'click')!.callback;
    h.game.dispose();
    assert.equal(h.window.worldGame, undefined);
    back.click();
    const event = new Event('click');
    if (typeof callback === 'function') callback(event); else callback.handleEvent(event);
    assert.ok(h.window.worldGame === undefined, 'A retired salon cannot restore a disposed campaign global');
    assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
});


test('all retired salon dispatches stay inert while the current dialog keeps focus and input ownership', t => {
    const h = browser(t), initialSave = JSON.stringify(h.game.store.save), initialWrites = h.writes.length;
    h.game.enterSalon();
    const previous = h.session(), oldShell = h.shell(), oldCanvas = oldShell.children.find(node => node.tagName === 'CANVAS')!;
    const buttons = ['Apresentar pose', 'Pular cena', 'Reiniciar tentativa', 'Pausar', 'Voltar à fase'].map(h.button);
    const callbacks = [...buttons, oldShell, oldCanvas].flatMap(node => node.listeners.map(listener => ({ ...listener })));
    const disposePrevious = t.mock.method(previous, 'dispose');
    h.game.leaveSalon(); assert.equal(disposePrevious.mock.callCount(), 1);
    const retiredActions = (['presentIntro', 'skipIntro', 'load', 'toggleLabPause'] as const).map(name =>
        t.mock.method(previous, name, () => assert.fail(`Retired ${name} cannot run`)));
    h.game.enterSalon(); const current = h.session(), currentShell = h.shell(), focus = h.doc.activeElement;
    for (const button of buttons) button.click();
    oldShell.dispatch('keydown', { key: 'Escape', repeat: false }); oldShell.dispatch('cancel');
    oldCanvas.dispatch('pointerdown');
    for (const { type, callback } of callbacks) {
        const event = new Event(type, { cancelable: true });
        Object.defineProperties(event, { key: { value: 'Escape' }, repeat: { value: false } });
        if (typeof callback === 'function') callback(event); else callback.handleEvent(event);
    }
    assert.ok(h.session() === current); assert.ok(h.shell() === currentShell);
    assert.equal(current.isDisposed, false); assert.equal(current.state, 'playing');
    assert.ok(h.doc.activeElement === focus); assert.equal(h.canvas.id, 'factory-campaign-canvas');
    assert.ok(retiredActions.every(action => action.mock.callCount() === 0));
    assert.equal(disposePrevious.mock.callCount(), 1);
    h.button('Pausar').click(); assert.equal(current.state, 'paused');
    h.game.render(); h.button('Continuar').click(); assert.equal(current.state, 'playing');
    const disposeCurrent = t.mock.method(current, 'dispose');
    h.game.dispose(); h.game.dispose();
    assert.equal(disposeCurrent.mock.callCount(), 1); assert.equal(disposePrevious.mock.callCount(), 1);
    assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
    assert.equal(JSON.stringify(h.game.store.save), initialSave); assert.equal(h.writes.length, initialWrites);
});
