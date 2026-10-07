import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/entities/Player';
import { PLAYER_RUN_SPEED } from '../src/constants';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import { SalonEntryTransition, salonEntryPlayer, salonEntryButtonPosition, canApproachSalon,
    drawSalonEntryCue, drawSalonEntryDoor, drawSalonEntryShade } from '../src/adventure/factory/SalonEntryTransition';

test('safe grounded approach gives an 86px interaction window without changing the 24px doorway', () => {
    const player = new Player(0, 0).data;
    const rect = { x: FACTORY_SALON.door.x, y: FACTORY_SALON.support.y - player.height,
        width: player.width, height: player.height };
    const left = FACTORY_SALON.door.x - 24 - player.width;
    const right = FACTORY_SALON.door.x + FACTORY_SALON.door.width + 24;
    assert.equal(right - left, 86);
    assert.equal(canApproachSalon('3-3', { ...rect, x: left + .1 }, true), true);
    assert.equal(canApproachSalon('3-3', { ...rect, x: right - .1 }, true), true);
    for (const x of [left, right, left - 1, right + 1])
        assert.equal(canApproachSalon('3-3', { ...rect, x }, true), false);
    assert.equal(canApproachSalon('3-3', rect, false), false, 'no airborne entry');
    assert.equal(canApproachSalon('3-2', rect, true), false);
    assert.equal(canApproachSalon('3-3', { ...rect, y: rect.y - 8 }, true), false, 'no different-height support');
    assert.equal(canApproachSalon('3-3', { ...rect, x: NaN }, true), false);
    assert.equal(FACTORY_SALON.door.width, 24, 'collision/portal geometry stays authored');
    const oldFrames = (24 + player.width) / PLAYER_RUN_SPEED;
    const newFrames = (right - left) / PLAYER_RUN_SPEED;
    assert.ok(newFrames > 24 && oldFrames < 11, 'cue window grows from ~0.18s to ~0.41s at 60Hz run speed');
});

test('entry is bounded to 420ms departure + 160ms reveal with a single covered handoff', () => {
    const entry = new SalonEntryTransition();
    assert.equal(entry.frame.shade, 0);
    assert.equal(entry.advance(239), null); assert.ok(entry.frame.walk < 1);
    assert.equal(entry.advance(1), null); assert.equal(entry.frame.walk, 1);
    assert.equal(entry.advance(179), null); assert.ok(entry.frame.shade > .99);
    assert.equal(entry.advance(1), 'handoff');
    assert.equal(entry.frame.phase, 'incoming'); assert.equal(entry.frame.shade, 1);
    assert.equal(entry.advance(159), null);
    assert.equal(entry.advance(1), 'finished');
    assert.equal(entry.active, false); assert.equal(entry.frame.shade, 0);
    assert.equal(entry.advance(1000), null); assert.equal(entry.skip(), null);
});

test('reduced motion uses only a short fade, without walking or moving curtains', () => {
    const entry = new SalonEntryTransition(true);
    entry.advance(40);
    assert.equal(entry.frame.walk, 0); assert.equal(entry.frame.doorOpen, 0);
    assert.equal(entry.frame.playerAlpha, 1); assert.equal(entry.frame.shade, .5);
    assert.equal(entry.advance(40), 'handoff');
    assert.equal(entry.advance(100), 'finished'); assert.equal(entry.active, false);
});

test('skip, cancel, invalid deltas and suspended frames cannot emit duplicate handoffs', () => {
    const entry = new SalonEntryTransition();
    const initial = entry.frame;
    for (const dt of [NaN, Infinity, -1, 0]) assert.equal(entry.advance(dt), null);
    assert.equal(entry.advance(1000, true), null); assert.deepEqual(entry.frame, initial);
    assert.equal(entry.advance(1e9), 'handoff');
    assert.equal(entry.frame.shade, 1, 'long frames still cover the scene swap');
    assert.equal(entry.skip(), 'finished'); assert.equal(entry.skip(), null);
    for (const afterHandoff of [false, true]) {
        const cancelled = new SalonEntryTransition();
        if (afterHandoff) cancelled.skip();
        cancelled.cancel(); cancelled.cancel();
        assert.equal(cancelled.active, false); assert.equal(cancelled.advance(1000), null);
        assert.equal(cancelled.skip(), null); assert.equal(cancelled.frame.shade, 0);
    }
    const retry = new SalonEntryTransition(); assert.equal(retry.advance(420), 'handoff');
});

test('entry moves only an actor drawing copy and preserves exact saved campaign state', () => {
    const actor = new Player(111, 12).data;
    actor.position = { x: 1765, y: 200 }; actor.velocity = { x: 2.7, y: 0 };
    actor.isGrounded = true; actor.hasHelmet = true; actor.invincibleTimer = 90;
    const original = JSON.stringify(actor), entry = new SalonEntryTransition();
    entry.advance(120);
    const view = salonEntryPlayer(actor, entry.frame);
    assert.notEqual(view, actor); assert.notEqual(view.position, actor.position);
    assert.ok(view.position.x > actor.position.x); assert.equal(view.position.y, actor.position.y);
    assert.equal(view.hasHelmet, true); assert.equal(view.invincibleTimer, 90);
    entry.advance(120);
    assert.equal(salonEntryPlayer(actor, entry.frame).position.x + actor.width / 2,
        FACTORY_SALON.door.x + FACTORY_SALON.door.width / 2);
    assert.equal(JSON.stringify(actor), original);
    assert.deepEqual(salonEntryPlayer(actor, new SalonEntryTransition(true).frame).position, actor.position);
});

test('native accessible target stays on the world plaque at compact, desktop and shifted viewport sizes', () => {
    for (const [width, height, left, top] of [[320, 180, 0, 100], [1280, 720, 100, 40], [256, 144, 20, 0]]) {
        const position = salonEntryButtonPosition({ left, top, width, height }, { x: 1630, y: 72 });
        assert.equal(position.left, left + 158 * width / 320);
        assert.equal(position.top, top + 93 * height / 180);
        assert.ok(position.width >= 44 && position.height >= 44);
    }
});

test('entry art stays native pixel-aligned and curtain/detail never paint below the existing floor', () => {
    const rects: number[][] = [];
    const c = { fillStyle: '', globalAlpha: 1, save() {}, restore() {}, translate() {},
        fillRect(...r: number[]) { rects.push(r); } } as unknown as CanvasRenderingContext2D;
    const entry = new SalonEntryTransition(); entry.advance(180);
    drawSalonEntryDoor(c, 1640.4, 72.4, entry.frame);
    assert.ok(rects.length > 10);
    assert.ok(rects.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger) && y + h <= -2));
    rects.length = 0; drawSalonEntryCue(c, 1640.4, 72.4);
    assert.ok(rects.every(r => r.every(Number.isInteger)));
    rects.length = 0; drawSalonEntryShade(c, entry.frame); assert.equal(rects.length, 0);
    entry.advance(140); drawSalonEntryShade(c, entry.frame); assert.deepEqual(rects, [[0, 0, 320, 180]]);
});
