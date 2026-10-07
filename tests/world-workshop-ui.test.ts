import assert from 'node:assert/strict';
import test from 'node:test';
import { drawWorkshopHud, WORLD_HUD_HEIGHT, workshopButton, worldHudLabels } from '../src/adventure/WorldWorkshopUI';
import { WorldHudAccessibility } from '../src/adventure/WorldHudAccessibility';
import { STAGES } from '../src/adventure/campaign';
import { textWidth, wrapText } from '../src/graphics/BitmapFont';
import { WorldGame } from '../src/adventure/WorldGame';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

test('compact HUD uses only integer pixels within 16 rows and leaves the central sky clear', () => {
    const draws: number[][] = [];
    const c = { fillStyle: '', fillRect: (...values: number[]) => draws.push(values) } as unknown as CanvasRenderingContext2D;
    drawWorkshopHud(c, '1-3', 24, 1);
    assert.equal(WORLD_HUD_HEIGHT, 16);
    assert.ok(draws.every(rect => rect.every(Number.isInteger)));
    assert.ok(draws.every(([x, y, w, h]) => y >= 0 && y + h <= 16 && x >= 0 && x + w <= 320));
    assert.ok(draws.every(([x, , w]) => x + w <= 164 || x >= 300), 'No full-width bar across the sky');
    assert.deepEqual(worldHudLabels('1-3', 24, 1), { stage: '1-3', coins: '024', seals: '1/3' });
});

test('focused pixel buttons include the original left pointer and a bounded workshop tab', () => {
    const paint = (selected: boolean) => {
        const draws: number[][] = [];
        workshopButton({ fillStyle: '', fillRect: (...values: number[]) => draws.push(values) } as unknown as CanvasRenderingContext2D,
            'CONTINUAR', 76, 75, 168, 24, selected);
        assert.ok(draws.every(([x, y, w, h]) => x >= (selected ? 69 : 76) && x + w <= 244 && y >= 75 && y + h <= 99));
        return draws;
    };
    const plain = paint(false), focused = paint(true);
    assert.ok(focused.length > plain.length + 10, 'Selection adds a triangular arrow and diagonal tab, not just color');
});

test('pause prioritizes play/options/map; save actions remain available in existing options', t => {
    const h = sceneLifecycleBrowser(t), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    t.after(() => game.dispose());
    game.load('1-1');
    const internal = game as unknown as { pause(): void; buttons: Array<{ label: string; ariaLabel?: string; run(): void; nativeActivation?: boolean }> };
    const state = JSON.stringify({ player: game.player.data, save: game.store.save, coins: game.coins, elapsed: game.elapsed });
    internal.pause(); game.render();
    assert.deepEqual(internal.buttons.map(b => b.label), ['CONTINUAR', 'OPÇÕES', 'VOLTAR AO MAPA']);
    internal.buttons[1].run(); game.render();
    assert.equal(game.state, 'settings');
    assert.deepEqual(internal.buttons.filter(b => b.nativeActivation).map(b => b.ariaLabel), ['EXPORTAR PROGRESSO', 'IMPORTAR PROGRESSO']);
    internal.buttons.at(-1)!.run(); game.render();
    assert.equal(game.state, 'paused');
    assert.equal(JSON.stringify({ player: game.player.data, save: game.store.save, coins: game.coins, elapsed: game.elapsed }), state);
});

test('small-screen status uses existing letterbox space, preserves labels, and exposes a real 44 px pause control', t => {
    const h = sceneLifecycleBrowser(t); let pauses = 0;
    h.canvas.getBoundingClientRect = () => ({ left: 20, top: 230, width: 320, height: 180, x: 20, y: 230, right: 340, bottom: 410 });
    const hud = new WorldHudAccessibility(h.canvas as unknown as HTMLCanvasElement, () => { pauses++; });
    t.after(() => hud.dispose());
    hud.sync(true, '1-1', 24, 1, true);
    assert.equal(hud.showsReadableStrip, true);
    assert.equal(hud.root.style.top, '182px'); assert.equal(hud.pause.style.width, '44px'); assert.equal(hud.pause.style.height, '44px');
    assert.equal(hud.pause.getAttribute('aria-label'), 'Pausar');
    assert.equal((hud.root.children[0] as unknown as LifecycleElement).textContent, '1-1 · 24 moedas · 1/3 selos · Capacete');
    (hud.pause as unknown as LifecycleElement).click(); assert.equal(pauses, 1);
    hud.sync(false, '1-1', 24, 1, true);
    assert.equal(hud.showsReadableStrip, false); assert.equal(hud.root.style.display, 'none');
    (hud.pause as unknown as LifecycleElement).click(); assert.equal(pauses, 1, 'Hidden pause cannot act');
    hud.sync(true, '1-1', 24, 1, false);
    assert.equal((hud.root.children[0] as unknown as LifecycleElement).textContent.includes('Capacete'), false);
    (h.canvas as unknown as HTMLCanvasElement).inert = true; hud.sync(true, '1-1', 24, 1, false);
    assert.equal(hud.root.hidden, true); assert.equal(hud.showsReadableStrip, false);
    hud.dispose(); assert.equal((hud.root as unknown as LifecycleElement).parent, null);
});


test('every campaign stage name fits in the pause caption without ellipsis or action overlap', () => {
    for (const stage of STAGES) {
        const caption = `${stage.id} · ${stage.name}`, lines = wrapText(caption, 132);
        assert.equal(lines.join(' '), caption);
        assert.ok(lines.every(line => textWidth(line) <= 132));
        assert.ok(lines.length <= 3);
        assert.ok(136 + (lines.length - 1) * 10 + 7 < 180);
    }
});

test('native HUD Pause hands focus to Continue and respects an intervening external focus owner', t => {
    const h = sceneLifecycleBrowser(t);
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const decorate = (element: LifecycleElement) => {
        element.focus = () => { if (doc.activeElement === element) return; doc.activeElement?.dispatch('blur'); doc.activeElement = element; element.dispatch('focus'); };
        return element;
    };
    const create = doc.createElement; doc.createElement = tag => decorate(create(tag));
    decorate(h.canvas);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem() {} } });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement);
    t.after(() => game.dispose());
    const internal = game as unknown as { hudAccessibility: WorldHudAccessibility; menuAccessibility: { root: HTMLElement } };
    const menu = internal.menuAccessibility.root as unknown as LifecycleElement;
    const pause = internal.hudAccessibility.pause as unknown as LifecycleElement;
    game.load('1-1'); game.render(); h.canvas.focus();
    const state = JSON.stringify({ player: game.player.data, save: game.store.save, elapsed: game.elapsed });
    pause.focus(); pause.click();
    assert.equal(game.state, 'paused'); assert.equal(doc.activeElement, h.canvas, 'Bridge ownership stays with the canvas until the menu is painted');
    game.render();
    assert.equal(menu.children[0].textContent, 'CONTINUAR'); assert.equal(doc.activeElement, menu.children[0]);
    assert.equal(internal.hudAccessibility.root.hidden, true);
    assert.equal(JSON.stringify({ player: game.player.data, save: game.store.save, elapsed: game.elapsed }), state);
    assert.ok(Object.values(game.input.getState()).every(value => value === false));
    menu.children[0].click(); game.render();
    assert.equal(game.state, 'playing'); assert.equal(doc.activeElement, h.canvas);
    pause.focus(); pause.click();
    const outside = doc.createElement('input'); h.body.append(outside); outside.focus(); game.render();
    assert.equal(game.state, 'paused'); assert.equal(doc.activeElement, outside, 'A newer external owner is never displaced');
    game.render(); assert.equal(doc.activeElement, outside, 'The handoff is one-shot, not a delayed focus steal');
});
