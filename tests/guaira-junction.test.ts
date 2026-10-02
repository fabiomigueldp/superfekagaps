import assert from 'node:assert/strict';
import test from 'node:test';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { WorldObjects, WorldLevel } from '../src/adventure/WorldPhysics';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { GuairaJunction, GUAIRA_JUNCTION as G, guairaJunctionStage } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { JunctionRouting } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import { guairaJunctionBrowser } from './helpers/guairaJunctionHarness';
import recording from './helpers/guairaJunctionReplay.json';

const feet = (g: GuairaJunction) => g.player.data.position.y + g.player.data.height;
const snapshot = (g: GuairaJunction) => structuredClone({ player: g.player.data, objects: g.objects, routing: g.routing,
    time: g.time, elapsed: g.elapsed, finished: g.finished, checkpoint: g.store.save.checkpoint });
type Harness = ReturnType<typeof guairaJunctionBrowser>;

function replay(h: Harness, game: GuairaJunction, stopAtCheckpoint = false) {
    let frames = 0, carriedA = 0, carriedB = 0, warnings = 0, pounds = 0;
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let i = 0; i < count; i++, frames++) {
            game.update(recording.stepMs);
            const p = game.player.data;
            assert.equal(p.isDead, false, `alive at frame ${frames}`);
            assert.equal(p.hasHelmet, true, `unhurt at frame ${frames}`);
            assert.notEqual(game.objects.get(G.liftAId)!.active, game.objects.get(G.liftBId)!.active, 'exactly one supply');
            if (game.routing.warning) warnings++;
            if (game.player.isGroundPoundActive()) pounds++;
            for (const id of [G.liftAId, G.liftBId]) {
                const b = game.objects.get(id)!;
                if (p.isGrounded && Math.abs(feet(game) - b.y) < .001 && b.py !== b.y && p.position.x >= b.x && p.position.x + p.width <= b.x + b.width) {
                    if (id === G.liftAId) carriedA++; else carriedB++;
                }
            }
            if (stopAtCheckpoint && game.store.save.checkpoint) { h.keys([]); return { frames, carriedA, carriedB, warnings, pounds }; }
        }
    }
    return { frames, carriedA, carriedB, warnings, pounds };
}

function middlePlate(h: Harness, g: GuairaJunction) {
    // From the restored checkpoint, normal walking reaches the second real plate.
    h.run(g, 26, ['ArrowRight']); h.run(g, 20);
}
function pound(h: Harness, g: GuairaJunction) { h.run(g, 14, ['Space']); h.run(g, 35, ['ArrowDown']); }

test('isolated authored junction uses native objects/player/input and never reads storage or expands campaign', t => {
    const before = structuredClone(STAGES), worlds = structuredClone(ISLANDS), h = guairaJunctionBrowser(t), g = h.create();
    assert.ok(g.player instanceof Player); assert.ok(g.input instanceof Input); assert.ok(g.objects instanceof WorldObjects); assert.ok(g.level instanceof WorldLevel);
    assert.deepEqual(g.stage.foes, []); assert.deepEqual(g.stage.exits, []); assert.equal(g.boss, null);
    assert.equal(g.player.data.position.x, 48); assert.equal(feet(g), G.startY);
    assert.equal(g.objects.get(G.liftAId)!.y, G.dockY); assert.equal(g.objects.get(G.liftBId)!.y, G.terraceY);
    const changed = guairaJunctionStage(); changed.level.tiles[25][0] = 0;
    assert.notEqual(guairaJunctionStage().level.tiles[25][0], 0);
    g.render(); assert.ok(h.canvas.drawCalls > 0); assert.equal(g.mapReturnHref, './guaira.html?at=town');
    assert.deepEqual(STAGES, before); assert.deepEqual(ISLANDS, worlds);
});

for (const touch of [false, true]) test(`${touch ? 'native touch' : 'keyboard'} completes by two sentadas and actually rides both native lifts`, t => {
    const h = guairaJunctionBrowser(t, { touch }), g = h.create();
    let campaignFinishes = 0; (g as unknown as { complete(): void }).complete = () => { campaignFinishes++; };
    const result = replay(h, g);
    assert.equal(result.frames, recording.frames); assert.ok(result.carriedA > 70); assert.ok(result.carriedB > 100);
    assert.ok(result.warnings >= 46); assert.ok(result.pounds > 0); assert.equal(g.finished, true);
    assert.equal(g.store.save.checkpoint?.index, 0); assert.equal(feet(g), G.terraceY);
    assert.equal(g.mapReturnHref, './guaira.html?at=rice&visit=junction-clear'); assert.equal(g.coins, 0); assert.equal(campaignFinishes, 0);
    assert.deepEqual(g.store.save.completed, []); assert.deepEqual(g.store.save.times, {});
    const done = snapshot(g); h.run(g, 120, ['ArrowLeft', 'Space', 'ArrowDown']); g.render();
    assert.deepEqual(snapshot(g), done); assert.match(h.status.textContent, /Pátio concluído/);
    h.keys([]); g.load(G.id); replay(h, g); assert.deepEqual(snapshot(g), done, 'repeatable run');
});

test('requests warn before changing supply; a reversal can cancel the request without moving a deck', () => {
    const route = new JunctionRouting(); route.step('a', 16);
    assert.equal(route.supplied, 'b'); assert.equal(route.warningRemaining, G.warningMs);
    route.step('a', 200); assert.equal(route.supplied, 'b'); assert.equal(route.warning, true);
    route.step('b', 16); assert.equal(route.supplied, 'b'); assert.equal(route.warning, false);
    route.step('a', 16); route.step('a', 399); assert.equal(route.supplied, 'b');
    route.step('a', 1); assert.equal(route.supplied, 'a'); assert.equal(route.warning, false);
});

test('ordinary jumps cannot operate the plates; running across the unsupported first gap lands on dry recovery', t => {
    const h = guairaJunctionBrowser(t), g = h.create();
    h.run(g, 60, ['ArrowRight']); h.run(g, 50, ['Space']);
    assert.equal(g.objects.get(G.entryPlateId)!.active, false); assert.equal(g.routing.selected, 'b');
    for (const approach of [45, 47, 49, 51, 53, 55]) {
        h.keys([]); g.load(G.id); h.run(g, approach, ['ArrowRight', 'ShiftLeft']);
        h.run(g, 100, ['ArrowRight', 'ShiftLeft', 'Space']);
        assert.equal(g.store.save.checkpoint, null); assert.equal(g.finished, false);
        assert.equal(g.player.data.isDead, false); assert.equal(g.player.data.hasHelmet, true);
        assert.ok(feet(g) >= G.dockY, 'unsupplied A cannot reach checkpoint bank');
    }
});

test('jumping under the middle flag cannot capture or safe-return past the unsupported A route', t => {
    const h = guairaJunctionBrowser(t), g = h.create();
    // With an earlier dock at y368, this native route reached the middle flag's
    // proximity box from below. Flush dry-floor docks remove that false ledge.
    h.run(g, 86, ['ArrowRight']); h.run(g, 30); h.run(g, 30, ['ArrowRight', 'ShiftLeft']);
    h.keys(['ArrowRight', 'ShiftLeft', 'Space']);
    let belowFlag = false;
    for (let i = 0; i < 35; i++) {
        g.update(recording.stepMs);
        belowFlag ||= Math.abs(g.player.data.position.x - G.checkpointX) < 20 && Math.abs(feet(g) - G.middleY) < 24;
        assert.equal(g.store.save.checkpoint, null, 'airborne below-bank proximity never captures');
    }
    assert.equal(belowFlag, false, 'a flush dock cannot reach the proximity box beneath the bank');
    h.run(g, 100, ['ArrowRight', 'ShiftLeft']);
    assert.equal(g.store.save.checkpoint, null); assert.equal(g.routing.selected, 'b');
    g.returnToSafePoint(); assert.equal(g.player.data.position.x, 48); assert.equal(g.routing.supplied, 'b');
    h.keys([]); g.load(G.id); replay(h, g, true);
    assert.equal(g.player.data.isGrounded, true); assert.equal(feet(g), G.middleY);
    assert.equal(snapshot(g).checkpoint?.index, 0, 'real supported arrival still captures natively');
});

test('the checkpoint plate can reverse A/B repeatedly and the next B crossing still completes', t => {
    const h = guairaJunctionBrowser(t), g = h.create(); replay(h, g, true);
    g.returnToSafePoint(); middlePlate(h, g);
    for (const outlet of ['b', 'a', 'b'] as const) {
        pound(h, g); assert.equal(g.routing.selected, outlet); assert.equal(g.routing.warning, true);
        h.run(g, 220); assert.equal(g.routing.supplied, outlet); assert.equal(g.moving, false);
        assert.equal(g.objects.get(G.entryPlateId)!.active, g.objects.get(G.middlePlateId)!.active);
        assert.equal(g.player.data.isDead, false); assert.equal(feet(g), G.middleY);
    }
    h.run(g, 25, ['ArrowRight']); h.run(g, 40, ['ArrowRight', 'Space']); h.run(g, 160, ['ArrowRight']);
    assert.equal(g.finished, true);
});

test('a skilled jump off rising B finishes on arrival without waiting for the empty decks to settle', t => {
    const h = guairaJunctionBrowser(t), g = h.create(); replay(h, g, true); g.returnToSafePoint();
    middlePlate(h, g); pound(h, g); h.run(g, 111, ['ArrowRight']);
    h.run(g, 40, ['ArrowRight', 'ShiftLeft', 'Space']);
    for (let i = 0; i < 100 && !g.finished; i++) {
        h.run(g, 1, ['ArrowRight', 'ShiftLeft']);
        if (g.player.data.isGrounded && feet(g) === G.terraceY && g.player.data.position.x >= G.finishX)
            assert.equal(g.finished, true, 'safe terrace arrival finishes immediately');
    }
    assert.equal(g.finished, true); assert.equal(g.moving, true, 'a still-moving empty deck adds no deadline or wait');
});

for (const afterCheckpoint of [false, true]) test(`a missed ${afterCheckpoint ? 'B' : 'A'} crossing returns over the dry floor with native controls`, t => {
    const h = guairaJunctionBrowser(t), g = h.create();
    if (afterCheckpoint) replay(h, g, true);
    h.run(g, afterCheckpoint ? 195 : 220, ['ArrowRight']); h.run(g, 30);
    assert.equal(feet(g), G.recoveryY); assert.equal(g.player.data.isDead, false);
    for (let i = 0; i < 480 && g.player.data.position.x > 150; i++) h.run(g, 1, ['ArrowLeft']);
    h.run(g, 20); h.run(g, 50, ['Space']); h.run(g, 20);
    assert.equal(feet(g), G.startY); assert.equal(g.player.data.isDead, false); assert.equal(g.player.data.hasHelmet, true);
    assert.ok(g.player.data.position.x >= 96 && g.player.data.position.x < 192, 'native recovery step reaches inlet plate bank');
    assert.equal(g.store.save.checkpoint?.index, afterCheckpoint ? 0 : undefined);
});

test('checkpoint death and safe-point return restore a known A support; full retry clears everything', t => {
    const h = guairaJunctionBrowser(t), g = h.create();
    for (const checkpoint of [false, true]) {
        h.keys([]); g.load(G.id); if (checkpoint) replay(h, g, true); else { h.run(g, 60, ['ArrowRight']); pound(h, g); }
        const previous = g.player; g.player.die('fall');
        for (let n = 0; n < 180 && g.player === previous; n++) h.run(g, 1);
        assert.notEqual(g.player, previous); assert.equal(g.player.data.isDead, false);
        assert.equal(g.player.data.position.x, checkpoint ? G.checkpointX : 48);
        assert.equal(g.routing.supplied, checkpoint ? 'a' : 'b'); assert.equal(g.routing.warning, false);
        assert.equal(g.objects.get(G.liftAId)!.y, checkpoint ? G.middleY : G.dockY);
        assert.equal(g.objects.get(G.liftBId)!.y, checkpoint ? G.dockY : G.terraceY);
    }
    h.run(g, 100); middlePlate(h, g); pound(h, g); h.run(g, 40);
    assert.equal(g.moving, true); g.toggleJunctionPause(); g.returnToSafePoint();
    assert.equal(g.state, 'playing'); assert.equal(g.player.data.position.x, G.checkpointX);
    assert.equal(g.routing.supplied, 'a'); assert.equal(g.moving, false); assert.equal(g.routing.warning, false);
    g.load(G.id); assert.equal(g.store.save.checkpoint, null); assert.equal(g.player.data.position.x, 48);
    assert.equal(g.routing.supplied, 'b'); assert.equal(g.finished, false); assert.equal(g.objects.time, 0);
    assert.equal(g.mapReturnHref, './guaira.html?at=town'); assert.deepEqual(g.store.save.completed, []);
});

test('pause, blur and tab hiding freeze warning/motion and clear held controls, including completion', t => {
    const h = guairaJunctionBrowser(t), g = h.create();
    for (const phase of ['warning', 'motion'] as const) for (const pause of [() => { h.key('Escape'); h.run(g, 1); },
        () => h.pointer(305, 10), () => h.window.dispatch('blur'), () => h.hidden(true)]) {
        h.keys([]); g.load(G.id); h.run(g, 60, ['ArrowRight']); pound(h, g);
        if (phase === 'motion') h.run(g, 50);
        assert.equal(phase === 'warning' ? g.routing.warning : g.moving, true);
        pause(); assert.equal(g.state, 'paused'); const frozen = snapshot(g);
        h.run(g, 120); g.render(); assert.deepEqual(snapshot(g), frozen);
        assert.equal(g.input.getState().right, false); assert.equal(g.input.getState().down, false);
        h.hidden(false); h.key('Escape', true); assert.equal(g.state, 'paused');
        h.key('Escape'); h.run(g, 1); assert.equal(g.state, 'playing');
    }
    h.keys([]); g.load(G.id); replay(h, g); g.toggleJunctionPause();
    const done = snapshot(g); h.run(g, 100); assert.deepEqual(snapshot(g), done);
    g.toggleJunctionPause(); h.run(g, 100); assert.deepEqual(snapshot(g), done);
});

test('reduced motion suppresses dust/impact/shake while native lift movement and completion remain unchanged', t => {
    const h = guairaJunctionBrowser(t, { reducedMotion: true }), g = h.create();
    assert.equal(g.reducedMotion, true); assert.equal(g.store.save.preferences.shake, false);
    const result = replay(h, g); assert.ok(result.carriedA > 70); assert.ok(result.carriedB > 100); assert.equal(g.finished, true);
    assert.deepEqual((g as unknown as { sparks: unknown[] }).sparks, []);
    const before = snapshot(g); g.render(); g.render(); assert.deepEqual(snapshot(g), before);
});

test('touch cancellation releases movement and sentada; safe return resets stale input', t => {
    const h = guairaJunctionBrowser(t, { touch: true }), g = h.create();
    h.keys(['ArrowRight', 'Space']); h.run(g, 1, ['ArrowRight', 'Space']);
    assert.ok(g.player.data.velocity.x > 0); assert.ok(g.player.data.velocity.y < 0);
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [{ identifier: 1 }, { identifier: 2 }] }); g.update(recording.stepMs);
    assert.equal(g.input.getState().right, false); assert.equal(g.input.getState().jump, false);
    g.returnToSafePoint(); h.run(g, 2); assert.equal(g.player.data.position.x, 48); assert.equal(g.routing.selected, 'b');
});
