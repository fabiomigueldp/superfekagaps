import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

type Menu = 'title' | 'settings' | 'paused';
type Modifiers = { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };

/** Production window-capture Input and WorldGame handlers. Native focus/activation
 * remain browser boundaries; this does not claim browser shortcut execution. */
function setup(t: TestContext, screen: Menu = 'title') {
    const h = sceneLifecycleBrowser(t);
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    t.after(() => game.dispose());
    const selected = () => (game as unknown as { menuSelection: number }).menuSelection;
    function key(type: 'keydown' | 'keyup', key: string, modifiers: Modifiers = {}, target = h.canvas, repeat = false) {
        return h.window.dispatch(type, {
            key, code: key === ' ' ? 'Space' : key === 'Shift' ? 'ShiftLeft' : key.length === 1 ? `Key${key.toUpperCase()}` : key,
            target, repeat, ...modifiers,
        });
    }
    function tap(value: string, modifiers: Modifiers = {}, target = h.canvas) {
        const event = key('keydown', value, modifiers, target);
        key('keyup', value, modifiers, target);
        return event;
    }
    game.render();
    if (screen === 'settings') {
        tap('ArrowDown'); tap('Enter');
    } else if (screen === 'paused') {
        game.load('1-1'); tap('Escape'); game.update(1000 / 60);
    }
    assert.equal(game.state, screen);
    game.render();
    return { ...h, game, selected, key, tap };
}

for (const screen of ['title', 'settings', 'paused'] as const) {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
        test(`${screen} leaves ${modifier} shortcuts to the browser without changing menu actions`, t => {
            const h = setup(t, screen);
            const before = { selection: h.selected(), save: structuredClone(h.game.store.save) };
            for (const key of ['s', 'w', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape']) {
                const event = h.tap(key, { [modifier]: true });
                assert.equal(event.defaultPrevented, false, `${modifier}+${key} must retain its browser default`);
                assert.equal(h.selected(), before.selection, `${modifier}+${key} must not choose another menu item`);
                assert.equal(h.game.state, screen, `${modifier}+${key} must not activate or close a menu`);
                assert.deepEqual(h.game.store.save, before.save, `${modifier}+${key} must not change options or progress`);
                h.game.input.update();
                assert.ok(Object.values(h.game.input.getState()).every(value => value === false),
                    `${modifier}+${key} must not queue gameplay or menu input`);
            }
        });
    }
}

test('plain arrows/W/S, Enter, Space and Escape keep their existing canvas menu actions', t => {
    const h = setup(t);
    assert.equal(h.tap('ArrowDown').defaultPrevented, true); assert.equal(h.selected(), 1);
    h.tap('s'); assert.equal(h.selected(), 2);
    h.tap('ArrowUp'); assert.equal(h.selected(), 1);
    h.tap('w'); assert.equal(h.selected(), 0);
    h.tap('ArrowDown'); h.tap('Enter'); h.game.render();
    assert.equal(h.game.state, 'settings');
    const before = h.game.store.save.preferences.music;
    h.tap(' ');
    assert.notEqual(h.game.store.save.preferences.music, before, 'Plain Space still activates the selected option');
    const activated = h.game.store.save.preferences.music;
    h.key('keydown', ' ', {}, h.canvas, true); h.key('keyup', ' ');
    assert.equal(h.game.store.save.preferences.music, activated, 'Auto-repeat never activates the option twice');
    h.tap('Escape'); assert.equal(h.game.state, 'title');
});

test('native button activation and editable controls keep their own keyboard defaults', t => {
    const h = setup(t), before = structuredClone(h.game.store.save);
    const button = h.document.createElement('button');
    h.body.append(button);
    for (const key of ['Enter', ' ']) {
        assert.equal(h.tap(key, {}, button).defaultPrevented, false, 'Native buttons own Enter/Space click synthesis');
        assert.equal(h.game.state, 'title'); assert.equal(h.selected(), 0);
    }
    for (const tag of ['input', 'textarea', 'select']) {
        const control = h.document.createElement(tag);
        // The shared lightweight DOM only implements button/link selectors.
        // Model the native editable boundary without replacing either handler.
        control.closest = selector => selector.includes(tag) ? control : null;
        control.matches = (selector?: string) => !!selector?.split(',').includes(tag);
        h.body.append(control);
        for (const key of ['s', 'w', 'ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape']) {
            assert.equal(h.tap(key, {}, control).defaultPrevented, false, `${tag} owns ${key}`);
            assert.equal(h.game.state, 'title'); assert.equal(h.selected(), 0);
        }
    }
    h.game.input.update();
    assert.ok(Object.values(h.game.input.getState()).every(value => value === false));
    assert.deepEqual(h.game.store.save, before);
});

test('modified menu shortcuts preserve simultaneous keyboard and action-source owners', t => {
    const h = setup(t);
    const jump = h.game.input.createActionSource(), direction = h.game.input.createActionSource();
    jump.press('jump'); direction.press('left');
    h.key('keydown', 'z'); h.key('keydown', 'Shift'); h.game.input.update();
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
        assert.equal(h.tap('s', modifiers).defaultPrevented, false);
        h.game.input.update();
        const state = h.game.input.getState();
        assert.equal(state.left, true); assert.equal(state.jump, true); assert.equal(state.run, true);
        assert.equal(state.jumpPressed, false); assert.equal(state.jumpReleased, false);
        assert.equal(h.selected(), 0);
    }
    jump.cancel(); direction.cancel(); h.game.input.update();
    assert.equal(h.game.input.getState().left, false);
    assert.equal(h.game.input.getState().jump, true, 'Cancelling the source must preserve the keyboard jump owner');
    assert.equal(h.game.input.getState().run, true);
    assert.equal(h.game.input.getState().jumpReleased, false);
    h.key('keyup', 'z'); h.key('keyup', 'Shift'); h.game.input.update();
    assert.equal(h.game.input.getState().jump, false); assert.equal(h.game.input.getState().run, false);
    assert.equal(h.game.input.getState().jumpReleased, true);
});
