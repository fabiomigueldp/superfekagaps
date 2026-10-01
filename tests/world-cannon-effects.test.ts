import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCannonBarrelEffects } from '../src/adventure/WorldCannonEffects';
import { WorldObjects, WorldLevel, type Barrel } from '../src/adventure/WorldPhysics';
import { stageById } from '../src/adventure/campaign';
class Capture {
    fillStyle = '';
    pixels: [number, number, number, number, string][] = [];
    fillRect(x: number, y: number, w: number, h: number) { this.pixels.push([x, y, w, h, this.fillStyle]); }
}
const draw = (p: Barrel, time: number, cx = 0) => {
    const c = new Capture();
    drawCannonBarrelEffects(c as unknown as CanvasRenderingContext2D, p, cx, 0, time);
    return c.pixels;
};
test('only launcher barrels receive cosmetic launch metadata', () => {
    const o = new WorldObjects([{ id: 'c', kind: 'launcher', x: 160, y: 208, width: 16, height: 16, period: 3200 }]);
    const boss = o.spawnBarrel(150, 140, -1, true, true);
    const level = new WorldLevel(stageById('3-5')!.level);
    o.update(1200, level, 160);
    const launched = o.barrels.find(p => !p.boss)!;
    assert.equal(launched.launchedAt, o.time);
    assert.equal(boss.launchedAt, undefined);
    assert.deepEqual(draw(boss, o.time), []);
    assert.ok(draw(launched, o.time).length);
    assert.equal(draw(launched, o.time + 300).length, 0);
});
test('landing splash remains at the copied world contact after a keg rolls away', () => {
    const o = new WorldObjects([]), l = new WorldLevel(stageById('3-5')!.level), p = o.spawnBarrel(155, 140, 1, true);
    p.launchedAt = 0;
    for (let i = 0; i < 45 && p.landedAt === undefined; i++) o.update(1000 / 60, l, 155);
    assert.ok(p.landedAt !== undefined && p.landingPoint !== undefined);
    const contact = { ...p.landingPoint }, pixels = draw(p, p.landedAt + 80);
    p.x += 80; p.y -= 20;
    assert.deepEqual(p.landingPoint, contact);
    assert.deepEqual(draw(p, p.landedAt + 80), pixels, 'Landing debris cannot follow a moving barrel');
    assert.deepEqual(draw(p, p.landedAt + 300), []);
});
test('pause, camera reentry and restart do not advance or retain launcher effects', () => {
    const p = new WorldObjects([]).spawnBarrel(150, 208, -1, true);
    p.launchedAt = 0; p.landedAt = 320; p.landingPoint = { x: 100, y: 224 };
    const frozen = structuredClone(p), pixels = draw(p, 400);
    assert.deepEqual(draw(p, 400), pixels);
    const movedCamera = draw(p, 400, 20);
    assert.deepEqual(movedCamera, pixels.map(([x, y, w, h, color]) => [x - 20, y, w, h, color]));
    assert.deepEqual(draw(p, 400), pixels, 'Reentry at the same simulation time has the same effect');
    assert.deepEqual(p, frozen);
    assert.deepEqual(new WorldObjects([]).barrels, []);
});
