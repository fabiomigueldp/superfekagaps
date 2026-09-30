import test from 'node:test';
import assert from 'node:assert/strict';
import { stageById } from '../src/adventure/campaign';
import { WorldLevel, WorldObjects, BELT_CARRY_SPEED } from '../src/adventure/WorldPhysics';
import { cannonCycle, cannonMuzzle, jetCycle } from '../src/adventure/WorldMachineState';
import { overlaps } from '../src/adventure/types';

const jet = () => new WorldObjects([{ id: 'j', kind: 'jet', x: 160, y: 176, width: 13, height: 48, period: 4200 }]);
test('a rising jet only hurts inside the visible liquid and recedes before venting', () => {
    const o = jet(), b = o.get('j')!;
    const head = { x: 160, y: 176, width: 14, height: 14 };
    o.time = 1750;
    assert.equal(o.jetState(b), 'warning');
    assert.equal(o.jetDanger(b), null);
    o.time = 1840;
    const rising = o.jetDanger(b)!;
    assert.ok(rising.height > 0 && rising.height < b.height / 2);
    assert.equal(overlaps(head, rising), false, 'There is no invisible full-height damage while the jet emerges.');
    assert.equal(rising.y + rising.height, b.y + b.height - 4);
    o.time = 2100;
    assert.ok(overlaps(head, o.jetDanger(b)!));
    o.time = 2460;
    assert.ok(o.jetDanger(b)!.height < rising.height);
    assert.equal(overlaps(head, o.jetDanger(b)!), false);
    o.time = 2530;
    assert.equal(jetCycle(b, o.time).phase, 'venting');
    assert.equal(o.jetDanger(b), null);
});
test('closing a jet valve removes danger immediately, including negative phase offsets', () => {
    const o = jet(), b = o.get('j')!;
    b.phase = -10000;
    o.time = 12000;
    assert.ok(o.jetDanger(b));
    b.active = true;
    assert.equal(o.jetDanger(b), null);
    assert.equal(o.jetState(b), 'off');
    b.active = false;
    assert.deepEqual(jetCycle(b, 0), jetCycle(b, 4200), 'Negative offsets wrap instead of extending the off period.');
    b.phase = 0; b.period = 8400;
    assert.equal(jetCycle(b, 3000).phase, 'charging');
    assert.ok(jetCycle(b, 4000).danger);
});
test('jet warning and release sounds occur once at the transition and only nearby', () => {
    const o = jet(), b = o.get('j')!, level = new WorldLevel(stageById('3-5')!.level);
    o.time = 990;
    o.update(20, level, 150);
    assert.equal(o.events.filter(e => e.kind === 'pressure').length, 1);
    o.update(20, level, 150);
    assert.equal(o.events.length, 0);
    o.time = 1790;
    o.update(30, level, 150);
    assert.equal(o.events.filter(e => e.kind === 'jet').length, 1);
    o.update(30, level, 150);
    assert.equal(o.events.length, 0);
    b.phase = 0; o.time = 990;
    o.update(20, level, 1000);
    assert.equal(o.events.length, 0);
});
test('cannons eject one keg beyond their visible muzzle in either facing', () => {
    for (const direction of [-1, 1] as const) {
        const o = new WorldObjects([{ id: 'c', kind: 'launcher', x: 160, y: 208, width: 16, height: 16, direction, period: 3200 }]);
        const b = o.get('c')!, level = new WorldLevel(stageById('3-5')!.level), muzzle = cannonMuzzle(b);
        o.update(1200, level, 160);
        assert.equal(o.barrels.length, 1);
        const keg = o.barrels[0];
        assert.equal(Math.sign(keg.vx), direction);
        assert.ok(direction < 0 ? keg.x + keg.width < muzzle.x : keg.x > muzzle.x);
        assert.equal(keg.y + keg.height / 2, muzzle.y);
        assert.equal(cannonCycle(b, o.time).pose, 'fire');
        assert.equal(o.events.filter(e => e.kind === 'cannon').length, 1);
        o.update(100, level, 160);
        assert.equal(cannonCycle(b, o.time).pose, 'recoil');
        assert.equal(o.barrels.length, 1, 'Recoil must not emit another projectile.');
        assert.equal(o.events.filter(e => e.kind === 'cannon').length, 0);
        o.update(300, level, 160);
        assert.equal(cannonCycle(b, o.time).pose, 'reload');
    }
});
test('barrel spin follows movement and reverses with the conveyor', () => {
    const o = new WorldObjects([{ id: 'belt', kind: 'belt', x: 80, y: 220, width: 160, height: 4, direction: -1 }]);
    const level = new WorldLevel(stageById('3-5')!.level), keg = o.spawnBarrel(150, 208, -1);
    o.update(16, level, 150);
    assert.ok(keg.rotation < 0);
    const before = keg.rotation;
    o.get('belt')!.active = true;
    o.update(16, level, 150);
    assert.ok(keg.rotation > before);
    assert.ok(keg.returned);
});
test('a falling barrel reports one landing instead of repeated ground impacts', () => {
    const o = new WorldObjects([]), level = new WorldLevel(stageById('3-5')!.level);
    const keg = o.spawnBarrel(155, 140, 1);
    let landings = 0;
    for (let i = 0; i < 45; i++) {
        o.update(1000 / 60, level, 155);
        landings += o.events.filter(e => e.kind === 'barrelLand').length;
    }
    assert.equal(landings, 1);
    assert.ok(keg.landedAt !== undefined);
});
test('conveyor tread keeps its position when reversed and matches the player carry speed', () => {
    const o = new WorldObjects([
        { id: 'b', kind: 'belt', x: 80, y: 220, width: 160, height: 4, direction: -1 },
        { id: 's', kind: 'switch', x: 30, y: 220, width: 24, height: 4, link: 'b' }
    ]), l = new WorldLevel(stageById('3-5')!.level), b = o.get('b')!;
    o.update(1000 / 60, l, 80);
    assert.equal(b.beltOffset, -BELT_CARRY_SPEED);
    const before = b.beltOffset;
    assert.ok(o.activate('s'));
    assert.equal(b.beltOffset, before, 'Toggling must not jump the visible tread to another position.');
    o.update(1000 / 60, l, 80);
    assert.equal(b.beltOffset, before + BELT_CARRY_SPEED);
    assert.equal(b.changedAt, 1000 / 60);
});
test('encounter changes get one visual transition and imported specs remain immutable', () => {
    const specs = [{ id: 'support', kind: 'support' as const, x: 80, y: 160, width: 64, height: 8, to: { x: 80, y: 208 } }];
    const o = new WorldObjects(specs), l = new WorldLevel(stageById('6-5')!.level), b = o.get('support')!;
    b.active = true;
    o.update(16, l, 80);
    assert.equal(b.changedAt, 16);
    o.update(16, l, 80);
    assert.equal(b.changedAt, 16);
    assert.deepEqual(specs[0], { id: 'support', kind: 'support', x: 80, y: 160, width: 64, height: 8, to: { x: 80, y: 208 } });
    assert.ok(b.y > 160);
    b.active = false;
    o.update(16, l, 80);
    assert.equal(b.changedAt, 48);
});
