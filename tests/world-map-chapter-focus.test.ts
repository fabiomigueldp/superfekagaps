import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldMapHud, type WorldMapHudState } from '../src/adventure/WorldMapHud';
import type { ChapterMapStage } from '../src/adventure/WorldChapterMap';
import { createDeliciaDom } from './helpers/deliciaDomHarness';

const stages: ChapterMapStage[] = [
    { id: 'delicia-1', label: '1', name: 'Cais', point: { x: 0, y: 0 }, open: true, completed: true, gate: '' },
    { id: 'delicia-2', label: '2', name: 'Pomar', point: { x: 1, y: 0 }, open: true, completed: false, gate: '' },
    { id: 'delicia-3', label: '3', name: 'Aqueduto', point: { x: 2, y: 0 }, open: false, completed: false, gate: 'Conclua 2.' },
];
function fixture(t: TestContext) {
    const dom = createDeliciaDom(); dom.install({ fetch: async () => ({ ok: false }) });
    const calls: string[] = [], hud = new WorldMapHud({ selectStage: () => calls.push('select'),
        selectWorld: () => calls.push('world'), enter: () => calls.push('enter'), skip: () => calls.push('skip'),
        overview: () => calls.push('overview'), menu: () => calls.push('menu') });
    document.body.append(hud.root);
    t.after(async () => { hud.dispose(); await dom.dispose(); });
    const state: WorldMapHudState = { world: 1, stage: 0, open: [true, false, false, false, false],
        completed: [false, false, false, false, false], seals: [0, 0, 0, 0, 0],
        globalProgress: { completed: 0, seals: 0 }, motionState: 'idle', canEnter: true, hint: '',
        worldAvailability: [true, false, false, false, false, false] };
    hud.update(state); hud.setVisible(true);
    let focused = 0; hud.root.addEventListener('focus', () => focused++);
    return { hud, state, calls, focuses: () => focused, open(selected: number) {
        hud.updateChapter('delicia', 'Império da Delícia', stages, selected);
        hud.positionChapterNodes(stages.map((_, index) => ({ x: 100 + index * 80, y: 160 })));
    } };
}

test('leaving a chapter hands focused completed, available and locked signs back to the map', t => {
    const { hud, state, calls, focuses, open } = fixture(t);
    for (let selected = 0; selected < stages.length; selected++) {
        open(selected); hud.chapterButtons[selected].focus();
        assert.equal(hud.controllerOwner(), 'delicia:idle');
        const before = focuses();
        hud.update({ ...state, overview: true });
        assert.equal(document.activeElement === hud.root, true, 'Focus must return to the visible map root.');
        assert.equal(focuses(), before + 1);
        assert.ok(hud.chapterButtons.every(button => button.hidden));
        assert.equal(hud.controllerOwner(), 'overview:idle');
        hud.update({ ...state, overview: true });
        assert.equal(focuses(), before + 1, 'Repeated rendering must not refocus the map.');
    }
    assert.deepEqual(calls, [], 'Focus handoff cannot enter or select any phase.');
});

test('chapter exit leaves focus on persistent controls and unrelated elements', t => {
    const { hud, state, calls, focuses, open } = fixture(t);
    const outside = document.createElement('input'); document.body.append(outside);
    const menu = hud.root.querySelector<HTMLButtonElement>('[aria-label="Menu do jogo"]')!;
    for (const focus of [hud.root, menu, outside]) {
        open(1); focus.focus(); const before = focuses();
        hud.update({ ...state, overview: true });
        assert.equal(document.activeElement === focus, true); assert.equal(focuses(), before);
        assert.equal(hud.controllerOwner(), focus === outside ? null : 'overview:idle');
    }
    assert.deepEqual(calls, []);
});
