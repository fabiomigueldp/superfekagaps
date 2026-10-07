/** Real campaign/session/input owners with only browser/device boundaries mocked.
 * Pixel appearance and native propagation are verified separately in a browser. */
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import type { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import { salonEntryButtonPosition } from '../src/adventure/factory/SalonEntryTransition';

const STEP = 1000 / 60;
function browser(t: TestContext, reducedMotion = false) {
    let dispose = () => {};
    t.after(() => dispose());
    const h = sceneLifecycleBrowser(t), writes: string[] = [];
    h.media.matches = reducedMotion;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => null, setItem: (key: string) => writes.push(key)
    } });
    const doc = h.document as unknown as { activeElement: LifecycleElement | null };
    const decorate = (element: LifecycleElement) => {
        element.focus = () => { doc.activeElement = element; };
        Object.assign(element, { open: false, showModal() { this.open = true; }, close() { this.open = false; } });
        Object.defineProperty(element, 'isConnected', { get: () => !!element.parent });
        return element;
    };
    const create = h.document.createElement;
    h.document.createElement = tag => decorate(create(tag)); decorate(h.canvas);
    const require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    t.after(() => { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; });
    const { FactoryCampaign } = require('../src/adventure/factory/FactoryCampaign.ts') as typeof import('../src/adventure/factory/FactoryCampaign');
    const game = new FactoryCampaign(h.canvas as unknown as HTMLCanvasElement);
    dispose = () => game.dispose();
    game.load(FACTORY_SALON.stage);
    Object.assign(game.player.data.position, { x: FACTORY_SALON.door.x, y: FACTORY_SALON.support.y - game.player.data.height });
    game.player.data.isGrounded = true;
    game.update(STEP); game.render();
    const entrance = h.body.children.find(child => child.className.split(' ').includes('factory-salon-enter'))!;
    const session = () => (game as unknown as { salon?: FactorySalonSession }).salon;
    const shell = () => h.body.children.find(child => child.className === 'factory-salon');
    const tick = (n: number) => { for (let i = 0; i < n; i++) game.update(STEP); };
    const key = (key: string, target = h.canvas, repeat = false) => h.window.dispatch('keydown', {
        target, key, code: key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key, repeat
    });
    const startWithKey = () => h.canvas.dispatch('keydown', { key: 'e', code: 'KeyE', repeat: false });
    return { ...h, game, doc, writes, entrance, session, shell, tick, key, startWithKey };
}
function snapshot(game: ReturnType<typeof browser>['game']) {
    return JSON.stringify({ player: game.player.data, elapsed: game.elapsed, time: game.time,
        coins: game.coins, objects: game.objects, save: game.store.save });
}

test('native entrance button locks only the bounded handoff and never advances either scene or progression', t => {
    const h = browser(t), original = snapshot(h.game), writes = h.writes.length;
    assert.equal(h.entrance.hidden, false); h.entrance.click();
    assert.equal(h.session(), undefined, 'the real button animates instead of instantly mounting a modal');
    assert.equal(h.game.state, 'playing', 'outgoing frame must not render the campaign pause menu');
    assert.equal(h.entrance.hidden, true);
    h.tick(25); h.game.render();
    assert.equal(h.session(), undefined); assert.equal(snapshot(h.game), original);
    h.tick(1); const salon = h.session()!;
    assert.ok(salon); assert.equal(salon.labMode, 'intro'); assert.equal(h.game.state, 'paused');
    const salonTime = salon.time; h.tick(10);
    assert.equal(salon.time, salonTime, 'incoming fade cannot consume intro time or the mandatory pose');
    assert.equal(snapshot(h.game), original); assert.equal(h.writes.length, writes);
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.passage), false);
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.victory), false);
    h.tick(1); assert.ok(salon.time > salonTime, 'input/simulation lock is released at the deadline');
    h.game.leaveSalon(); assert.equal(snapshot(h.game), original);
    assert.equal(h.doc.activeElement, h.canvas);
});

test('native button follows the painted doorway plaque instead of the viewport bottom', t => {
    const h = browser(t);
    Object.assign(h.game.camera, { x: 1630, y: 72 }); h.game.render();
    const expected = salonEntryButtonPosition(h.canvas.getBoundingClientRect(), h.game.camera);
    assert.equal(h.entrance.style.left, `${expected.left}px`);
    assert.equal(h.entrance.style.top, `${expected.top}px`);
    assert.equal(h.entrance.style.width, `${expected.width}px`);
    assert.equal(h.entrance.style.height, `${expected.height}px`);
    assert.ok(expected.width >= 44 && expected.height >= 44);
    assert.ok(h.entrance.className.includes('world-entrance'));
    assert.match(h.entrance.getAttribute('aria-label')!, /Apresentar-se|Revisitar/);
});

test('ordinary running approach exposes the cue for at least twenty consecutive fixed steps', t => {
    const h = browser(t);
    Object.assign(h.game.player.data.position, { x: 1704, y: FACTORY_SALON.support.y - h.game.player.data.height });
    h.game.player.data.velocity = { x: 0, y: 0 };
    h.game.player.data.isGrounded = true;
    h.key('ArrowRight');
    h.window.dispatch('keydown', { target: h.canvas, key: 'Shift', code: 'ShiftLeft', repeat: false });
    const visible: number[] = [];
    for (let frame = 0; frame < 70; frame++) {
        h.game.update(STEP);
        if (!h.entrance.hidden) visible.push(frame);
    }
    assert.ok(visible.length >= 20, `real running approach gives ${visible.length} usable frames`);
    assert.equal(visible[visible.length - 1] - visible[0] + 1, visible.length, 'one stable grounded action window');
    assert.equal(h.session(), undefined, 'passing the door cannot auto-enter or grant progression');
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.passage), false);
});

test('real E entry, repeat suppression and a fresh skip never skip the salon presentation', t => {
    const h = browser(t); h.startWithKey(); assert.equal(h.session(), undefined);
    h.key('e', h.canvas, true); assert.equal(h.session(), undefined, 'held E cannot skip');
    h.key('e'); const salon = h.session()!;
    assert.ok(salon); assert.equal(salon.labMode, 'intro');
    const canvas = h.shell()!.children.find(child => child.tagName === 'CANVAS')!;
    h.key('Enter', canvas); h.tick(1);
    assert.equal(salon.labMode, 'intro'); assert.equal(salon.presentedAtChampionship, false);
    assert.equal(h.game.store.save.seen.includes(FACTORY_SALON.passage), false);
    h.game.leaveSalon(); h.game.update(STEP); h.entrance.click();
    assert.equal(h.session(), undefined, 'reentry owns a fresh departure'); h.tick(36);
    assert.ok(h.session()); assert.notEqual(h.session(), salon);
});

test('modified E shortcuts do not begin a salon entry or consume browser activation', t => {
    const h = browser(t), before = snapshot(h.game), writes = h.writes.length;
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
        const event = h.canvas.dispatch('keydown', { key: 'e', code: 'KeyE', repeat: false, [modifier]: true });
        assert.equal(event.defaultPrevented, false, `${modifier}+E remains a browser shortcut`);
        assert.equal(h.entrance.hidden, false, 'No transition hides the available entrance');
        assert.equal(h.session(), undefined);
        assert.equal((h.game as unknown as { entry?: unknown }).entry, undefined);
        assert.equal(snapshot(h.game), before); assert.equal(h.writes.length, writes);
    }
    h.startWithKey();
    assert.equal(h.entrance.hidden, true, 'An ordinary fresh E still starts the entry');
    h.tick(36); assert.ok(h.session());
});

test('Escape cancels departure with exact campaign data and no delayed modal', t => {
    const h = browser(t), before = snapshot(h.game); h.entrance.click(); h.tick(10);
    h.key('Escape'); assert.equal(h.session(), undefined); assert.equal(h.game.state, 'playing');
    assert.equal(snapshot(h.game), before);
    assert.ok(Object.values(h.game.input.getState()).every(value => value === false));
    h.game.render(); assert.equal(h.shell(), undefined);
});

for (const event of ['blur', 'visibilitychange']) test(`${event} cancels departure, preserves pause and cannot mount behind lost focus`, t => {
        const h = browser(t), before = snapshot(h.game); h.entrance.click(); h.tick(12);
        if (event === 'blur') h.window.dispatch('blur');
        else { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
        h.tick(120);
        assert.equal(h.session(), undefined); assert.equal(h.shell(), undefined);
        assert.equal(h.game.state, 'paused'); assert.equal(snapshot(h.game), before);
        h.game.dispose();
});

test('reduced motion releases after the short fade without running campaign or granting a pose', t => {
    const h = browser(t, true), before = snapshot(h.game); h.entrance.click();
    h.tick(4); assert.equal(h.session(), undefined);
    h.tick(1); assert.ok(h.session()); const time = h.session()!.time;
    h.tick(6); assert.equal(h.session()!.time, time); assert.equal(snapshot(h.game), before);
    h.tick(1); assert.ok(h.session()!.time > time);
    assert.equal(h.session()!.presentedAtChampionship, false);
});

for (const steps of [10, 28]) test(`disposing at frame ${steps} releases listeners and cannot create a later session`, t => {
        const h = browser(t); h.game.start(); h.entrance.click(); h.tick(steps);
        h.game.dispose(); const draws = h.drawCount();
        h.tick(100); h.key('e'); h.entrance.click(); h.frame();
        assert.equal(h.shell(), undefined); assert.equal(h.frames.size, 0);
        assert.equal(h.listenerCount(), 0); assert.equal(h.drawCount(), draws);
});
