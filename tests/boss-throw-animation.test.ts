import test from 'node:test';
import assert from 'node:assert/strict';
import { BossEncounter } from '../src/adventure/BossEncounter';
import { WorldArt } from '../src/adventure/WorldArt';
import { BOSS_LOOPS } from '../src/adventure/WorldAssets';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { stageById } from '../src/adventure/campaign';
import type { PixelFrame } from '../src/graphics/pixels';

const tick = 1000 / 60;
const player = { x: 30, y: 200, width: 14, height: 24 };
function encounter(id: 'C1' | 'C2' = 'C2') {
    const stage = stageById(id === 'C1' ? '3-5' : '5-5')!;
    const boss = new BossEncounter(id), level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms);
    return { boss, level, objects, step: (dt = tick) => {
        objects.update(dt, level, player.x);
        boss.update(dt, player, objects, level);
    } };
}
function drawnFrame(boss: BossEncounter) {
    const art = new WorldArt();
    let frame: PixelFrame | undefined;
    art.atlas.draw = (_ctx, pixels) => { frame = pixels; };
    const c = { save() {}, restore() {}, fillRect() {} } as unknown as CanvasRenderingContext2D;
    const before = JSON.stringify(boss);
    art.boss(c, boss, 0, 64, boss.timer);
    assert.equal(JSON.stringify(boss), before, 'painting must not advance the encounter');
    return frame;
}

test('natural C2 retries retain all three throw frames without changing release cadence or projectile speed', () => {
    const h = encounter(), releases: number[] = [], followThrough = new Map<number, Set<number>>();
    let releasedAt = -Infinity;
    for (let frame = 0; frame < 480; frame++) {
        h.step();
        if (h.boss.released) {
            releasedAt = frame; releases.push(frame); followThrough.set(frame, new Set());
            const barrel = h.objects.barrels[h.objects.barrels.length - 1];
            assert.equal(barrel.x, h.boss.x - 12); assert.equal(barrel.y, h.boss.y + 8);
            assert.equal(barrel.vx, -1.8); assert.equal(barrel.vy, -2.5);
            assert.equal(barrel.pressurized, true); assert.equal(barrel.boss, true);
        }
        const elapsed = (frame - releasedAt) * tick;
        if (elapsed < 430) {
            assert.equal(h.boss.pose, 'shoot', `throw at ${releasedAt}, frame ${frame}`);
            assert.ok(Math.abs(h.boss.poseTime - elapsed) < 1e-8);
            const index = Math.min(2, Math.floor(h.boss.poseTime / 130));
            followThrough.get(releasedAt)!.add(index);
            assert.strictEqual(drawnFrame(h.boss), BOSS_LOOPS.calabrezzoCold.shoot[index]);
        } else if (elapsed >= 430 && elapsed < 450) {
            assert.equal(h.boss.pose, 'idle');
        }
    }
    assert.deepEqual(releases, [124, 278, 445]);
    assert.deepEqual([...followThrough.values()].map(frames => [...frames]), [[0, 1, 2], [0, 1, 2], [0, 1, 2]]);
    assert.equal(h.boss.health, h.boss.maxHealth);
});

for (const id of ['C1', 'C2'] as const) test(`${id} volley follows its actual release even when a step passes the 1200 ms threshold`, () => {
    const h = encounter(id); h.boss.health--;
    h.step(1200); h.step(951);
    assert.equal(h.boss.pattern, 'volley'); assert.equal(h.boss.poseTime, 0);
    h.step(651); assert.equal(h.boss.pose, 'windup');
    h.step(566);
    assert.equal(h.boss.timer, 1217); assert.equal(h.boss.released, true);
    assert.equal(h.boss.pose, 'shoot'); assert.equal(h.boss.poseTime, 0);
    const count = h.objects.barrels.length;
    for (const [dt, elapsed, index] of [[129, 129, 0], [1, 130, 1], [129, 259, 1], [1, 260, 2], [169, 429, 2]] as const) {
        // Keep the released projectiles in place; test only the presentation clock.
        h.boss.update(dt, player, h.objects, h.level);
        assert.equal(h.boss.pose, 'shoot'); assert.equal(h.boss.poseTime, elapsed);
        assert.equal(h.boss.released, false); assert.equal(h.objects.barrels.length, count);
        assert.strictEqual(drawnFrame(h.boss), BOSS_LOOPS[id === 'C1' ? 'calabrezzo' : 'calabrezzoCold'].shoot[index]);
    }
    h.boss.update(1, player, h.objects, h.level);
    assert.equal(h.boss.pose, 'idle');
});

test('opening and hit interrupt follow-through immediately; the next attack starts a fresh throw clock', () => {
    const h = encounter();
    h.step(1200); h.step(951); h.step(130);
    assert.equal(h.boss.pose, 'shoot');
    h.objects.get('iceRight')!.active = true;
    h.step();
    assert.equal(h.boss.phase, 'open'); assert.equal(h.boss.pose, 'recover');
    assert.equal(h.boss.poseTime, 0); assert.equal(h.objects.barrels.length, 0);
    const above = { x: h.boss.x + 4, y: h.boss.y - 5, width: 14, height: 24 };
    assert.equal(h.boss.contact(above, { ...above, y: h.boss.y - 25 }, true), 'hit');
    assert.equal(h.boss.pose, 'hurt');
    h.step(701); h.step();
    assert.equal(h.boss.phase, 'rest'); assert.equal(h.boss.pose, 'idle');
    h.step(1101); assert.equal(h.boss.phase, 'warning'); assert.equal(h.boss.pose, 'windup');
    h.step(951); assert.equal(h.boss.phase, 'attack'); assert.equal(h.boss.pose, 'shoot');
    assert.equal(h.boss.poseTime, 0);
    h.step(130); assert.equal(h.boss.poseTime, 130);
});

test('an opening cancels a pending retry and defeat or reconstruction cannot replay its throw', () => {
    const h = encounter();
    for (let frame = 0; frame <= 235; frame++) h.step();
    assert.equal(h.boss.phase, 'attack'); assert.equal(h.boss.pose, 'windup');
    h.objects.get('iceRight')!.active = true;
    h.step();
    assert.equal(h.boss.phase, 'open'); assert.equal(h.boss.pose, 'recover');
    for (let frame = 0; frame < 60; frame++) {
        h.step(); assert.equal(h.boss.released, false); assert.equal(h.objects.barrels.length, 0);
    }
    h.boss.health = 1;
    const above = { x: h.boss.x + 4, y: h.boss.y - 5, width: 14, height: 24 };
    assert.equal(h.boss.contact(above, { ...above, y: h.boss.y - 25 }, true), 'defeated');
    h.step(); assert.equal(h.boss.pose, 'dead');
    const fresh = encounter(); fresh.step();
    assert.equal(fresh.boss.pose, 'idle'); assert.equal(fresh.boss.released, false);
    assert.equal(fresh.objects.barrels.length, 0);
});
