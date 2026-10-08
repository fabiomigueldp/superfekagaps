import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { ISLANDS, STAGES } from '../src/adventure/campaign';
import { ProgressStore, SAVE_KEY } from '../src/adventure/progress';
import { WorldGame } from '../src/adventure/WorldGame';

function harness(t: TestContext) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: class {} });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'HTMLElement', original);
        else Reflect.deleteProperty(globalThis, 'HTMLElement');
    });
    const writes: string[] = [], audio: string[] = [], saved = new Map<string, string>();
    const store = new ProgressStore({ getItem: key => saved.get(key) ?? null,
        setItem(key, value) { assert.equal(key, SAVE_KEY); saved.set(key, value); writes.push(value); } });
    const game = Object.create(WorldGame.prototype) as any;
    const context = { fillStyle: '', fillRect() {} };
    Object.assign(game, { store, state: 'title', stage: STAGES[0], selection: 17, time: 0, toast: '', toastTimer: 0,
        buttons: [], menuSelection: 0, galleryWorld: 0,
        input: { reset() {}, setMenuMode() {} },
        audio: { unlock() {}, cancelSpeech() {}, setDying() {}, select() {}, pause(value: boolean) { audio.push(`pause:${value}`); } },
        art: { background() {}, atlas: { draw() {} } },
        titleScene: { draw() {} },
        renderer: { startScene() {}, getContext: () => context, present() {} },
        mapView: { hide() {} },
        begin() { assert.fail('Gallery navigation must not start the adventure.'); },
        load() { assert.fail('Gallery navigation must not load a stage.'); } });
    function key(key: string, repeat = false) {
        let prevented = false;
        game.menuKey({ key, repeat, target: null, preventDefault() { prevented = true; } });
        return prevented;
    }
    function openGallery() {
        game.render();
        const galleryIndex = game.buttons.findIndex((button: { label: string }) => button.label === 'GALERIA');
        assert.ok(galleryIndex >= 0, 'The title exposes a labeled Gallery action.');
        for (let step = 0; game.menuSelection !== galleryIndex && step < game.buttons.length; step++) {
            assert.equal(key('ArrowDown'), true, 'The title accepts keyboard navigation.');
        }
        assert.equal(game.menuSelection, galleryIndex, 'Keyboard navigation reaches Gallery.');
        assert.equal(key('Enter'), true); game.render();
        assert.equal(game.state, 'gallery'); assert.equal(game.galleryWorld, 0); assert.equal(game.buttons.length, 8);
    }
    return { game, store, writes, audio, key, openGallery };
}

function sealIds(world: number) {
    return STAGES.filter(stage => stage.world === world).flatMap(stage => stage.pickups.filter(pickup => pickup.kind === 'seal').map(pickup => pickup.id));
}

test('gallery grid Escape matches its visible back button and keyboard activation without starting or saving', async t => {
    for (const action of ['Escape', 'button', 'Enter'] as const) await t.test(action, child => {
        const h = harness(child);
        h.store.save.selected = '3-4'; h.store.save.checkpoint = { stage: '3-4', index: 1, helmet: true };
        h.store.save.completed = ['1-1']; h.store.save.seen = ['dialogue:visited'];
        const before = structuredClone(h.store.save);
        h.openGallery();
        if (action === 'button') h.game.buttons[7].run();
        else { h.game.menuSelection = 7; assert.equal(h.key(action), true); }
        assert.equal(h.game.state, 'title'); assert.equal(h.game.galleryWorld, 0);
        assert.deepEqual(h.game.buttons, [], 'Discard gallery actions before the title is painted.');
        h.key('Enter'); assert.equal(h.game.state, 'title', 'An input before the next frame cannot activate a stale button.');
        assert.deepEqual(h.store.save, before); assert.deepEqual(h.writes, []); assert.equal(h.game.selection, 17);
        h.openGallery(); assert.equal(h.game.menuSelection, 0, 'Reopening starts on the gallery grid.');
    });
});

test('every island and Guaira detail returns to its own grid selection through Escape, the visible button or Enter', async t => {
    for (const action of ['Escape', 'button', 'Enter'] as const) await t.test(action, child => {
        const h = harness(child);
        h.store.save.seals = ISLANDS.flatMap((_, index) => sealIds(index + 1));
        const before = structuredClone(h.store.save);
        h.openGallery();
        for (let index = 0; index < ISLANDS.length + 1; index++) {
            h.game.buttons[index].run(); h.game.render();
            assert.equal(h.game.galleryWorld, index + 1); assert.equal(h.game.buttons.length, 1);
            assert.equal(h.key('Escape', true), false); assert.equal(h.game.galleryWorld, index + 1, 'Held Escape does not navigate.');
            if (action === 'button') h.game.buttons[0].run(); else h.key(action);
            assert.equal(h.game.state, 'gallery'); assert.equal(h.game.galleryWorld, 0); assert.equal(h.game.menuSelection, index);
            assert.deepEqual(h.game.buttons, [], 'Remove the old detail callback before accepting another action.');
            h.key('Enter'); assert.equal(h.game.state, 'gallery'); assert.equal(h.game.galleryWorld, 0);
            h.game.render(); assert.equal(h.game.buttons.length, 8);
            h.key('Enter'); h.game.render(); assert.equal(h.game.galleryWorld, index + 1, 'Enter reopens the island that was just viewed.');
            h.key('Escape'); h.game.render();
            assert.deepEqual(h.store.save, before); assert.deepEqual(h.writes, []);
        }
        h.key('Escape'); assert.equal(h.game.state, 'title'); assert.equal(h.game.selection, 17);
        assert.deepEqual(h.store.save, before); assert.deepEqual(h.writes, []);
    });
});

test('gallery remains available before starting the adventure and preserves the twelve-seal gate for each island', t => {
    const h = harness(t); h.openGallery();
    for (let index = 0; index < ISLANDS.length; index++) for (const count of [0, 11]) {
        h.store.save.seals = sealIds(index + 1).slice(0, count); h.game.render();
        const before = structuredClone(h.store.save);
        h.game.menuSelection = index; h.key('Enter');
        assert.equal(h.game.state, 'gallery'); assert.equal(h.game.galleryWorld, 0);
        assert.equal(h.game.toast, 'Encontre os 12 selos desta ilha.'); assert.equal(h.game.toastTimer, 1800);
        h.game.buttons[index].run(); assert.equal(h.game.galleryWorld, 0);
        assert.deepEqual(h.store.save, before); assert.deepEqual(h.writes, []);
    }
    h.key('Escape'); assert.equal(h.game.state, 'title'); assert.deepEqual(h.store.save.seen, []);
});

test('Escape retains map exit, paused resume and both settings return paths', t => {
    const h = harness(t), before = structuredClone(h.store.save);
    h.game.state = 'map'; h.key('Escape'); assert.equal(h.game.state, 'title'); assert.deepEqual(h.writes, []);
    h.game.state = 'paused'; h.key('Escape'); assert.equal(h.game.state, 'playing'); assert.deepEqual(h.audio, ['pause:false']);
    assert.equal(h.key('Escape'), false, 'Playing still leaves pause handling to gameplay input.');
    assert.equal(h.game.state, 'playing'); assert.deepEqual(h.writes, []);
    for (const state of ['title', 'paused']) {
        h.game.settings(state); h.audio.length = 0; h.key('Escape');
        assert.equal(h.game.state, state); assert.deepEqual(h.audio, state === 'paused' ? ['pause:true'] : []);
    }
    assert.equal(h.writes.length, 2); assert.deepEqual(h.store.save, before);
});

test('Escape retains dialogue reveal and dismissal without opening the map', t => {
    const h = harness(t);
    h.game.state = 'dialogue'; h.game.dialog = { id: 'gallery-regression-dialogue', text: 'Uma grande aventura' }; h.game.dialogueTime = 0;
    h.key('Escape'); assert.equal(h.game.state, 'dialogue'); assert.equal(h.game.dialogueTime, 10000); assert.deepEqual(h.writes, []);
    h.key('Escape'); assert.equal(h.game.state, 'playing'); assert.equal(h.game.dialog, null);
    assert.deepEqual(h.store.save.seen, ['dialogue:gallery-regression-dialogue']); assert.equal(h.writes.length, 1);
});

test('Escape retains the existing title, intro and ending route to the saved map arrival', t => {
    const h = harness(t); h.store.save.selected = '3-4';
    const before = structuredClone(h.store.save);
    for (const state of ['title', 'intro', 'ending']) {
        h.game.state = state; h.key('Escape');
        assert.equal(h.game.state, 'map'); assert.equal(h.game.selection, 13); assert.deepEqual(h.store.save, before);
    }
    assert.equal(h.writes.length, 3);
});
