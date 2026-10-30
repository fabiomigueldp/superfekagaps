import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { WorldGame } from '../src/adventure/WorldGame';
import { controlPreferences, DEFAULT_KEYS } from '../src/engine/ControlPreferences';
import { GuairaMapModel, guairaArrivalFromSearch, guairaReturnContextFromSearch, parseGuairaMetadata } from '../src/adventure/experimental/guaira/GuairaMapModel';
import { guairaMapPresentation } from '../src/adventure/experimental/guaira/GuairaMapPresentation';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import traversal from './helpers/guairaTraversalReplay.json';
import bull from './helpers/guairaLabReplay.json';
import ascent from './helpers/guairaAscentReplay.json';
import mayor from './helpers/guairaMayorReplay.json';

const metadata = parseGuairaMetadata(JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8')))!;
function returnMap(href: string) {
    const search = new URL(href, 'https://example.test/').search;
    return new GuairaMapModel(metadata, guairaArrivalFromSearch(search), guairaReturnContextFromSearch(search));
}
function play(h: Pick<ReturnType<typeof sceneLifecycleBrowser>, 'window' | 'canvas'>, game: WorldGame,
    recording: { stepMs: number; frames: number; runs: unknown[] }) {
    let held = new Set<string>(), frame = 0;
    try {
        for (const [count, keys] of recording.runs as [number, string[]][]) {
            const next = new Set(keys);
            for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            held = next;
            for (let n = 0; n < count; n++) { game.update(recording.stepMs); frame++; assert.equal(game.player.data.isDead, false); }
        }
    } finally {
        for (const code of held) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
    }
    assert.equal(frame, recording.frames); assert.deepEqual(game.store.save.completed, []);
}

test('the four real routes form an explicit experimental journey with truthful visit returns', async t => {
    // Browser-owned module listeners must be installed after the DOM exists and
    // keep that same window through all four native scenes in this journey.
    const h = sceneLifecycleBrowser(t);
    let storageReads = 0;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() {
        storageReads++; assert.fail('An ephemeral journey must not access campaign storage');
    } });
    const [{ GuairaTraversal }, { GuairaBullLab }, { GuairaAscent }, { GuairaMayorLab }] = await Promise.all([
        import('../src/adventure/experimental/guaira/GuairaTraversal'),
        import('../src/adventure/experimental/guaira/GuairaBullLab'),
        import('../src/adventure/experimental/guaira/GuairaAscent'),
        import('../src/adventure/experimental/guaira/GuairaMayorLab'),
    ]);
    const listeners = h.listenerCount();
    assert.deepEqual(controlPreferences.keys, DEFAULT_KEYS);
    t.after(() => {
        assert.equal(storageReads, 0);
        assert.equal(h.listenerCount(), listeners, 'Disposed scenes leave only the original window-owned listeners');
        assert.equal(h.frames.size, 0);
        assert.deepEqual(controlPreferences.keys, DEFAULT_KEYS);
    });
    let map = returnMap('./guaira.html');
    assert.equal(map.enterHref(), './guaira-travessia.html');
    await t.test('traversal irrigates rice, then the map walks to the corral before entry', t => {
        const game = h.create(GuairaTraversal); t.after(() => game.dispose()); play(h, game, traversal);
        assert.equal(game.finished, true); map = returnMap(game.mapReturnHref);
        assert.equal(map.returnContext, 'traversal-clear'); assert.equal(map.enterHref(), null);
        assert.match(guairaMapPresentation(map).status, /Travessia concluída/);
        map.walkToCorral(); assert.equal(map.enterHref(), null);
        while (map.moving) map.tick(1 / 60);
        assert.equal(map.enterHref(), './guaira-lab.html');
    });
    await t.test('bull victory recommends the ascent from the same corral, without claiming the water is fixed', t => {
        const game = h.create(GuairaBullLab); t.after(() => game.dispose()); play(h, game, bull);
        assert.equal(game.canAdvanceToAscent, true); map = returnMap(game.mapReturnHref);
        assert.equal(map.returnContext, 'bull-clear'); assert.equal(map.moving, false);
        assert.equal(map.enterHref(), './guaira-subida.html');
        assert.doesNotMatch(guairaMapPresentation(map).status, /água.*liberada/);
    });
    await t.test('ascent exposes the closed district branch and returns to the optional mayor encounter', t => {
        const game = h.create(GuairaAscent); t.after(() => game.dispose()); play(h, game, ascent);
        assert.equal(game.finished, true); map = returnMap(game.mapReturnHref);
        assert.equal(map.returnContext, 'ascent-clear'); assert.equal(map.enterHref(), './guaira-prefeito.html');
        assert.match(guairaMapPresentation(map).description, /ramal do bairro está fechado/);
    });
    await t.test('mayor victory is acknowledged on this visit and repeating leads to an ordinary new encounter', t => {
        const game = h.create(GuairaMayorLab); t.after(() => game.dispose()); play(h, game, mayor);
        assert.equal(game.mayor.publicWaterOpen, true); map = returnMap(game.mapReturnHref);
        assert.equal(map.returnContext, 'mayor-clear'); assert.equal(guairaMapPresentation(map).action, 'REPETIR');
        assert.equal(map.enterHref(), './guaira-prefeito.html');
        map.returnToCorral(); assert.equal(map.returnContext, null); assert.equal(map.enterHref(), null);
        while (map.moving) map.tick(1 / 60);
        assert.equal(map.enterHref(), './guaira-lab.html');
    });
});
