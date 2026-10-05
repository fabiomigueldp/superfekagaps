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
