/** Production host/bitmap behavior and CSS contracts; layout needs real browser QA. */
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import type { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import { replayJuiceVictory, STEP } from './helpers/juiceEpilogueHarness';
import { labActionSize } from '../src/adventure/experimental/JuiceLabToolbar';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

function browser(t: TestContext, canvasAvailable = true) {
    let dispose = () => {};
    t.after(() => dispose());
    const h = sceneLifecycleBrowser(t), writes: string[] = [], saved = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => { saved.set(key, value); writes.push(key); }
    } });
    const doc = h.document as unknown as { activeElement: LifecycleElement | null };
    const decorate = (element: LifecycleElement) => {
        element.focus = () => { doc.activeElement = element; };
        Object.assign(element, { open: false, showModal() { this.open = true; }, close() { this.open = false; } });
        Object.defineProperty(element, 'isConnected', { get: () => !!element.parent });
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
    const menu = () => shell().children.find(child => child.className === 'factory-salon-menu')!;
    const pause = () => { if (session().state !== 'paused') button('Pausar').click(); };
    const leave = () => { pause(); button('Voltar à fase').click(); };
    const animatedEnter = () => {
        const entrance = h.body.children.find(child => child.className.split(' ').includes('factory-salon-enter'))!;
        entrance.click();
        for (let frame = 0; frame < 40; frame++) {
            if (!(game as unknown as { entry?: { active: boolean } }).entry?.active) break;
            game.update(STEP); game.render();
        }
        assert.ok(session(), 'The real entry control completes its covered handoff');
    };
    return { ...h, game, doc, writes, shell, button, session, menu, pause, leave, animatedEnter };
}

test('full-play salon keeps native actions in pause only and preserves retry/return behavior', t => {
    const h = browser(t), initialSave = JSON.stringify(h.game.store.save), initialWrites = h.writes.length;
    for (let visit = 0; visit < 2; visit++) {
        h.game.enterSalon();
        const salon = h.session(), canvas = h.shell().children.find(child => child.tagName === 'CANVAS')!;
        for (const [name, label] of [['Apresentar pose', 'POSE'], ['Pular cena', 'PULAR CENA'],
            ['Reiniciar tentativa', 'REINICIAR'], ['Pausar', 'PAUSA'], ['Continuar', 'CONTINUAR'], ['Controles', 'CONTROLES'], ['Voltar à fase', 'VOLTAR']]) {
            const button = h.button(name), [art, text] = button.children;
            assert.ok(button.getAttribute('aria-label')!.toLocaleLowerCase('pt-BR').includes(label.toLocaleLowerCase('pt-BR')),
                `The accessible name must contain the visible ${label} label for voice activation`);
            assert.equal(button.title, name); assert.equal(text.textContent, name);
            assert.equal(art.getAttribute('aria-hidden'), 'true');
            assert.equal(art.width, labActionSize(label).width * 2); assert.equal(art.height, 44);
        }
        assert.equal(h.menu().hidden, true, 'No toolbar reserves running play space');
        assert.equal(h.button('Reiniciar tentativa').hidden, true);
        h.pause(); assert.equal(h.menu().hidden, false);
        h.button('Pular cena').click(); h.game.render();
        assert.equal(salon.labMode, 'combat'); assert.equal(h.doc.activeElement, canvas);
        assert.equal(h.button('Pular cena').hidden, true); assert.equal(h.button('Reiniciar tentativa').hidden, false);
        h.button('Pausar').click(); h.game.render();
        assert.equal(salon.state, 'paused'); assert.equal(h.button('Continuar').children[0].width, labActionSize('CONTINUAR').width * 2);
        assert.ok(h.button('Continuar').getAttribute('aria-label')!.toLocaleLowerCase('pt-BR').includes('CONTINUAR'.toLocaleLowerCase('pt-BR')));
        h.button('Continuar').click(); h.game.render();
        assert.equal(salon.state, 'playing'); assert.equal(h.button('Pausar').children.length, 2);
        h.pause(); h.button('Reiniciar tentativa').click(); h.game.render();
        assert.equal(salon.labMode, 'combat'); assert.equal(salon.state, 'playing');
        h.leave();
        assert.equal(h.shell(), undefined); assert.equal(h.doc.activeElement, h.canvas);
        assert.equal(h.game.state, 'playing'); assert.equal(h.canvas.id, 'game-canvas');
    }
    const expected = JSON.parse(initialSave); expected.seen.unshift(FACTORY_SALON.passage);
    assert.equal(JSON.stringify(h.game.store.save), JSON.stringify(expected));
    assert.equal(h.writes.length, initialWrites + 1, 'A real presentation persists once, including after reentry');
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

test('fullscreen host keeps native scaling and pause actions retain 44px targets and forced-colors names', () => {
    const css = readFileSync(new URL('../src/adventure/factory/factory-salon.css', import.meta.url), 'utf8');
    assert.match(css, /\.factory-salon > canvas \{[^}]*aspect-ratio: 16 \/ 9/);
    assert.doesNotMatch(css, /\.factory-salon canvas\s*\{/);
    assert.match(css, /\.factory-salon-menu \{[^}]*grid-template-columns: minmax\(0, 280px\)/);
    assert.match(css, /\.factory-salon button \{[^}]*min-width: 44px; min-height: 44px/);
    assert.match(css, /\.factory-salon button:focus-visible \{[^}]*outline: 3px[^}]*outline-offset: 2px/);
    assert.match(css, /\.factory-salon \[hidden\]/);
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    assert.match(forced, /\.lab-action-art \{ display: none/);
    assert.match(forced, /\.lab-sr \{[^}]*position: static;[^}]*clip-path: none;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere/);
    assert.match(forced, /border: 1px solid ButtonText/);
    assert.match(css, /\.factory-salon \{[^}]*width: 100vw; height: 100dvh; max-width: none; max-height: none/);
    assert.match(css, /\.factory-salon \{[^}]*padding: 0; border: 0/);
    assert.doesNotMatch(css, /720px|width: 100% !important/);
    assert.doesNotMatch(css.match(/\.factory-salon > canvas \{[^}]*\}/)![0], /height: auto !important/);
    assert.match(css, /max-width: min\(100vw, calc\(100dvh \* 16 \/ 9\)\)/);
    assert.match(css, /\.factory-salon-pause:not\(:focus\)/);
    assert.match(css, /@media \(max-height: 340px\)/);
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
    h.leave();
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


test('pause keyboard navigation, help dismissal and repeated visits keep one focus owner', t => {
    const h = browser(t), saved = JSON.stringify(h.game.store.save), writes = h.writes.length;
    h.game.enterSalon(); const lab = h.session(), canvas = h.doc.activeElement!;
    h.shell().dispatch('keydown', { key: 'Escape', repeat: false });
    assert.equal(lab.state, 'paused'); assert.equal(h.menu().hidden, false);
    assert.equal(h.doc.activeElement, h.button('Continuar'));
    h.shell().dispatch('keydown', { key: 'Escape', repeat: true });
    assert.equal(lab.state, 'paused', 'Held Escape never resumes a just-opened pause');
    h.shell().dispatch('keydown', { key: 'ArrowDown', repeat: false });
    assert.equal(h.doc.activeElement, h.button('Pular cena'));
    const helpButton = h.button('Controles'); helpButton.focus(); helpButton.click();
    const help = h.body.children.find(child => child.id === 'factory-salon-controls')!;
    assert.equal((help as unknown as { open: boolean }).open, true);
    const heading = h.doc.activeElement; h.game.render();
    assert.equal(h.doc.activeElement, heading, 'Frame reflections cannot steal focus from help');
    const time = lab.time; h.game.update(100); assert.equal(lab.time, time);
    help.dispatch('cancel');
    assert.equal((help as unknown as { open: boolean }).open, false);
    assert.equal(h.doc.activeElement, helpButton); assert.equal(lab.state, 'paused');
    h.shell().dispatch('keydown', { key: 'Escape', repeat: false });
    assert.equal(lab.state, 'playing'); assert.equal(h.menu().hidden, true);
    assert.equal(h.doc.activeElement, canvas);
    h.button('Pular cena').click(); h.button('Voltar à fase').click();
    assert.equal(lab.labMode, 'intro', 'Hidden menu commands cannot activate behind live play');
    assert.equal(h.session(), lab);
    h.leave(); assert.equal(h.doc.activeElement, h.canvas);
    assert.equal(h.body.children.filter(child => child.id === 'factory-salon-controls').length, 0);
    assert.equal(JSON.stringify(h.game.store.save), saved); assert.equal(h.writes.length, writes);
});

for (const pointerType of ['mouse', 'touch', 'pen']) {
    test(`top canvas ${pointerType} pause keeps menu focus after pointer default dispatch`, t => {
        const h = browser(t); h.game.enterSalon(); const lab = h.session();
        const canvas = h.doc.activeElement!;
        const pointer = (clientY: number) => {
            const event = canvas.dispatch('pointerdown', { clientX: 100, clientY, pointerType, isPrimary: true });
            // Browsers apply pointer default focus after listeners finish. The
            // native EventTarget harness has no UA default actions of its own.
            if (!event.defaultPrevented) canvas.focus();
            return event;
        };
        for (let pause = 0; pause < 2; pause++) {
            const event = pointer(10);
            assert.equal(lab.state, 'paused'); assert.equal(h.menu().hidden, false);
            assert.equal(h.doc.activeElement, h.button('Continuar'), 'Default pointer focus must not reclaim the canvas');
            assert.equal(event.defaultPrevented, true);
            assert.ok(Object.values(lab.input.getState()).every(value => value === false));
            h.shell().dispatch('keydown', { key: 'ArrowDown', repeat: false });
            assert.equal(h.doc.activeElement, h.button('Pular cena'), 'Keyboard navigation starts from Continuar immediately');
            h.button('Continuar').click();
            assert.equal(lab.state, 'playing'); assert.equal(h.doc.activeElement, canvas);
        }
        const gameplay = pointer(100);
        assert.equal(gameplay.defaultPrevented, false, 'Ordinary gameplay pointer defaults remain available');
        assert.equal(lab.state, 'playing'); assert.equal(h.doc.activeElement, canvas);
        const shortcut = h.shell().dispatch('keydown', { key: 'Escape', repeat: false, ctrlKey: true });
        assert.equal(shortcut.defaultPrevented, false); assert.equal(lab.state, 'playing');
    });
}

test('real campaign host records the walked presentation once and preserves it across pause, exit and reentry', t => {
    const h = browser(t), initialWrites = h.writes.length;
    h.game.enterSalon(); const lab = h.session(), canvas = h.doc.activeElement!;
    const objective = () => h.menu().children.find(child => child.className === 'factory-salon-objective')!.children[1].textContent;
    assert.match(objective(), /Apresente-se/);
    for (let n = 0; n < 31; n++) h.game.update(100);
    h.window.dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight', target: canvas });
    for (let n = 0; n < 25; n++) h.game.update(100);
    h.window.dispatch('keyup', { key: 'ArrowRight', code: 'ArrowRight', target: canvas });
    assert.equal(lab.intro?.beat, 'prepare'); assert.equal(h.writes.length, initialWrites);
    h.window.dispatch('keydown', { key: ' ', code: 'Space', target: canvas }); h.game.update(100);
    h.window.dispatch('keyup', { key: ' ', code: 'Space', target: canvas });
    assert.equal(lab.intro?.beat, 'reveal'); assert.equal(lab.victorious, false);
    assert.ok(h.game.store.save.seen.includes(FACTORY_SALON.passage));
    assert.equal(h.writes.length, initialWrites + 1); assert.match(objective(), /Passagem liberada/);
    h.pause(); h.game.update(100); h.game.render();
    assert.equal(h.writes.length, initialWrites + 1);
    h.leave(); h.game.enterSalon();
    assert.equal(h.session().presentedAtChampionship, true); assert.match(objective(), /Passagem liberada/);
    h.leave(); assert.equal(h.writes.length, initialWrites + 1);
});

test('early exit leaves progression locked while pause-menu skip persists before the next game tick', t => {
    const h = browser(t), initialWrites = h.writes.length;
    h.game.enterSalon(); h.leave();
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.passage), false);
    assert.equal(h.writes.length, initialWrites);
    h.game.enterSalon(); h.pause(); h.button('Pular cena').click();
    assert.equal(h.writes.length, initialWrites + 1, 'The action itself commits passage, without a frame race');
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.passage), true);
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.victory), false);
    h.game.dispose(); assert.equal(h.writes.length, initialWrites + 1);
});

test('grandfathered routes show their actual open passage without inventing a championship pose', t => {
    const h = browser(t), writes = h.writes.length;
    h.game.store.save.completed = ['3-3']; h.game.update(1000 / 60);
    const entrance = h.body.children.find(child => child.className.split(' ').includes('factory-salon-enter'))!;
    assert.equal(entrance.textContent, 'E · Revisitar salão');
    h.game.enterSalon(); h.pause();
    assert.equal(h.session().presentedAtChampionship, false);
    const objective = h.menu().children.find(child => child.className === 'factory-salon-objective')!.children[1];
    assert.match(objective.textContent, /Passagem liberada/);
    h.leave();
    assert.match((h.game as unknown as { toast: string }).toast, /PASSAGEM LIBERADA/);
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.passage), false);
    assert.equal(h.writes.length, writes, 'Old earned access does not fabricate participation or rewrite the save');
});


for (const reduced of [false, true]) test(`actual six-hit campaign victory resolves and returns without a hidden menu (reduced=${reduced})`, t => {
    const h = browser(t); h.media.matches = reduced;
    const before = JSON.stringify(h.game.store.save), writes = h.writes.length;
    const campaignPosition = { ...h.game.player.data.position }, camera = { x: h.game.camera.x, y: h.game.camera.y };
    const player = h.game.player, level = h.game.level;
    h.animatedEnter(); const salon = h.session(), canvas = h.doc.activeElement!;
    h.pause(); h.button('Pular cena').click();
    replayJuiceVictory({ window: h.window, canvas }, salon, undefined, dt => h.game.update(dt));
    assert.equal(salon.boss?.health, 0);
    assert.equal(salon.player.data.isGrounded, false, 'The sixth real stomp still bounces');
    assert.equal(h.game.store.save.seen.filter(flag => flag === FACTORY_SALON.victory).length, 1,
        'Real victory is safely recorded before landing or a possible early departure');
    assert.equal(h.writes.length, writes + 2, 'Participation and real victory each persist exactly once');
    for (let frame = 0; frame < 720 && h.session(); frame++) { h.game.update(STEP); h.game.render(); }
    assert.equal(h.session(), undefined, 'A completed real fight must return to campaign automatically');
    assert.equal(h.shell(), undefined); assert.equal(salon.isDisposed, true);
    assert.equal(h.game.player, player); assert.equal(h.game.level, level);
    assert.deepEqual(h.game.player.data.position, campaignPosition);
    assert.deepEqual({ x: h.game.camera.x, y: h.game.camera.y }, camera);
    assert.equal(h.game.state, 'playing'); assert.equal(h.doc.activeElement, h.canvas);
    assert.equal(h.canvas.id, 'game-canvas'); assert.equal(h.window.worldGame, h.game);
    assert.ok(Object.values(h.game.input.getState()).every(value => value === false));
    const expected = JSON.parse(before); expected.seen.unshift(FACTORY_SALON.passage); expected.seen.unshift(FACTORY_SALON.victory);
    assert.deepEqual(h.game.store.save, expected);
    assert.equal(h.writes.length, writes + 2);
    h.key('keydown', 'd'); h.game.update(STEP); h.key('keyup', 'd');
    assert.ok(h.game.player.data.position.x > campaignPosition.x, 'The returned campaign accepts new movement');
});

test('pause-menu skip really ends the epilogue and pause freezes the automatic return', t => {
    const h = browser(t); h.game.enterSalon();
    const salon = h.session(), canvas = h.doc.activeElement!;
    h.pause(); h.button('Pular cena').click();
    replayJuiceVictory({ window: h.window, canvas }, salon, undefined, dt => h.game.update(dt));
    for (let frame = 0; frame < 120 && !salon.epilogue.frame; frame++) h.game.update(STEP);
    assert.equal(salon.epilogue.frame?.beat, 'return');
    h.pause(); h.button('Pular cena').click();
    assert.equal(salon.epilogue.frame?.beat, 'complete', 'Resume must precede active-only epilogue.skip');
    assert.equal(salon.state, 'playing');
    h.pause(); for (let frame = 0; frame < 200; frame++) h.game.update(100);
    assert.equal(h.session(), salon, 'Paused result never returns behind the menu or controls');
    h.button('Continuar').click();
    for (let frame = 0; frame < 120 && h.session(); frame++) h.game.update(STEP);
    assert.equal(h.session(), undefined);
});


test('winning then leaving during the final bounce preserves the win once through reentry and early retry exit', t => {
    const h = browser(t), writes = h.writes.length;
    h.game.enterSalon(); const salon = h.session(), canvas = h.doc.activeElement!;
    h.pause(); h.button('Pular cena').click();
    replayJuiceVictory({ window: h.window, canvas }, salon, undefined, dt => h.game.update(dt));
    assert.equal(salon.epilogue.frame, null);
    h.leave(); assert.equal(salon.isDisposed, true);
    assert.equal(h.game.store.save.seen.filter(flag => flag === FACTORY_SALON.victory).length, 1);
    assert.equal(h.writes.length, writes + 2);
    h.game.enterSalon(); const next = h.session();
    assert.equal(next.earnedVictory, false, 'Revisiting starts a fresh optional exhibition');
    h.pause(); h.button('Pular cena').click(); h.game.update(STEP);
    h.pause(); h.button('Reiniciar tentativa').click();
    for (let frame = 0; frame < 20; frame++) h.game.update(STEP);
    assert.equal(h.session(), next, 'No completed-result timer leaks into the fresh attempt');
    h.leave();
    assert.equal(h.writes.length, writes + 2);
});

test('visible epilogue return is usable before completion and a detached result button cannot close a new visit', t => {
    const h = browser(t); h.game.enterSalon(); const salon = h.session(), canvas = h.doc.activeElement!;
    const finish = h.button('Seguir viagem e voltar à fase');
    assert.equal(finish.hidden, true); finish.click(); assert.equal(h.session(), salon);
    h.pause(); h.button('Pular cena').click();
    replayJuiceVictory({ window: h.window, canvas }, salon, undefined, dt => h.game.update(dt));
    for (let frame = 0; frame < 120 && !salon.epilogue.frame; frame++) h.game.update(STEP);
    assert.equal(finish.hidden, false); assert.equal(h.menu().hidden, true);
    const callback = finish.listeners.find(listener => listener.type === 'click')!.callback;
    finish.click(); assert.equal(h.session(), undefined); assert.equal(h.doc.activeElement, h.canvas);
    h.game.enterSalon(); const current = h.session(), currentFocus = h.doc.activeElement;
    finish.click();
    if (typeof callback === 'function') callback(new Event('click')); else callback.handleEvent(new Event('click'));
    assert.equal(h.session(), current); assert.equal(h.doc.activeElement, currentFocus);
});

test('complete result supports fresh Enter, top-touch pause and hidden-tab interruption without a second return', t => {
    const h = browser(t); h.game.enterSalon(); const salon = h.session(), canvas = h.doc.activeElement!;
    h.pause(); h.button('Pular cena').click();
    replayJuiceVictory({ window: h.window, canvas }, salon, undefined, dt => h.game.update(dt));
    for (let frame = 0; frame < 120 && !salon.epilogue.frame; frame++) h.game.update(STEP);
    h.pause(); h.button('Pular cena').click();
    canvas.dispatch('pointerdown', { clientX: 100, clientY: 10, pointerType: 'touch', isPrimary: true });
    assert.equal(salon.state, 'paused'); assert.equal(h.doc.activeElement, h.button('Continuar'));
    h.button('Continuar').click();
    h.document.hidden = true; h.document.dispatch('visibilitychange');
    for (let frame = 0; frame < 100; frame++) h.game.update(100);
    assert.equal(h.session(), salon); assert.equal(salon.state, 'paused');
    h.document.hidden = false; h.document.dispatch('visibilitychange');
    h.button('Continuar').click();
    h.shell().dispatch('keydown', { key: 'Enter', target: canvas, repeat: true });
    assert.equal(h.session(), salon, 'A held confirm cannot dismiss a fresh result');
    h.shell().dispatch('keydown', { key: 'Enter', target: canvas, repeat: false });
    assert.equal(h.session(), undefined); assert.equal(h.game.state, 'playing');
    assert.equal(h.window.worldGame, h.game);
});
