import assert from 'node:assert/strict';
import test from 'node:test';
import { SkeletonBullModel, BULL_RULES as R } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { GuairaBullEncounter } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { guairaBrowser } from './helpers/guairaLabHarness';
import primary from './helpers/guairaLabReplay.json';
import failure from './helpers/guairaBullArcFailureReplay.json';

const player = { x: 10, y: 200, width: 14, height: 24 };
function ready(health: number, facing: -1 | 1) {
    const b = new SkeletonBullModel(); b.health = health; b.x = facing < 0 ? 256 : 16;
    b.state = 'idle'; b.stateTick = 23; b.cycle = 2;
    b.update(R.tickMs, { ...player, x: facing < 0 ? 10 : 290 }); return b;
}
for (const facing of [-1, 1] as const) for (const health of [4, 2])
test(`staggered volley keeps its announced height, direction and two real releases: health ${health}, facing ${facing}`, () => {
    const b = ready(health, facing), announced = structuredClone(b.boneShots);
    assert.deepEqual(announced.map(s => s.hopHeight), health === 4 ? [64, 44] : [80, 56]);
    assert.ok(announced[1].delay >= 16 && announced[1].delay <= 18);
    assert.ok(announced.every(s => s.x > b.arena.left && s.x + s.width < b.arena.right), 'neither loose rib spawns outside the corral');
    assert.ok(Object.isFrozen(b.boneShots) && b.boneShots.every(Object.isFrozen));
    // Changing sides cannot bend an already announced trajectory.
    for (let i = 0; i < R.rattle; i++) {
        assert.deepEqual(b.hazards, []); b.update(R.tickMs, { ...player, x: facing < 0 ? 306 : 0 });
        assert.deepEqual(b.boneShots, announced);
    }
    const releases = [b.events.filter(e => e.kind === 'bones').length];
    assert.equal(b.bones.length, 1); assert.equal(b.bones[0].age, 0);
    let caughtBoth = false;
    for (let age = 1; age < b.boneFlightDuration; age++) {
        b.update(R.tickMs, player); releases.push(b.events.filter(e => e.kind === 'bones').length);
        assert.equal(b.vulnerable, false);
        if (age === announced[1].delay) {
            assert.equal(b.bones.length, 2); assert.equal(b.bones[1].age, 0);
            assert.equal(b.bones[0].age, age); assert.notEqual(b.bones[0].y, b.bones[1].y); caughtBoth = true;
        }
        for (const bone of b.bones) assert.equal(bone.age, age - announced[bone.shot].delay);
    }
    assert.equal(caughtBoth, true); assert.equal(releases.reduce((a, n) => a + n, 0), 2);
    b.update(R.tickMs, player); assert.equal(b.state, 'recover'); assert.equal(b.openingTicksRemaining, 52);
    assert.deepEqual(b.hazards, []); assert.deepEqual(b.visibleBones, []);
});

test('100ms catch-up across the delayed launch matches six ordinary steps', () => {
    const a = ready(2, -1), b = ready(2, -1);
    for (const m of [a, b]) for (let i = 0; i < R.rattle + 15; i++) m.update(R.tickMs, player);
    a.update(100, player); for (let i = 0; i < 6; i++) b.update(R.tickMs, player);
    assert.deepEqual(a.bones, b.bones); assert.equal(a.bones.length, 2);
    assert.equal(a.events.filter(e => e.kind === 'bones').length, 1);
    assert.ok(a.hazards.some(h => h.x <= a.boneShots[1].x && h.x + h.width >= a.boneShots[1].x + 10));
});

function controls(h: ReturnType<typeof guairaBrowser>) {
    let held = new Set<string>(); return (codes: string[]) => {
        const keys = new Set(codes);
        for (const code of held) if (!keys.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        for (const code of keys) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        held = keys;
    };
}
function prefix(g: ReturnType<ReturnType<typeof guairaBrowser>['create']>, keys: (codes: string[]) => void, target: number) {
    let frame = 0;
    for (const [count, codes] of primary.runs as Array<[number, string[]]>) {
        keys(codes); for (let i = 0; i < count && frame < target; i++) { g.update(R.tickMs); frame++; }
        if (frame === target) break;
    }
    assert.equal(g.player.data.hasHelmet, true); return (g.boss as GuairaBullEncounter).model;
}
for (const offset of [-3, 0, 3]) test(`native held jump has a usable timing margin against the high pair (${offset} ticks)`, t => {
    const h = guairaBrowser(t), g = h.create(), keys = controls(h), b = prefix(g, keys, primary.markers.firstVolley);
    for (let age = 0; age < 160 && b.health === 4; age++) {
        const x = g.player.data.position.x;
        keys(['ShiftLeft', ...(x < 249 ? ['ArrowRight'] : x > 255 ? ['ArrowLeft'] : []), ...(age >= 12 + offset && age < 30 + offset ? ['Space'] : [])]);
        g.update(R.tickMs); assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
    }
    assert.equal(b.health, 3, 'the avoided volley still leaves a reachable punish');
});
for (const offset of [-3, 0, 3]) test(`native ground crossing remains a different escape in the final phase (${offset} ticks)`, t => {
    const h = guairaBrowser(t), g = h.create(), keys = controls(h), b = prefix(g, keys, primary.markers.finalVolley);
    const overhead = new Set<number>(); let groundedCrossing = false;
    for (let age = 0; age < 160 && b.health === 1; age++) {
        const x = g.player.data.position.x;
        keys(['ShiftLeft', ...(x < 39 ? ['ArrowRight'] : x > 45 ? ['ArrowLeft'] : []), ...(age >= 40 + offset && age < 58 + offset ? ['Space'] : [])]);
        g.update(R.tickMs); assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
        const p = g.player.getRect();
        for (const bone of b.bones) if (p.x < bone.x + bone.width && p.x + p.width > bone.x && bone.y + bone.height <= p.y) {
            overhead.add(bone.shot); groundedCrossing ||= g.player.data.isGrounded;
        }
    }
    assert.deepEqual([...overhead].sort(), [0, 1]); assert.equal(groundedCrossing, true); assert.equal(b.state, 'defeated');
});
test('a pause between launches freezes the held rib and resumes exactly one second release', t => {
    const h = guairaBrowser(t), g = h.create(), keys = controls(h), b = prefix(g, keys, primary.markers.firstVolley + 10);
    assert.equal(b.bones.length, 1); keys([]); g.toggleLabPause(); const before = JSON.stringify({ b, p: g.player.data });
    for (let i = 0; i < 30; i++) { g.update(100); g.render(); }
    assert.equal(JSON.stringify({ b, p: g.player.data }), before); g.toggleLabPause();
    let released = 0; for (let i = 0; i < 12; i++) { g.update(R.tickMs); released += b.events.filter(e => e.kind === 'bones').length; }
    assert.equal(released, 1); assert.equal(b.bones.length, 2);
});
test('the former low short-hop route now takes an actual visible projectile hit', t => {
    const h = guairaBrowser(t), g = h.create(), keys = controls(h); let frame = 0, helmet = true;
    const losses: number[] = [];
    for (const [count, codes] of failure.runs as Array<[number, string[]]>) {
        keys(codes); for (let i = 0; i < count; i++) {
            g.update(R.tickMs); frame++;
            if (helmet && !g.player.data.hasHelmet) { losses.push(frame); assert.ok((g.boss as GuairaBullEncounter).model.visibleBones.length > 0); }
            helmet = g.player.data.hasHelmet;
        }
    }
    assert.deepEqual(losses, [474]); assert.equal(g.boss?.health, 4); assert.equal(g.player.data.isDead, false);
});
